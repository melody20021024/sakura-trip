// v1 -> v2 migration (idempotent). Contract: 03-DesignDocs/backend/
// sync-and-apis.md §5.3. Wraps v1 scalars as { v, updatedAt: 0 }, adds
// updatedAt to every list item, gives day items an explicit order, seeds the
// new packing list, and backs up the raw v1 blob once.
import { SCHEMA_VERSION, scalar } from "./schema.js";

const wrapScalar = (raw, fallback) =>
  raw && typeof raw === "object" && "v" in raw ? raw : scalar(raw ?? fallback);

const stamp = (x) => ({ updatedAt: 0, ...x });

export function migrate(raw) {
  if (!raw || typeof raw !== "object") return null; // caller uses freshDefault()
  if (raw.schemaVersion === SCHEMA_VERSION) return raw; // current, no-op

  // Back up only the original v1 blob (no schemaVersion). Early-v2 data carries
  // its own _v1backup which we preserve; we don't re-snapshot on v2->v3.
  const fromV1 = !raw.schemaVersion;
  const backup = fromV1
    ? (typeof structuredClone === "function" ? structuredClone(raw) : JSON.parse(JSON.stringify(raw)))
    : raw._v1backup;

  const normalized = {
    schemaVersion: SCHEMA_VERSION,
    tripName: wrapScalar(raw.tripName, ""),
    startDate: wrapScalar(raw.startDate, ""),
    endDate: wrapScalar(raw.endDate, ""),
    rate: wrapScalar(raw.rate, 0.21),
    budgetJPY: wrapScalar(raw.budgetJPY, 0),
    travelers: Array.isArray(raw.travelers) && raw.travelers.length ? raw.travelers : ["我"],
    flights: (raw.flights ?? []).map(stamp),
    days: (raw.days ?? []).map((d) => ({
      ...stamp(d),
      city: wrapScalar(d.city, ""),
      lodging: wrapScalar(d.lodging, ""),
      items: (d.items ?? []).map((it, i) => ({ order: i, ...stamp(it) })),
    })),
    expenses: (raw.expenses ?? []).map((e) => ({ category: "other", ...stamp(e) })),
    food: (raw.food ?? []).map(stamp),
    shopping: (raw.shopping ?? []).map(stamp),
    packing: (raw.packing ?? []).map(stamp),
    albums: (raw.albums ?? []).map(stamp),
    ...(backup ? { _v1backup: backup } : {}),
  };
  return normalized;
}
