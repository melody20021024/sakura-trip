-- 櫻旅 Sakura Trip — Supabase schema
--
-- v2 note: the TABLE structure is intentionally UNCHANGED from v1 (no DDL
-- migration, to minimise risk). Only the shape of `data` (jsonb) is upgraded
-- to a mergeable model so multiple devices can co-edit without overwriting
-- each other. See 03-DesignDocs/backend/sync-and-apis.md §4.2 / §5.2.
--
--   id    : trip key. v2 generates a 22-char strong key (crypto), but v1's
--           short 8-char keys remain valid and readable.
--   data  : v2 jsonb. Every mutable scalar is { v, updatedAt } and every list
--           item carries { id, updatedAt, _deleted? } so merges are field-level
--           last-write-wins with tombstones (see merge.js / migrate.js).
--   writer: clientId of the last writer, used to skip echoing our own realtime.
--
-- v3 note (口袋地點): again NO DDL. The table is untouched; only `data` gains
-- two more id-keyed lists, which the existing mergeList / tombstone / realtime
-- / CAS machinery already handles. A separate table would have needed a second
-- Dexie store, a second realtime channel and its own merge, for ~40KB of text.
-- See 03-DesignDocs/backend/parse-and-schema-v3.md §4.
--
--   data.pockets[] : one saved post.
--                    { id, title, sourceUrl, platform, summary,
--                      rawText, pending, createdAt, updatedAt, _deleted? }
--                    rawText/pending back F-78: offline, the raw link and text
--                    are parked here and re-parsed once back online.
--   data.places[]  : one extracted place.
--                    { id, pocketId, name, nameJa, category, area, note,
--                      lat, lng, geoSource, photoUrl, order,
--                      updatedAt, _deleted? }
--                    category uses the same enum as days[].items[].type, so a
--                    place drops into the itinerary with no mapping table.
--                    lat/lng/geoSource stay empty in v3 -- reserved for the
--                    Phase 1.5 map; photoUrl is a URL string, never image
--                    bytes (the jsonb has a 1MB cap).
--   data.days[].items[].placeId : set when a place was added to a day. There is
--                    deliberately no place.usedIn: the badge is derived by
--                    reverse lookup, so one shop can sit in several days and two
--                    people scheduling it to different days can't clobber each
--                    other (mergeList is whole-record LWW, not field-level).
--
-- Phase 1.5 will add a geo_cache table for geocoding results. It is NOT created
-- here on purpose -- it is not part of the MVP, and it is trip-independent
-- (shared cache, no merge semantics), so it does not belong in `data`.
--
create table if not exists trips (
  id text primary key,
  data jsonb not null default '{}',
  writer text,
  updated_at timestamptz default now()
);

-- Access model (v2): still anonymous; the 22-char strong key IS the access
-- boundary. Tightening (PIN / Edge Function rate-limit) is deferred to Phase 2.
alter table trips enable row level security;

create policy "anon all access" on trips
  for all using (true) with check (true);

alter publication supabase_realtime add table trips;
