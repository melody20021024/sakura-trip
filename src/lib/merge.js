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
        lodgingMap: pick(cur.lodgingMap, d.lodgingMap),
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
    let city = base.city, lodging = base.lodging, lodgingMap = base.lodgingMap, items = [];
    for (const d of group) {
      city = pick(city, d.city);
      lodging = pick(lodging, d.lodging);
      lodgingMap = pick(lodgingMap, d.lodgingMap);
      items = mergeList(items, d.items || []);
    }
    // de-dup unioned items by content (collapses identical sample copies);
    // prefer live so a stale deletion of one copy doesn't drop the others
    const seen = new Map();
    for (const it of items) {
      const k = itemContentKey(it);
      const prev = seen.get(k);
      seen.set(k, prev ? preferLive(prev, it) : it);
    }
    out.push({ ...base, city, lodging, lodgingMap, items: [...seen.values()] });
  }
  return out;
}

// When collapsing two entries of identical content, prefer the LIVE one — a
// stale deletion of one duplicate must not nuke the others (that wiped the
// sample flights). Only keep a tombstone if every copy of that content is
// deleted.
function preferLive(a, b) {
  const ad = !!a._deleted, bd = !!b._deleted;
  if (ad !== bd) return ad ? b : a;
  return pick(a, b);
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
    seen.set(k, prev ? preferLive(prev, x) : x);
  }
  return [...seen.values()];
}
const flightKey = (f) => `${f.label}|${f.flightNo}|${f.from}|${f.to}|${f.dep}|${f.arr}`;
const checkKey = (c) => `${c.name}|${c.meta || ""}`;
const albumKey = (a) => `${a.label}|${a.url}`;

// Normalise a trip: one day per date, and identical sample list-entries de-duped.
//
// `pockets` and `places` are deliberately NOT de-duped by content (PRD §5.4①).
// Content de-dup runs on every merge — on load, on every realtime push, and
// inside pushRemote's read-merge-write — so a single false positive is
// permanent data loss: two different 一蘭 branches whose `area` was typed
// loosely would be silently collapsed into one. Duplicate detection for places
// lives in the F-72 review step instead (lib/places.js dedupeAgainstSaved),
// where it only marks a row and leaves it unticked: the user sees it, can
// override it, and the cost of a false positive is one extra tap.
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

// Every top-level key mergeTrip knows how to merge. Anything outside this set
// belongs to a schema version this bundle predates.
const KNOWN_TRIP_KEYS = new Set([
  "schemaVersion", "tripName", "startDate", "endDate", "rate", "budgetJPY",
  "travelers", "flights", "days", "expenses", "food", "shopping", "packing",
  "albums", "pockets", "places", "_v1backup",
]);

// Carry unknown top-level fields across the merge. This bundle cannot merge a
// field it has never heard of, but it must not delete it either: mergeTrip runs
// on load, on every realtime push, and inside pushRemote's read-merge-write, so
// dropping a field here means an older device erases it for everyone. Union with
// remote winning — an older bundle can't have edited a field it doesn't render,
// so its copy is only ever a stale pull.
function passthrough(local, remote) {
  const out = {};
  for (const src of [local, remote]) {
    for (const k of Object.keys(src)) {
      if (!KNOWN_TRIP_KEYS.has(k)) out[k] = src[k];
    }
  }
  return out;
}

export function mergeTrip(local, remote) {
  if (!remote) return normalizeTrip(local);
  if (!local) return normalizeTrip(remote);
  return normalizeTrip({
    ...passthrough(local, remote),
    // Never write a version lower than either side's. Hard-coding SCHEMA_VERSION
    // here let an older bundle relabel a newer blob as its own, which is what
    // made validateTrip accept the stripped result and push it to the cloud.
    // Keeping the higher number makes validateTrip reject the write instead, so
    // a stale device degrades to read-only rather than destroying data.
    schemaVersion: Math.max(
      local.schemaVersion || 0,
      remote.schemaVersion || 0,
      SCHEMA_VERSION
    ),
    tripName: pick(local.tripName, remote.tripName),
    startDate: pick(local.startDate, remote.startDate),
    endDate: pick(local.endDate, remote.endDate),
    rate: pick(local.rate, remote.rate),
    budgetJPY: pick(local.budgetJPY, remote.budgetJPY),
    travelers: pick(local.travelers, remote.travelers), // LWW so removals stick (v4)
    flights: mergeList(local.flights, remote.flights),
    days: mergeDays(local.days, remote.days),
    expenses: mergeList(local.expenses, remote.expenses),
    food: mergeList(local.food, remote.food),
    shopping: mergeList(local.shopping, remote.shopping),
    packing: mergeList(local.packing, remote.packing),
    albums: mergeList(local.albums, remote.albums),
    // v5. Whole-record LWW, same as every other list: a place is small enough
    // that field-level merging buys nothing, and `days` is the only structure
    // that needs its children merged.
    pockets: mergeList(local.pockets, remote.pockets),
    places: mergeList(local.places, remote.places),
    // keep a one-time v1 backup if either side carries it
    ...(local._v1backup || remote._v1backup
      ? { _v1backup: local._v1backup || remote._v1backup }
      : {}),
  });
}

// Strip tombstones and sort, for rendering. Days keep their own item ordering.
export const liveItems = (arr = []) => arr.filter((x) => x && !x._deleted);
