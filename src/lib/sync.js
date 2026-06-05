// Cloud sync primitives over Supabase. Stateless helpers; the orchestration
// (debounce, retry, offline queue) lives in hooks/useTrip.js.
import { supabase } from "../supabase.js";
import { mergeTrip } from "./merge.js";
import { migrate } from "./migrate.js";
import { validateTrip } from "./schema.js";

const MAX_CAS = 4;

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

// Read-merge-write with optimistic concurrency (fixes SA 高-3 / 中-5).
//
// A blind upsert overwrote the whole `data` column, so an editor coming back
// online would clobber writes another device made while it was offline. We now
// re-read the row, merge against the *current* cloud copy, then write only if
// the row's updated_at hasn't changed since we read it (compare-and-set). If it
// changed under us, we re-read/re-merge and retry. Returns the merged data so
// the caller can adopt the other side's changes locally.
export async function pushRemote(key, localData, clientId) {
  const v = validateTrip(localData);
  if (!v.ok) throw new Error(v.reason);

  for (let attempt = 0; attempt < MAX_CAS; attempt++) {
    const { data: row, error: selErr } = await supabase
      .from("trips")
      .select("data, updated_at")
      .eq("id", key)
      .maybeSingle();
    if (selErr) throw selErr;

    const remote = row && row.data && Object.keys(row.data).length ? migrate(row.data) : null;
    const merged = mergeTrip(localData, remote);
    const stamp = new Date().toISOString();

    if (!row) {
      // No row yet: insert. If another client inserts first we get a conflict
      // and retry (which now sees the row and takes the update path).
      const { error } = await supabase
        .from("trips")
        .insert({ id: key, data: merged, writer: clientId, updated_at: stamp });
      if (!error) return merged;
      if (error.code !== "23505") throw error; // not a unique-violation -> real error
    } else {
      // CAS: only write if updated_at still matches what we read.
      const { data: updated, error } = await supabase
        .from("trips")
        .update({ data: merged, writer: clientId, updated_at: stamp })
        .eq("id", key)
        .eq("updated_at", row.updated_at)
        .select("id");
      if (error) throw error;
      if (updated && updated.length) return merged;
      // else someone updated between our read and write -> retry
    }
  }
  throw new Error("sync conflict after retries");
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
