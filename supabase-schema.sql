create table if not exists trips (
  id text primary key,
  data jsonb not null default '{}',
  writer text,
  updated_at timestamptz default now()
);

alter table trips enable row level security;

create policy "anon all access" on trips
  for all using (true) with check (true);

alter publication supabase_realtime add table trips;
