-- IISER TVM Lecture Hall Complex: Varsha 2026 class schedule (all four years).
-- Run in the Supabase SQL editor. It DELETES every existing event (and the exam seat marks
-- attached to them), then adds the full semester timetable for the five classrooms.
-- Safe to run again: it always starts by clearing events.
--
-- Source: the 1st-4th year timetables and the Academic Calendar - Varsha 2026.
--   Classes start Mon 27 Jul 2026 and end Tue 17 Nov 2026 (end-sem exams start Wed 18 Nov).
--   No classes: Milad-Un-Nabi (25 Aug), Onam (26 Aug), Gandhi Jayanti (2 Oct),
--               mid-sem exams (19-26 Sep), mid-sem break (17-23 Oct), ITSAV/Anvesha (30 Oct - 1 Nov).
--   Saturdays 29 Aug and 12 Sep follow the Friday timetable.
-- Only the five LHC halls are added (Jupiter, Venus, Bhaskara, Kaumudi, Aryabhatta); tutorial rooms
-- (LHC 105-108), labs and other buildings are not part of this website.
-- BSMS 1 (1st year) is excluded from this calendar and has its own. Edit the 'bsms1' dates below if they differ.

begin;

delete from public.events;

with
terms(grp, first_day, last_day) as (values
  ('main',  date '2026-07-27', date '2026-11-17'),
  ('bsms1', date '2026-07-27', date '2026-11-17')   -- change these two dates for BSMS 1 if needed
),
no_class(from_day, to_day) as (values
  (date '2026-08-25', date '2026-08-26'),  -- Milad-Un-Nabi, Onam
  (date '2026-09-19', date '2026-09-26'),  -- mid-sem exams
  (date '2026-10-02', date '2026-10-02'),  -- Mahatma Gandhi's birthday
  (date '2026-10-17', date '2026-10-23'),  -- mid-sem break
  (date '2026-10-30', date '2026-11-01')   -- ITSAV and Anvesha (non-instructional)
),
friday_timetable(day) as (values (date '2026-08-29'), (date '2026-09-12')),
weekly(room_id, grp, dow, start_time, end_time, title) as (values
  ('lhc-bhaskara', 'bsms1', 1, '09:00', '10:00', 'BIO 111'),
  ('lhc-bhaskara', 'bsms1', 1, '10:00', '11:00', 'PHY 111'),
  ('lhc-bhaskara', 'bsms1', 1, '11:00', '12:00', 'IDC 111'),
  ('lhc-bhaskara', 'bsms1', 1, '12:00', '13:00', 'MAT 111'),
  ('lhc-bhaskara', 'main', 1, '17:00', '18:00', 'DSC 212'),
  ('lhc-bhaskara', 'bsms1', 2, '11:00', '12:00', 'CHY 111'),
  ('lhc-bhaskara', 'main', 2, '15:00', '16:00', 'DSC 211'),
  ('lhc-bhaskara', 'main', 2, '17:00', '18:00', 'DSC 212'),
  ('lhc-bhaskara', 'bsms1', 3, '09:00', '10:00', 'BIO 111'),
  ('lhc-bhaskara', 'bsms1', 3, '10:00', '11:00', 'PHY 111'),
  ('lhc-bhaskara', 'bsms1', 3, '11:00', '12:00', 'IDC 111'),
  ('lhc-bhaskara', 'bsms1', 4, '08:00', '09:00', 'HUM 111'),
  ('lhc-bhaskara', 'bsms1', 4, '11:00', '12:00', 'IDC 111'),
  ('lhc-bhaskara', 'main', 4, '15:00', '16:00', 'DSC 211'),
  ('lhc-bhaskara', 'main', 4, '16:00', '17:00', 'HUM 412'),
  ('lhc-bhaskara', 'main', 4, '17:00', '18:00', 'DSC 212'),
  ('lhc-bhaskara', 'main', 5, '08:00', '09:00', 'HUM 121'),
  ('lhc-bhaskara', 'bsms1', 5, '11:00', '12:00', 'CHY 111'),
  ('lhc-bhaskara', 'bsms1', 5, '12:00', '13:00', 'MAT 111'),
  ('lhc-bhaskara', 'main', 5, '14:00', '15:00', 'DSC 211'),
  ('lhc-jupiter', 'main', 1, '08:00', '09:00', 'BIO 327 / MSB 404 / BIO 627'),
  ('lhc-jupiter', 'main', 1, '10:00', '11:00', 'BIO 322 / MSB 402 / BIO 622'),
  ('lhc-jupiter', 'main', 1, '12:00', '13:00', 'DSC 322'),
  ('lhc-jupiter', 'main', 1, '16:00', '17:00', 'BIO 511 / MSB 501 / BIO 611'),
  ('lhc-jupiter', 'main', 1, '17:00', '18:00', 'BIO 4006 / BIO 6006'),
  ('lhc-jupiter', 'main', 2, '08:00', '09:00', 'BIO 327 / MSB 404 / BIO 627'),
  ('lhc-jupiter', 'main', 2, '10:00', '11:00', 'CHY 5206 / 6206'),
  ('lhc-jupiter', 'main', 2, '12:00', '13:00', 'MAT 304 / MSM 402 / MAT 3504'),
  ('lhc-jupiter', 'main', 2, '14:00', '15:00', 'DSC 323 / MAT 314 / MSM 405'),
  ('lhc-jupiter', 'main', 2, '17:00', '18:00', 'BIO 4006 / BIO 6006'),
  ('lhc-jupiter', 'main', 3, '08:00', '09:00', 'CHY 5206 / 6206'),
  ('lhc-jupiter', 'main', 3, '10:00', '11:00', 'BIO 322 / MSB 402 / BIO 622'),
  ('lhc-jupiter', 'main', 3, '12:00', '13:00', 'DSC 322'),
  ('lhc-jupiter', 'main', 3, '16:00', '17:00', 'BIO 511 / MSB 501 / BIO 611'),
  ('lhc-jupiter', 'main', 3, '17:00', '18:00', 'MAT 304 / MSM 402 / MAT 3504'),
  ('lhc-jupiter', 'main', 4, '08:00', '09:00', 'BIO 327 / MSB 404 / BIO 627'),
  ('lhc-jupiter', 'main', 4, '10:00', '11:00', 'BIO 322 / MSB 402 / BIO 622'),
  ('lhc-jupiter', 'main', 4, '12:00', '13:00', 'DSC 322'),
  ('lhc-jupiter', 'main', 4, '14:00', '15:00', 'DSC 323 / MAT 314 / MSM 405'),
  ('lhc-jupiter', 'main', 4, '16:00', '17:00', 'MSC 5108 / CHY 5108 (SEC/AEC)'),
  ('lhc-jupiter', 'main', 4, '17:00', '18:00', 'BIO 4006 / BIO 6006'),
  ('lhc-jupiter', 'main', 5, '08:00', '09:00', 'CHY 5206 / 6206'),
  ('lhc-jupiter', 'main', 5, '09:00', '10:00', 'DSC 323 / MAT 314 / MSM 405'),
  ('lhc-jupiter', 'main', 5, '10:00', '11:00', 'MSC 5108 / CHY 5108 (Tutorial)'),
  ('lhc-jupiter', 'main', 5, '12:00', '13:00', 'MAT 304 / MSM 402 / MAT 3504'),
  ('lhc-jupiter', 'main', 5, '16:00', '17:00', 'BIO 511 / MSB 501 / BIO 611'),
  ('lhc-kaumudi', 'main', 1, '08:00', '09:00', 'MAT 201'),
  ('lhc-kaumudi', 'main', 1, '09:00', '10:00', 'CHY 212'),
  ('lhc-kaumudi', 'main', 1, '11:00', '12:00', 'HUM 312'),
  ('lhc-kaumudi', 'main', 1, '14:00', '15:00', 'MAT 202'),
  ('lhc-kaumudi', 'main', 1, '15:00', '16:00', 'BIO 211'),
  ('lhc-kaumudi', 'main', 1, '16:00', '17:00', 'PHY 211'),
  ('lhc-kaumudi', 'main', 1, '17:00', '18:00', 'EES 212'),
  ('lhc-kaumudi', 'main', 2, '08:00', '09:00', 'MAT 201'),
  ('lhc-kaumudi', 'main', 2, '09:00', '10:00', 'CHY 211'),
  ('lhc-kaumudi', 'main', 2, '10:00', '11:00', 'PHY 212'),
  ('lhc-kaumudi', 'main', 2, '11:00', '12:00', 'HUM 412'),
  ('lhc-kaumudi', 'main', 2, '14:00', '15:00', 'MAT 202'),
  ('lhc-kaumudi', 'main', 2, '15:00', '16:00', 'EES 211'),
  ('lhc-kaumudi', 'main', 2, '17:00', '18:00', 'EES 212'),
  ('lhc-kaumudi', 'main', 2, '18:00', '19:00', 'MSC 4105 / CHY 4107 / BIO 4031 / EES 4202'),
  ('lhc-kaumudi', 'main', 3, '08:00', '09:00', 'PHY 212'),
  ('lhc-kaumudi', 'main', 3, '09:00', '10:00', 'CHY 212'),
  ('lhc-kaumudi', 'main', 3, '11:00', '12:00', 'HUM 312'),
  ('lhc-kaumudi', 'main', 3, '14:00', '15:00', 'BIO 212'),
  ('lhc-kaumudi', 'main', 3, '15:00', '16:00', 'BIO 211'),
  ('lhc-kaumudi', 'main', 3, '16:00', '17:00', 'PHY 211'),
  ('lhc-kaumudi', 'main', 3, '17:00', '18:00', 'CHY 211'),
  ('lhc-kaumudi', 'main', 4, '08:00', '09:00', 'BIO 211'),
  ('lhc-kaumudi', 'main', 4, '09:00', '10:00', 'CHY 212'),
  ('lhc-kaumudi', 'main', 4, '10:00', '11:00', 'BIO 212'),
  ('lhc-kaumudi', 'main', 4, '11:00', '12:00', 'HUM 312'),
  ('lhc-kaumudi', 'main', 4, '12:00', '13:00', 'PHY 211'),
  ('lhc-kaumudi', 'main', 4, '14:00', '15:00', 'MAT 202'),
  ('lhc-kaumudi', 'main', 4, '15:00', '16:00', 'EES 211'),
  ('lhc-kaumudi', 'main', 4, '16:00', '17:00', 'MAT 201'),
  ('lhc-kaumudi', 'main', 4, '17:00', '18:00', 'EES 212'),
  ('lhc-kaumudi', 'main', 5, '09:00', '10:00', 'BIO 212'),
  ('lhc-kaumudi', 'main', 5, '11:00', '12:00', 'HUM 412'),
  ('lhc-kaumudi', 'main', 5, '14:00', '15:00', 'EES 211'),
  ('lhc-kaumudi', 'main', 5, '15:00', '16:00', 'PHY 212'),
  ('lhc-kaumudi', 'main', 5, '16:00', '17:00', 'CHY 211'),
  ('lhc-kaumudi', 'main', 5, '18:00', '19:00', 'MSC 4105 / CHY 4107 / BIO 4031 / EES 4202'),
  ('lhc-venus', 'main', 1, '08:00', '09:00', 'MAT 321 / MSM 403 / MAT 3521'),
  ('lhc-venus', 'main', 1, '09:00', '10:00', 'BIO 321 / BIO 3005 / MSB 401 / BIO 621'),
  ('lhc-venus', 'main', 1, '14:00', '15:00', 'BIO 5015 / BIO 6015'),
  ('lhc-venus', 'main', 1, '15:00', '16:00', 'I2C 413 / CHY 4103 / I2C 422'),
  ('lhc-venus', 'main', 2, '08:00', '09:00', 'MAT 321 / MSM 403 / MAT 3521'),
  ('lhc-venus', 'main', 2, '10:00', '11:00', 'PHY 5215 / PHY 6215'),
  ('lhc-venus', 'main', 2, '12:00', '13:00', 'BIO 5015 / BIO 6015'),
  ('lhc-venus', 'main', 2, '14:00', '15:00', 'CHY 422 / MSC 506'),
  ('lhc-venus', 'main', 2, '15:00', '16:00', 'PHY 5212 / PHY 6212'),
  ('lhc-venus', 'main', 2, '18:00', '19:00', 'MAT 303 / MSM 401'),
  ('lhc-venus', 'main', 3, '08:00', '09:00', 'PHY 5215 / PHY 6215'),
  ('lhc-venus', 'main', 3, '09:00', '10:00', 'BIO 321 / BIO 3005 / MSB 401 / BIO 621'),
  ('lhc-venus', 'main', 3, '15:00', '16:00', 'I2C 413 / CHY 4103 / I2C 422'),
  ('lhc-venus', 'main', 3, '18:00', '19:00', 'MAT 303 / MSM 401'),
  ('lhc-venus', 'main', 4, '08:00', '09:00', 'MAT 321 / MSM 403 / MAT 3521'),
  ('lhc-venus', 'main', 4, '09:00', '10:00', 'BIO 321 / BIO 3005 / MSB 401 / BIO 621'),
  ('lhc-venus', 'main', 4, '14:00', '15:00', 'CHY 422 / MSC 506'),
  ('lhc-venus', 'main', 4, '15:00', '16:00', 'PHY 5212 / PHY 6212'),
  ('lhc-venus', 'main', 5, '08:00', '09:00', 'PHY 5215 / PHY 6215'),
  ('lhc-venus', 'main', 5, '09:00', '10:00', 'CHY 422 / MSC 506'),
  ('lhc-venus', 'main', 5, '10:00', '11:00', 'PHY 5212 / PHY 6212'),
  ('lhc-venus', 'main', 5, '12:00', '13:00', 'BIO 5015 / BIO 6015'),
  ('lhc-venus', 'main', 5, '15:00', '16:00', 'I2C 413 / CHY 4103 / I2C 422'),
  ('lhc-venus', 'main', 5, '18:00', '19:00', 'MAT 303 / MSM 401')
),
days as (
  select g::date as day,
         case when g::date in (select day from friday_timetable) then 5 else extract(isodow from g)::int end as dow
  from generate_series(timestamp '2026-07-27', timestamp '2026-11-17', interval '1 day') g
  where not exists (select 1 from no_class n where g::date between n.from_day and n.to_day)
)
insert into public.events (room_id, title, event_type, event_date, start_time, end_time, created_by)
select w.room_id, w.title, 'class', d.day, w.start_time::time, w.end_time::time, 'admin'
from days d
join weekly w on w.dow = d.dow
join terms t on t.grp = w.grp and d.day between t.first_day and t.last_day;

commit;

-- Check: events per classroom.
select r.name as classroom, count(e.id) as events, min(e.event_date) as first_class, max(e.event_date) as last_class
from public.rooms r left join public.events e on e.room_id = r.id
group by r.name order by r.name;
