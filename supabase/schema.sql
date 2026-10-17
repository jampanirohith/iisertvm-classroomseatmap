-- IISER TVM Lecture Hall Complex: events and exam seat marks.
-- Run in the Supabase SQL editor, then run seed.sql. Browser code must only use the publishable (anon) key.
create extension if not exists pgcrypto;

create table if not exists public.rooms (
  id text primary key,
  name text not null unique,
  building text not null default 'Lecture Hall Complex',
  capacity integer not null check (capacity > 0),
  created_at timestamptz not null default now()
);

-- Seating arrangements now live in js/data.js. Any legacy layout column is intentionally left untouched.

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  room_id text not null references public.rooms(id) on delete cascade,
  title text not null,
  event_type text not null default 'other' check (event_type in ('class', 'exam', 'other')),
  event_date date not null,
  start_time time not null,
  end_time time not null,
  status text not null default 'OPEN' check (status in ('OPEN', 'CLOSED')),
  professor text,
  description text,
  created_at timestamptz not null default now(),
  check (end_time > start_time)
);

-- One row per marked exam seat. seat_id is the seat number, for example '160'.
create table if not exists public.seat_marks (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  seat_id text not null,
  display_name text not null default 'Student' check (char_length(display_name) between 1 and 30),
  created_at timestamptz not null default now(),
  unique (event_id, seat_id)
);

alter table public.events add column if not exists event_type text not null default 'other';
alter table public.events add column if not exists professor text;
alter table public.events add column if not exists description text;

alter table public.rooms enable row level security;
alter table public.events enable row level security;
alter table public.seat_marks enable row level security;

drop policy if exists "rooms public read" on public.rooms;
create policy "rooms public read" on public.rooms for select to anon, authenticated using (true);
drop policy if exists "events public read" on public.events;
create policy "events public read" on public.events for select to anon, authenticated using (true);
-- Event creation and deletion go through the authenticated Cloudflare Pages admin functions.
-- Do not allow browser clients using the publishable key to create, update or delete events.
drop policy if exists "events public insert" on public.events;
drop policy if exists "events public update" on public.events;
drop policy if exists "events public delete" on public.events;
revoke insert, update, delete on table public.events from public, anon, authenticated;
grant select on table public.events to anon, authenticated;
drop policy if exists "marks public read" on public.seat_marks;
create policy "marks public read" on public.seat_marks for select to anon, authenticated using (true);
drop policy if exists "marks public insert" on public.seat_marks;
create policy "marks public insert" on public.seat_marks for insert to anon, authenticated with check (true);
revoke update, delete on table public.seat_marks from public, anon, authenticated;
grant select, insert on table public.seat_marks to anon, authenticated;
revoke all on table public.rooms from public, anon, authenticated;
grant select on table public.rooms to anon, authenticated;

-- Live updates for events and seat marks.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'seat_marks') then
    alter publication supabase_realtime add table public.seat_marks;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'events') then
    alter publication supabase_realtime add table public.events;
  end if;
end $$;
