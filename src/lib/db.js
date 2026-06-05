// Local-first persistence (F-02). IndexedDB (via Dexie) is the source of truth;
// the cloud is a sync target. Reads hit IndexedDB first so the app opens
// instantly and works offline.
import Dexie from "dexie";

// One row per trip: { id, data, dirty, updatedAt }.
//   dirty = there are local edits not yet confirmed pushed to the cloud.
const db = new Dexie("sakura-trip");
db.version(1).stores({ trips: "id" });

// Whether IndexedDB is usable at all (private mode on some browsers blocks it).
let available = true;
// In-memory fallback so the app still runs (just not across reloads).
const mem = new Map();

export async function loadTrip(id) {
  if (!available) return mem.get(id) ?? null;
  try {
    const row = await db.trips.get(id);
    return row ? row.data : null;
  } catch {
    available = false;
    return mem.get(id) ?? null;
  }
}

export async function saveTrip(id, data, { dirty = true } = {}) {
  const row = { id, data, dirty, updatedAt: Date.now() };
  if (!available) {
    mem.set(id, data);
    return;
  }
  try {
    await db.trips.put(row);
  } catch {
    available = false;
    mem.set(id, data);
  }
}

export async function markClean(id) {
  if (!available) return;
  try {
    const row = await db.trips.get(id);
    if (row) await db.trips.put({ ...row, dirty: false });
  } catch {
    available = false;
  }
}

export async function isDirty(id) {
  if (!available) return false;
  try {
    const row = await db.trips.get(id);
    return !!(row && row.dirty);
  } catch {
    return false;
  }
}

export const isAvailable = () => available;
