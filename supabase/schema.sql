-- IISER TVM Lecture Hall Complex: account-free shared events and exam seat marking.
-- Run this entire file in Supabase SQL Editor. Then run seed.sql.
-- Only the publishable key is used in browser code; no service_role key belongs in config.js.

create extension if not exists btree_gist;

-- Private ownership secrets live in a schema that is not exposed through the Supabase Data API.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists public.rooms (
  id text primary key,
  name text not null unique,
  building text not null default 'Lecture Hall Complex',
  capacity integer not null check (capacity > 0),
  created_at timestamptz not null default now()
);

-- Database list of valid numbered seats. It is seeded from the verified layouts in js/data.js.
create table if not exists public.room_seats (
  room_id text not null references public.rooms(id) on delete cascade,
  seat_id text not null check (seat_id ~ '^[0-9]{1,4}$'),
  primary key (room_id, seat_id)
);

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
  check (end_time > start_time),
  check (char_length(btrim(title)) between 1 and 80)
);

-- Additions for projects created with the earlier schema.
alter table public.events add column if not exists event_type text not null default 'other';
alter table public.events add column if not exists professor text;
alter table public.events add column if not exists description text;

create table if not exists private.event_owners (
  event_id uuid primary key references public.events(id) on delete cascade,
  owner_token_hash text not null check (owner_token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);

create table if not exists public.seat_marks (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  seat_id text not null,
  display_name text,
  created_at timestamptz not null default now(),
  unique (event_id, seat_id)
);

create table if not exists private.seat_mark_owners (
  seat_mark_id uuid primary key references public.seat_marks(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  marker_token_hash text not null check (marker_token_hash ~ '^[0-9a-f]{64}$'),
  roll_number text,
  created_at timestamptz not null default now(),
  unique (event_id, marker_token_hash)
);
alter table private.seat_mark_owners add column if not exists roll_number text;
alter table private.seat_mark_owners drop constraint if exists seat_mark_owners_roll_number_length_check;
alter table private.seat_mark_owners add constraint seat_mark_owners_roll_number_length_check
  check (roll_number is null or char_length(btrim(roll_number)) between 1 and 30);
create unique index if not exists seat_mark_owners_unique_roll_per_exam
  on private.seat_mark_owners (event_id, lower(btrim(roll_number)))
  where roll_number is not null and btrim(roll_number) <> '';

-- Upgrade older seat_marks tables without deleting existing records.
alter table public.seat_marks alter column display_name drop not null;
alter table public.seat_marks alter column display_name drop default;

alter table public.seat_marks drop constraint if exists seat_marks_display_name_check;
alter table public.seat_marks drop constraint if exists seat_marks_display_name_length_check;
alter table public.seat_marks add constraint seat_marks_display_name_length_check
  check (display_name is null or char_length(btrim(display_name)) between 1 and 30);
-- display_name may be NULL for roll-number-only marks. The RPC validates that at least
-- one of name/roll is present; roll numbers are stored only in private.seat_mark_owners.
alter table public.seat_marks drop constraint if exists seat_marks_identity_required;
-- Roll numbers are stored in the non-exposed private schema; names are intentionally not unique.

-- Enforce no overlap at the database level. Unlike a UI-only check, this also handles
-- two people creating events at the same time. Endpoints are [start, end), so back-to-back events are allowed.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'events_no_overlap_per_room' and conrelid = 'public.events'::regclass
  ) then
    alter table public.events
      add constraint events_no_overlap_per_room
      exclude using gist (
        room_id with =,
        tsrange(event_date + start_time, event_date + end_time, '[)') with &&
      );
  end if;
end $$;

-- Defense in depth: even if someone later changes frontend code, only valid numbered seats
-- for an OPEN exam can be marked.
create or replace function public.validate_exam_seat_mark()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room_id text;
  v_event_type text;
  v_status text;
begin
  select e.room_id, e.event_type, e.status
    into v_room_id, v_event_type, v_status
    from public.events as e
   where e.id = new.event_id;

  if not found then
    raise exception 'Event was not found.' using errcode = '22023';
  end if;
  if v_event_type <> 'exam' then
    raise exception 'Seat marking is allowed for exam events only.' using errcode = '23514';
  end if;
  if v_status <> 'OPEN' then
    raise exception 'Seat marking is closed for this exam.' using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.room_seats as rs
     where rs.room_id = v_room_id and rs.seat_id = new.seat_id
  ) then
    raise exception 'That seat does not exist in this classroom.' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validate_exam_seat_mark on public.seat_marks;
