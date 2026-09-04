// v1 -> v2 migration (idempotent). Contract: 03-DesignDocs/backend/
// sync-and-apis.md §5.3. Wraps v1 scalars as { v, updatedAt: 0 }, adds
// updatedAt to every list item, gives day items an explicit order, seeds the
// new packing list, and backs up the raw v1 blob once.
import { SCHEMA_VERSION, scalar, DEFAULT_TRAVELERS } from "./schema.js";

const wrapScalar = (raw, fallback) =>
  raw && typeof raw === "object" && "v" in raw ? raw : scalar(raw ?? fallback);

const stamp = (x) => ({ updatedAt: 0, ...x });

export function migrate(raw) {
  if (!raw || typeof raw !== "object") return null; // caller uses freshDefault()
  // Current or newer: hand the blob back untouched. A newer schema must never be
  // rebuilt by this (older) bundle — the field list below is a whitelist, so it
  // would silently drop every field this version doesn't know about, and
  // pushRemote would then write the stripped copy back to the cloud. v1 data has
  // no schemaVersion at all, and `undefined >= n` is false, so it still migrates.
  if (raw.schemaVersion >= SCHEMA_VERSION) return raw;

  // Back up only the original v1 blob (no schemaVersion). Early-v2 data carries
  // its own _v1backup which we preserve; we don't re-snapshot on v2->v3.
  const fromV1 = !raw.schemaVersion;
  const backup = fromV1
    ? (typeof structuredClone === "function" ? structuredClone(raw) : JSON.parse(JSON.stringify(raw)))
    : raw._v1backup;

  const normalized = {
    // Spread first so anything not listed below survives. Without this, a field
    // added by a future version is dropped on the way through an older bundle.
    ...raw,
    schemaVersion: SCHEMA_VERSION,
    tripName: wrapScalar(raw.tripName, ""),
    startDate: wrapScalar(raw.startDate, ""),
    endDate: wrapScalar(raw.endDate, ""),
    rate: wrapScalar(raw.rate, 0.21),
    budgetJPY: wrapScalar(raw.budgetJPY, 0),
    travelers: (raw.travelers && typeof raw.travelers === "object" && "v" in raw.travelers)
      ? raw.travelers // already a scalar (v4+)
      : scalar(Array.isArray(raw.travelers) && raw.travelers.length ? raw.travelers : [...DEFAULT_TRAVELERS]),
    flights: (raw.flights ?? []).map(stamp),
    days: (raw.days ?? []).map((d) => ({
      ...stamp(d),
      city: wrapScalar(d.city, ""),
      lodging: wrapScalar(d.lodging, ""),
      lodgingMap: wrapScalar(d.lodgingMap, ""),
      items: (d.items ?? []).map((it, i) => ({ order: i, ...stamp(it) })),
    })),
    expenses: (raw.expenses ?? []).map((e) => ({ category: "other", ...stamp(e) })),
    food: (raw.food ?? []).map(stamp),
    shopping: (raw.shopping ?? []).map(stamp),
    packing: (raw.packing ?? []).map(stamp),
    albums: (raw.albums ?? []).map(stamp),
    // v5. Absent on every pre-v5 blob, so this is what seeds the two lists;
    // `stamp` only fills a missing updatedAt, it never rewrites an entry.
    pockets: (raw.pockets ?? []).map(stamp),
    places: (raw.places ?? []).map(stamp),
    ...(backup ? { _v1backup: backup } : {}),
  };
  return normalized;
}
