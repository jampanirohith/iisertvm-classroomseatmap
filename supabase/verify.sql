-- Run after schema.sql and seed.sql.

-- 1. Five classrooms.
select id, name, capacity from public.rooms order by name;

-- 2. Must return exactly these rows: events_no_overlap_per_room (if missing, existing events overlap; fix them and run schema.sql again).
select conname, contype from pg_constraint
where conrelid = 'public.events'::regclass and conname = 'events_no_overlap_per_room';

-- 3. Must return no rows: browser roles have no access to settings or co-admin accounts.
select grantee, table_name, privilege_type from information_schema.role_table_grants
where table_schema = 'public' and table_name in ('app_settings', 'coadmins') and grantee in ('anon', 'authenticated', 'PUBLIC');

-- 4. Must return no rows: browser roles cannot write events directly.
select grantee, privilege_type from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'events' and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
  and grantee in ('anon', 'authenticated', 'PUBLIC');

-- 5. The setting row appears after the admin first saves it on the admin page.
select * from public.app_settings;
