// Field-level merge (F-03). Replaces v1's whole-blob last-write-wins, which
// let two editors clobber each other's work. Contract: 03-DesignDocs/
// backend/sync-and-apis.md §5.2.
//
// Properties we rely on and test for:
//   - idempotent:   merge(a, a) === a
//   - commutative:  merge(a, b) converges to the same result as merge(b, a)
//   - tombstones:   deletions are kept as { _deleted: true } so a stale copy
//                   can't resurrect a removed item.
import { SCHEMA_VERSION } from "./schema.js";

const ts = (x) => (x && typeof x.updatedAt === "number" ? x.updatedAt : 0);

// Deterministic tie-break when updatedAt is equal on both sides: pick the
// larger JSON serialization. Independent of which side is "local", so every
// client converges to the same value.
function pick(a, b) {
  if (a === undefined) return b;
  if (b === undefined) return a;
  if (ts(b) > ts(a)) return b;
  if (ts(a) > ts(b)) return a;
  return JSON.stringify(b) > JSON.stringify(a) ? b : a;
}

export const newer = pick;

export function union(a = [], b = []) {
  return Array.from(new Set([...a, ...b]));
}

// Merge two lists of { id, updatedAt, _deleted? } by id; newer wins.
// Tombstones are retained (filter them out at render time with liveItems).
export function mergeList(a = [], b = []) {
  const map = new Map();
  for (const x of [...a, ...b]) {
    if (!x || x.id == null) continue;
    const cur = map.get(x.id);
    map.set(x.id, cur ? pick(cur, x) : x);
  }
  return [...map.values()];
}

// Days need their nested items merged too.
export function mergeDays(a = [], b = []) {
  const byId = new Map();
  for (const d of [...a, ...b]) {
    if (!d || d.id == null) continue;
    const cur = byId.get(d.id);
    if (!cur) {
      byId.set(d.id, d);
    } else {
      const win = pick(cur, d);
      byId.set(d.id, { ...win, items: mergeList(cur.items, d.items) });
    }
  }
  return [...byId.values()];
}

export function mergeTrip(local, remote) {
  if (!remote) return local;
  if (!local) return remote;
  return {
    schemaVersion: SCHEMA_VERSION,
    tripName: pick(local.tripName, remote.tripName),
    startDate: pick(local.startDate, remote.startDate),
    endDate: pick(local.endDate, remote.endDate),
    rate: pick(local.rate, remote.rate),
    budgetJPY: pick(local.budgetJPY, remote.budgetJPY),
    travelers: union(local.travelers, remote.travelers),
    flights: mergeList(local.flights, remote.flights),
    days: mergeDays(local.days, remote.days),
    expenses: mergeList(local.expenses, remote.expenses),
    food: mergeList(local.food, remote.food),
    shopping: mergeList(local.shopping, remote.shopping),
    packing: mergeList(local.packing, remote.packing),
    albums: mergeList(local.albums, remote.albums),
    // keep a one-time v1 backup if either side carries it
    ...(local._v1backup || remote._v1backup
      ? { _v1backup: local._v1backup || remote._v1backup }
      : {}),
  };
}

// Strip tombstones and sort, for rendering. Days keep their own item ordering.
export const liveItems = (arr = []) => arr.filter((x) => x && !x._deleted);
