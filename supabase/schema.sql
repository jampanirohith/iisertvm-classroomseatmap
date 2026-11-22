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

-- One seat per student per exam. The browser sends a random code that stays on the student's device in owner_token.
-- The trigger below turns it into a one-way fingerprint (owner_hash, different for every exam) and clears owner_token,
-- so the database can see that the same device already marked a seat without ever storing who anyone is.
alter table public.seat_marks add column if not exists owner_token text;
alter table public.seat_marks add column if not exists owner_hash text;
create index if not exists seat_marks_owner_idx on public.seat_marks (event_id, owner_hash) where owner_hash is not null;
-- Lets live updates say which exam a removed seat mark belonged to.
alter table public.seat_marks replica identity full;

alter table public.events add column if not exists event_type text not null default 'other';
alter table public.events add column if not exists professor text;
alter table public.events add column if not exists description text;
-- 'admin', a co-admin's email, or 'public' (when anyone may add events). Co-admins can delete only their own events.
alter table public.events add column if not exists created_by text;

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

-- Seat marks are for exams only. The browser already enforces this; the database now does too.
create or replace function public.seat_marks_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.events e where e.id = new.event_id and e.event_type = 'exam') then
    raise exception 'Seats can only be marked for exams' using errcode = '22023';
  end if;
  -- The admin can turn seat marking off (Settings tab on the admin page).
  if exists (select 1 from public.app_settings s where s.key = 'seat_marking' and s.value = 'off') then
    raise exception 'Seat marking is turned off' using errcode = '22023';
  end if;
  -- Each student device may mark one seat per exam (marks made before this rule have no fingerprint and are left alone).
  new.owner_hash := null;
  if new.owner_token is not null and btrim(new.owner_token) <> '' then
    if length(new.owner_token) < 16 then
      raise exception 'Invalid device code' using errcode = '22023';
    end if;
    new.owner_hash := encode(sha256(convert_to(new.owner_token || ':' || new.event_id::text, 'UTF8')), 'hex');
    perform pg_advisory_xact_lock(hashtextextended('owner:' || new.owner_hash, 0));
    if exists (select 1 from public.seat_marks m where m.event_id = new.event_id and m.owner_hash = new.owner_hash) then
      raise exception 'You have already marked a seat for this exam' using errcode = '23514';
    end if;
  end if;
  new.owner_token := null;
  -- Exams of different courses can share a hall at the same time, so they share its seats: one mark per seat.
  perform pg_advisory_xact_lock(hashtextextended('seat:' || (select e.room_id || ':' || e.event_date from public.events e where e.id = new.event_id) || ':' || new.seat_id, 0));
  if exists (
    select 1
    from public.events me
    join public.events other on other.room_id = me.room_id and other.id <> me.id and other.event_type = 'exam'
      and other.event_date = me.event_date and other.start_time < me.end_time and other.end_time > me.start_time
    join public.seat_marks m on m.event_id = other.id and m.seat_id = new.seat_id
    where me.id = new.event_id
  ) then
    raise exception 'That seat is already marked for another exam in this hall' using errcode = '23505';
  end if;
  new.display_name := left(btrim(new.display_name), 30);
  return new;
end $$;
drop trigger if exists seat_marks_guard on public.seat_marks;
create trigger seat_marks_guard before insert on public.seat_marks for each row execute function public.seat_marks_guard();

-- A student can unmark their own seat (to pick another one): only the device that marked it can remove it.
-- Returns true when a seat mark was removed. Refused while the admin has seat marking turned off.
create or replace function public.release_seat(p_event uuid, p_seat text, p_token text) returns boolean
language plpgsql security definer set search_path = public as $$
declare removed integer;
begin
  if exists (select 1 from public.app_settings s where s.key = 'seat_marking' and s.value = 'off') then
    raise exception 'Seat marking is turned off' using errcode = '22023';
  end if;
  if p_token is null or length(p_token) < 16 then return false; end if;
  delete from public.seat_marks m
   where m.event_id = p_event and m.seat_id = p_seat
     and m.owner_hash = encode(sha256(convert_to(p_token || ':' || p_event::text, 'UTF8')), 'hex');
  get diagnostics removed = row_count;
  return removed > 0;
end $$;
revoke all on function public.release_seat(uuid, text, text) from public;
grant execute on function public.release_seat(uuid, text, text) to anon, authenticated;

-- Classes and other events need their classroom to themselves: two of them can never overlap, even if two people save at the
-- same moment, and an exam cannot overlap them either. Exams of different courses may share a hall at the same time (they
-- share its seats). Back-to-back events (10:00-11:00 and 11:00-12:00) are allowed.
-- Skipped with a notice if old data already breaks a rule. Safe to run again.
create extension if not exists btree_gist;
alter table public.events drop constraint if exists events_no_overlap_per_room;
alter table public.events drop constraint if exists events_exam_apart_from_others;
do $$
begin
  alter table public.events add constraint events_no_overlap_per_room
    exclude using gist (room_id with =, tsrange(event_date + start_time, event_date + end_time, '[)') with &&)
    where (event_type <> 'exam');
exception
  when duplicate_object then null;
  when others then raise notice 'events_no_overlap_per_room was not added: %', sqlerrm;
end $$;
do $$
begin
  alter table public.events add constraint events_exam_apart_from_others
    exclude using gist (room_id with =, tsrange(event_date + start_time, event_date + end_time, '[)') with &&,
                        (case when event_type = 'exam' then 1 else 0 end) with <>);
exception
  when duplicate_object then null;
  when others then raise notice 'events_exam_apart_from_others was not added: %', sqlerrm;
end $$;

-- Admin settings and co-admin accounts. Only the Cloudflare admin functions (secret key) can touch these:
-- no policies and no grants for the browser roles.
-- key 'who_can_add' holds 'admin' (default), 'coadmin' or 'anyone'.
-- key 'seat_marking' holds 'on' (default) or 'off'; key 'seat_names' holds 'everyone' (default) or 'self'.
create table if not exists public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
create table if not exists public.coadmins (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email)),
  password_hash text not null,
  created_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
alter table public.coadmins enable row level security;
revoke all on table public.app_settings from public, anon, authenticated;
revoke all on table public.coadmins from public, anon, authenticated;
