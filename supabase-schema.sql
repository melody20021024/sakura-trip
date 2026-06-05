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
