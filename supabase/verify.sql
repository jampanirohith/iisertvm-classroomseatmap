-- Run after schema.sql and seed.sql to verify the current room/seat setup.
select r.id as room_id,
       r.name,
       r.capacity,
       count(rs.seat_id) as seeded_seats,
       case
         when count(rs.seat_id) = 0 then 'layout not seeded yet'
         when r.capacity = count(rs.seat_id) then 'OK'
         else 'CHECK CAPACITY / SEED'
       end as layout_status
from public.rooms r
left join public.room_seats rs on rs.room_id = r.id
group by r.id, r.name, r.capacity
order by r.name;

-- Expected: Jupiter 112, Venus 112, Bhaskara 252, Kaumudi 228.
select room_id, count(*) as seat_count
from public.room_seats
group by room_id
order by room_id;

-- There should be no rows here: token tables are private and have no public Data API grants.
select grantee, table_schema, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'private'
  and table_name in ('event_owners', 'seat_mark_owners')
  and grantee in ('anon', 'authenticated', 'PUBLIC')
order by table_name, grantee, privilege_type;

-- Must return exactly one row: events_no_overlap_per_room.
select conname, contype
from pg_constraint
where conrelid = 'public.events'::regclass
  and conname = 'events_no_overlap_per_room';