create trigger trg_validate_exam_seat_mark
before insert or update of event_id, seat_id on public.seat_marks
for each row execute function public.validate_exam_seat_mark();

-- Event creation RPC. A browser sends only a SHA-256 owner-token hash; the hash is never
-- returned to public readers. Event creation is one session only; there is no recurrence API.
create or replace function public.create_event(
  p_room_id text,
  p_title text,
  p_event_type text,
  p_event_date date,
  p_start_time time,
  p_end_time time,
  p_professor text,
  p_description text,
  p_owner_token_hash text
)
returns table (
  id uuid,
  room_id text,
  title text,
  event_type text,
  event_date date,
  start_time time,
  end_time time,
  status text,
  professor text,
  description text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_room_id is null or btrim(p_room_id) = '' then
    raise exception 'Choose a classroom.' using errcode = '22023';
  end if;
  if p_title is null or char_length(btrim(p_title)) not between 1 and 80 then
    raise exception 'Event name must be between 1 and 80 characters.' using errcode = '22023';
  end if;
  if p_event_type not in ('class', 'exam', 'other') then
    raise exception 'Choose a valid event type.' using errcode = '22023';
  end if;
  if p_event_date is null or p_start_time is null or p_end_time is null or p_end_time <= p_start_time then
    raise exception 'Choose a valid date and start/end times. Overnight events are not supported.' using errcode = '22023';
  end if;
  if p_professor is not null and char_length(btrim(p_professor)) > 80 then
    raise exception 'Professor name must be 80 characters or fewer.' using errcode = '22023';
  end if;
  if p_description is not null and char_length(btrim(p_description)) > 200 then
    raise exception 'Event note must be 200 characters or fewer.' using errcode = '22023';
  end if;
  if p_owner_token_hash is null or p_owner_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'A valid event-owner token is required.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.room_seats rs where rs.room_id = p_room_id) then
    raise exception 'This classroom does not have a verified seat layout yet.' using errcode = '22023';
  end if;

  insert into public.events (room_id, title, event_type, event_date, start_time, end_time, professor, description)
  values (p_room_id, btrim(p_title), p_event_type, p_event_date, p_start_time, p_end_time,
          nullif(btrim(coalesce(p_professor, '')), ''), nullif(btrim(coalesce(p_description, '')), ''))
  returning public.events.id into v_id;

  insert into private.event_owners (event_id, owner_token_hash)
  values (v_id, p_owner_token_hash);

  return query
    select e.id, e.room_id, e.title, e.event_type, e.event_date, e.start_time, e.end_time,
           e.status, e.professor, e.description, e.created_at
      from public.events as e where e.id = v_id;
exception
  when exclusion_violation then
    raise exception 'This classroom already has an event that overlaps that time.' using errcode = '23P01';
end;
$$;

-- Only the event creator's browser token can delete that event. Admin deletion will be added
-- separately through server-side admin authorization, not a public bypass in this schema.
create or replace function public.delete_event(p_event_id uuid, p_owner_token_hash text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted boolean := false;
begin
  if p_owner_token_hash is null or p_owner_token_hash !~ '^[0-9a-f]{64}$' then
    return false;
  end if;
  delete from public.events as e
   where e.id = p_event_id
     and exists (select 1 from private.event_owners as eo
                  where eo.event_id = e.id and eo.owner_token_hash = p_owner_token_hash);
  v_deleted := found;
  return v_deleted;
end;
$$;

-- Exam-only seat mark. Unique constraints resolve concurrent duplicate-seat, duplicate-roll,
-- and one-seat-per-browser races safely.
create or replace function public.mark_exam_seat(
  p_event_id uuid,
  p_seat_id text,
  p_display_name text,
  p_roll_number text,
  p_marker_token_hash text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := nullif(btrim(coalesce(p_display_name, '')), '');
  v_roll text := nullif(btrim(coalesce(p_roll_number, '')), '');
  v_mark_id uuid;
begin
  if v_name is null and v_roll is null then
    raise exception 'Enter your name, roll number, or both.' using errcode = '22023';
  end if;
  if v_name is not null and char_length(v_name) > 30 then
    raise exception 'Name must be 30 characters or fewer.' using errcode = '22023';
  end if;
  if v_roll is not null and char_length(v_roll) > 30 then
    raise exception 'Roll number must be 30 characters or fewer.' using errcode = '22023';
  end if;
  if p_marker_token_hash is null or p_marker_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'A valid private seat token is required.' using errcode = '22023';
  end if;

  -- Only an OPEN exam can receive marks; the trigger independently checks event type and seat validity.
  if not exists (select 1 from public.events e where e.id = p_event_id and e.event_type = 'exam' and e.status = 'OPEN') then
    raise exception 'Seat marking is available only for open exam events.' using errcode = '23514';
  end if;

  insert into public.seat_marks (event_id, seat_id, display_name)
  values (p_event_id, btrim(coalesce(p_seat_id, '')), v_name)
  returning id into v_mark_id;

  insert into private.seat_mark_owners (seat_mark_id, event_id, marker_token_hash, roll_number)
  values (v_mark_id, p_event_id, p_marker_token_hash, v_roll);
  return 'ok';
exception
  when unique_violation then
    if exists (select 1 from public.seat_marks sm where sm.event_id = p_event_id and sm.seat_id = p_seat_id) then
      return 'seat_taken';
    end if;
    if v_roll is not null and exists (
      select 1 from private.seat_mark_owners so
       where so.event_id = p_event_id and lower(btrim(so.roll_number)) = lower(v_roll)
    ) then
      return 'roll_taken';
    end if;
    if exists (
      select 1 from private.seat_mark_owners so
       where so.event_id = p_event_id and so.marker_token_hash = p_marker_token_hash
    ) then
      return 'already_marked';
    end if;
    return 'duplicate';
end;
$$;

-- A person can release their own mark and then select another seat, but cannot release another person's mark.
create or replace function public.release_exam_seat(p_event_id uuid, p_marker_token_hash text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted boolean := false;
begin
  if p_marker_token_hash is null or p_marker_token_hash !~ '^[0-9a-f]{64}$' then
    return false;
  end if;
  delete from public.seat_marks as sm
   using private.seat_mark_owners as so
   where sm.id = so.seat_mark_id
     and so.event_id = p_event_id
     and so.marker_token_hash = p_marker_token_hash;
  v_deleted := found;
  return v_deleted;
end;
$$;

-- Lock down the Data API surface. Visitors can read ordinary event and mark fields, but cannot
-- directly insert/delete. Event-owner and seat-owner hashes live in the non-exposed private schema.
revoke all on table public.rooms, public.room_seats, public.events, public.seat_marks from public, anon, authenticated;
revoke all on table private.event_owners, private.seat_mark_owners from public, anon, authenticated;
revoke all on schema private from public, anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on public.rooms, public.room_seats, public.events, public.seat_marks to anon, authenticated;

alter table public.rooms enable row level security;
alter table public.room_seats enable row level security;
alter table public.events enable row level security;
alter table public.seat_marks enable row level security;
alter table private.event_owners enable row level security;
alter table private.seat_mark_owners enable row level security;

drop policy if exists "rooms public read" on public.rooms;
create policy "rooms public read" on public.rooms for select to anon, authenticated using (true);
drop policy if exists "room seats public read" on public.room_seats;
create policy "room seats public read" on public.room_seats for select to anon, authenticated using (true);
drop policy if exists "events public read" on public.events;
drop policy if exists "events public insert" on public.events;
drop policy if exists "events public update" on public.events;
drop policy if exists "events public delete" on public.events;
create policy "events public read" on public.events for select to anon, authenticated using (true);
drop policy if exists "marks public read" on public.seat_marks;
drop policy if exists "marks public insert" on public.seat_marks;
drop policy if exists "marks public update" on public.seat_marks;
drop policy if exists "marks public delete" on public.seat_marks;
create policy "marks public read" on public.seat_marks for select to anon, authenticated using (true);

-- The client needs only execute privileges for these validated write operations.
revoke all on function public.validate_exam_seat_mark() from public, anon, authenticated;
revoke all on function public.create_event(text, text, text, date, time, time, text, text, text) from public, anon, authenticated;
revoke all on function public.delete_event(uuid, text) from public, anon, authenticated;
revoke all on function public.mark_exam_seat(uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.release_exam_seat(uuid, text) from public, anon, authenticated;
grant execute on function public.create_event(text, text, text, date, time, time, text, text, text) to anon, authenticated;
grant execute on function public.delete_event(uuid, text) to anon, authenticated;
grant execute on function public.mark_exam_seat(uuid, text, text, text, text) to anon, authenticated;
grant execute on function public.release_exam_seat(uuid, text) to anon, authenticated;

-- Enable Realtime notifications for the shared event and seat-mark lists.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'seat_marks') then
      alter publication supabase_realtime add table public.seat_marks;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'events') then
      alter publication supabase_realtime add table public.events;
    end if;
  end if;
end $$;
