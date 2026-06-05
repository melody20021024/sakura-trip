// Cloud sync primitives over Supabase. Stateless helpers; the orchestration
// (debounce, retry, offline queue) lives in hooks/useTrip.js.
import { supabase } from "../supabase.js";
import { migrate } from "./migrate.js";
import { validateTrip } from "./schema.js";

// Pull the cloud copy, migrated to v2. Returns null if no row / empty.
export async function pullRemote(key) {
  const { data: row, error } = await supabase
    .from("trips")
    .select("data")
    .eq("id", key)
    .maybeSingle();
  if (error) throw error;
  if (!row || !row.data || !Object.keys(row.data).length) return null;
  return migrate(row.data);
}

// Validate (F-07) then upsert. Throws on invalid or on network/db error so the
// caller can mark the sync state failed and retry.
export async function pushRemote(key, data, clientId) {
  const v = validateTrip(data);
  if (!v.ok) throw new Error(v.reason);
  const { error } = await supabase.from("trips").upsert({
    id: key,
    data,
    writer: clientId,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

// Subscribe to realtime changes from *other* clients. Returns an unsubscribe fn.
export function subscribeRemote(key, clientId, onRemote) {
  const ch = supabase
    .channel("trip-" + key)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "trips", filter: "id=eq." + key },
      (payload) => {
        const row = payload.new;
        if (row && row.writer !== clientId && row.data) onRemote(migrate(row.data));
      }
    )
    .subscribe();
  return () => supabase.removeChannel(ch);
}
