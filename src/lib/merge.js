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

// Stable serialization with sorted keys at every level, so two clients that
// built the "same" object via different code paths (migrate vs. live mutator)
// still compare identically. Plain JSON.stringify is key-order dependent.
function stableStr(o) {
  return JSON.stringify(o, (_k, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]]))
      : v
  );
}

// Deterministic tie-break when updatedAt is equal on both sides:
//   1. a deletion (tombstone) wins, so a delete never "loses" to a stale edit
//      at the same instant and can't diverge (one client deletes, other keeps);
//   2. otherwise the stable-serialized larger value wins — identical on every
//      client regardless of which side is "local".
function pick(a, b) {
  if (a === undefined) return b;
  if (b === undefined) return a;
  if (ts(b) > ts(a)) return b;
  if (ts(a) > ts(b)) return a;
  const da = a._deleted ? 1 : 0;
  const db = b._deleted ? 1 : 0;
  if (db !== da) return db > da ? b : a;
  return stableStr(b) > stableStr(a) ? b : a;
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
      // base resolves date / _deleted / day-level updatedAt; city & lodging are
      // mergeable scalars merged field-by-field so two people editing different
      // fields of the same day don't clobber each other (was 高-1 data loss).
      const base = pick(cur, d);
      byId.set(d.id, {
        ...base,
        city: pick(cur.city, d.city),
        lodging: pick(cur.lodging, d.lodging),
        items: mergeList(cur.items, d.items),
      });
    }
  }
  return [...byId.values()];
}

// Collapse days that share the same calendar date into one (this app only ever
// wants one card per date). Heals the "duplicate days" bug where seeding the
// sample trip across sessions produced several same-date days with different
// ids. The surviving id is the lexicographically smallest so every client
// converges. Items are unioned and then de-duplicated by content, so the
// triplicated sample items collapse back to one each.
const itemContentKey = (it) =>
  `${it.time || ""}|${it.type || ""}|${it.title || ""}|${it.note || ""}`;

export function collapseDaysByDate(days = []) {
  const groups = new Map();
  for (const d of days) {
    if (!d || d.date == null) continue;
    const g = groups.get(d.date);
    if (g) g.push(d); else groups.set(d.date, [d]);
  }
  const out = [];
  for (const group of groups.values()) {
    if (group.length === 1) { out.push(group[0]); continue; }
    group.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const base = group[0];
    let city = base.city, lodging = base.lodging, items = [];
    for (const d of group) {
      city = pick(city, d.city);
      lodging = pick(lodging, d.lodging);
      items = mergeList(items, d.items || []);
    }
    // de-dup unioned items by content (collapses identical sample copies)
    const seen = new Map();
    for (const it of items) {
      const k = itemContentKey(it);
      const prev = seen.get(k);
      seen.set(k, prev ? pick(prev, it) : it);
    }
    out.push({ ...base, city, lodging, items: [...seen.values()] });
  }
  return out;
}

// De-dup a list by content (ignoring id/updatedAt) so identical sample copies
// seeded with different ids collapse back to one. Used to heal the duplicate
// flights / checklist items from the same bug as duplicate days.
function dedupeByContent(list = [], keyFn) {
  const seen = new Map();
  for (const x of list) {
    if (!x) continue;
    const k = keyFn(x);
    const prev = seen.get(k);
    seen.set(k, prev ? pick(prev, x) : x);
  }
  return [...seen.values()];
}
const flightKey = (f) => `${f.label}|${f.flightNo}|${f.from}|${f.to}|${f.dep}|${f.arr}`;
const checkKey = (c) => `${c.name}|${c.meta || ""}`;
const albumKey = (a) => `${a.label}|${a.url}`;

// Normalise a trip: one day per date, and identical sample list-entries de-duped.
export function normalizeTrip(t) {
  if (!t) return t;
  return {
    ...t,
    flights: dedupeByContent(t.flights, flightKey),
    days: collapseDaysByDate(t.days),
    food: dedupeByContent(t.food, checkKey),
    shopping: dedupeByContent(t.shopping, checkKey),
    packing: dedupeByContent(t.packing, checkKey),
    albums: dedupeByContent(t.albums, albumKey),
  };
}

export function mergeTrip(local, remote) {
  if (!remote) return normalizeTrip(local);
  if (!local) return normalizeTrip(remote);
  return normalizeTrip({
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
  });
}

// Strip tombstones and sort, for rendering. Days keep their own item ordering.
export const liveItems = (arr = []) => arr.filter((x) => x && !x._deleted);
