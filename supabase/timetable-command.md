# Command: timetable PDF to Supabase SQL

**How to use.** Open any AI chat, paste everything under the line, and attach two files: the timetable PDF and `courses.md`. For a class timetable also attach the academic calendar PDF (or type the first and last teaching day and the days without classes). The AI answers with one SQL script. Paste it into the Supabase SQL editor and run it. To only add events and delete nothing, write ADD ONLY under the command. If Supabase shows an error, paste the error and the SQL back to the AI; the script runs as one transaction, so after an error nothing is half applied.

---

You write SQL for the IISER Thiruvananthapuram Lecture Hall Complex website (Supabase, PostgreSQL). I attached a timetable PDF and `courses.md`, the course reference. Read every page of the PDF; if it is a picture or the text comes out garbled, read it visually. Return ONE SQL script that I paste into the Supabase SQL editor and run as it is.

## 1. What you return

1. One `sql` code block, and nothing before it.
2. After it, **Check before running**, at most 12 lines: how many events per hall, what you skipped and why, and anything doubtful with the way you decided.

Never invent a course, code, faculty, hall, date or time. If something is unreadable or contradictory, leave that row out of the SQL and list it under "Needs a look". Do not ask me questions, with one exception (6.1, missing term dates). When a point is open, take the safest reading and say so in the check list.

## 2. What kind of PDF

- **Exam seating plan**: columns "Course Code / Name of the Faculty / Venue Allocation" under headings such as "Wed, 18 Nov 2026, 09.00 AM to 12.00 PM". It becomes events of type `exam`. Follow section 5 and Template A.
- **Class timetable**: a weekly grid (weekday rows, hourly columns, each cell has course code(s) and a venue in [brackets]). It becomes events of type `class`. Follow section 6 and Template B.
- Anything else: stop and tell me what the PDF is.

The script REPLACES what it covers. If I wrote ADD ONLY, leave out the delete statement (step 3 of Template A, step 2 of Template B).

## 3. The database (do not contradict it)

- Table `public.events`: `room_id` (text), `title` (text, **1 to 80 characters**), `event_type` (`class`, `exam` or `other`), `event_date` (date), `start_time` and `end_time` (time, the end after the start), `professor` (text, up to 80), `description` (up to 200), `created_by` (always `'admin'`).
- The halls on the site, and the only rooms that exist: `lhc-jupiter`, `lhc-venus`, `lhc-bhaskara`, `lhc-kaumudi`, `lhc-aryabhatta`. Every other room in a PDF is skipped.
- Room rules, enforced by the database (a violation aborts the whole script): in one hall a class or `other` event cannot overlap anything. Exams of different courses CAN share a hall at the same time, but an exam can never overlap a class. Back to back is fine (one ends at 11:00, the next starts at 11:00).
- Deleting an exam event also deletes the seat marks students made on it, and deleting any event breaks the bookmarks people made. So never delete everything and insert again: the templates keep events that are already right.
- Only touch `public.events`. Never drop or truncate anything, never delete without the `where` clause shown in the templates, never touch `rooms`, `seat_marks`, `app_settings` or `coadmins`. Write `public.` before every table name.

## 4. What counts as one event (the most important part)

1. **One course in one hall is one event.** A course in two halls is two events (same title, different `room_id`).
2. **Several codes printed together for one course are ONE course**: joined by "/", separated by spaces or commas, or stacked on lines inside one cell or row. It is the same lecture for different programmes or levels (BS-MS, MSc, PhD, i2). Make ONE event; the title is the codes in the printed order joined by " / ", each code as letters, a space, digits: `DSC 323 / MAT 314 / MSM 405`. Plans print codes without a space (`I2M5013`, `EESA417`, `MAT3521`): write `I2M 5013`, `EESA 417`, `MAT 3521`. Keep a trailing letter (`CHY 311B`).
3. **Different rows or cells are different courses, even in the same hall at the same time.** Make separate events. Never merge them, never put two courses in one title, never put a comma between courses. Real example: Jupiter, 23 Nov, 14:00-17:00 holds `HUM 212` and `I2M 411 / MAT 4511`. Those are two courses, so two events.
4. `courses.md` says which codes are one course. Use it only (a) to join codes that the PDF prints apart when they meet in the same hall at the same time (class timetables print one lecture in several year grids, with different codes), and (b) to be sure you never join codes that are not on one line there. Never add a code the PDF does not print. Never join on a similar title, the same teacher, the same hall or the same time. Part 2 of `courses.md` (taken from the 2026 timetables) wins over part 3 (the older catalogues) where they differ.
5. The same code can be different courses in different batches (part 4 of `courses.md`). Never decide what a course is from the code alone.
6. The title holds the codes and nothing else: no hall, no student numbers. The one exception is a session word printed next to the codes in a class cell (Tutorial, Lab, Practical): keep it in brackets after the codes, `MSC 5108 / CHY 5108 (Tutorial)`.

## 5. Exam seating plan: events

1. A heading gives the date and time for every row under it until the next heading (a page break can repeat the heading or hide it; carry it forward). `Wed, 18 Nov 2026, 09.00 AM to 12.00 PM` means 2026-11-18, 09:00 to 12:00. Convert to 24 hours carefully: 12.00 PM = 12:00, 12.00 AM = 00:00, 02.00 PM = 14:00, 11.30 AM = 11:30. The weekday printed must match the date; if not, list it.
2. **One row is one course.** The code cell, faculty cell and venue cell can each wrap over several lines, and the faculty's first line can sit above the line that holds the code. Read by row, not by line. `professor` is the faculty exactly as printed, several names joined by ", " (fix stray spaces such as "Kumar , Dr."), up to 80 characters; `null` if blank.
3. The Venue Allocation is a list of `HALL-number` pairs, for example `KAUMUDI-114, VENUS-41` (the hall and how many students). Make one event per course for each of our halls named: KAUMUDI = `lhc-kaumudi`, VENUS = `lhc-venus`, JUPITER = `lhc-jupiter`, BHASKARA = `lhc-bhaskara`, ARYABHATTA = `lhc-aryabhatta`. Ignore every other hall (PSB..., MSB..., HARISHCHANDRA, MADHAVA and so on) and ignore the numbers. A hall name can wrap over two lines (`JUPITER-` then `8`). A course with none of our halls gets no event.
4. Delete scope: the exam events dated from the first to the last date printed in this PDF, nothing else. A mid-sem plan and an end-sem plan are separate runs. Exam events added by hand inside those dates are replaced.
5. Count check: the number of event rows must equal the number of (course, our hall) pairs in the PDF. Report the count for each hall.

## 6. Class timetable: events

1. **Term dates.** You need the first and last teaching day, the days without classes (holidays, exam weeks, breaks) and any date that follows another weekday's timetable (a Saturday that runs the Friday timetable). They come from the academic calendar PDF or from my message. If you have neither, ask this one question and wait: "What are the first and last teaching day, the days without classes, and any day that follows another weekday's timetable?" If a year follows a different calendar (first year, for example), use one row in `terms` for each calendar and put the same group name on its timetable rows.
2. **Reading the grid.** Rows are weekdays (in the SQL Monday = 1 ... Sunday = 7), columns are time slots written in 12-hour text with odd punctuation: `12:00 -1:00PM`, `1:00-2.00 PM`, `11:00 AM-12:00 PM`. Convert them: 8:00-9:00 AM = 08:00-09:00, 12:00-1:00 PM = 12:00-13:00, 1:00-2:00 PM = 13:00-14:00. A cell is one event for the columns it covers (a cell across two columns is one 2-hour event; two neighbouring cells are two events). "BR", lunch and blank cells give no event.
3. **Venue.** The venue is in [brackets] under the codes. `[LHC Jupiter]`, `[LHC Venus ]` (trailing space), `[LHC Bhaskara]`, `[LHC Kaumudi]`, `[LHC Aryabhatta]` are our halls. Skip everything else: LHC 105, 106, 107 and 108 (also written `TG1: LHC 105`; tutorial rooms), the LHC computer lab, MSB, PSB, CSB and BSB rooms and seminar halls, labs, the central computer centre, SoM and SoC labs. A venue can differ by day: `[LHC Kaumudi (Tue,Fri) / Bhaskara (Thu)]` means Kaumudi on Tuesday and Friday and Bhaskara on Thursday. `[MSB 102/LHC Computer lab]` has no hall of ours.
4. **Codes in a cell** follow section 4. A code can be cut off at the edge of a cell (`I2C413/CHY4103/I2C`): complete it from `courses.md` only when exactly one line there fits, otherwise list it under "Needs a look".
5. The same lecture can be printed in several grids (1st to 4th year, other departments) with different codes, in the same hall at the same time: one event, whose title holds every code printed (the first grid's order, then the new codes). A different course in the same hall at the same time is a clash: list it and leave both out.
6. No events on days without classes and none after the last teaching day.
7. Delete scope: the class events from the first to the last teaching day. Never delete exams or other events. I assume the PDFs I attached are the whole timetable of the term. If a PDF is clearly only one year or one department, say so at the top of the check list and leave out the delete statement (ADD ONLY) unless I told you to replace.

## 7. Mistakes to avoid

- A title over 80 characters aborts the script. Count them.
- An apostrophe inside a text value must be doubled (`O''Brien`).
- Times as `time 'HH:MM'` in 24 hours, dates as `date 'YYYY-MM-DD'`. Take the year from the PDF; a term that runs past 31 December changes year.
- Codes broken over two lines (`DSC 3` and `23`), codes with odd spacing (`PHY322 / MSP422`, `MAT 321/ MSM403 / MAT3521`): join and normalise them as in section 4.
- Hall names in capitals, lower case, with trailing spaces or a prefix (`LHC Venus `): map them to the five ids.
- The same course twice in the same hall and slot is one event.
- Never reorder codes inside a title, never drop one, never add one the PDF does not print.
- No classes on exam days or on the days without classes; an exam may not overlap a class.
- Whole script inside `begin;` ... `commit;`. Every statement ends with a semicolon. No markdown, no `...` and no leftover example row inside the SQL. The example rows in the templates only show the format: replace them all.
- Keep the room-rules block of Template A exactly as written; it is safe to run again and again.
- Do not add columns that the table does not have.

## 8. Check yourself before you answer

1. The number of rows equals the number of course-and-hall pairs (exams) or timetable cells in our halls (classes) in the PDF.
2. No title is longer than 80 characters.
3. No two rows have the same hall, date, start time and title.
4. In every hall and on every date no class overlaps another class, and no exam overlaps a class.
5. The weekday printed for every exam date matches the date.
6. Every code in every title is printed in the PDF; codes of one course are joined by " / " and nothing else joins courses.
7. The delete statement only reaches events of the right type inside the dates of this PDF or term.

## Template A: exam seating plan

Follow this exactly. Replace the example rows with one row per course per hall, and the two dates in step 3 with the first and last date printed in the PDF.

```sql
begin;

-- 1. Room rules: classes and other events need the room to themselves; exams of different courses may share it.
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

-- 2. The exam schedule: one row per course per hall.
create temp table new_exams (room_id text, title text, event_date date, start_time time, end_time time, professor text) on commit drop;
insert into new_exams (room_id, title, event_date, start_time, end_time, professor) values
  ('lhc-jupiter', 'HUM 212', date '2026-11-23', time '14:00', time '17:00', 'Dr. Piyush Parimoo'),
  ('lhc-jupiter', 'I2M 411 / MAT 4511', date '2026-11-23', time '14:00', time '17:00', 'Prof Utpal Manna'),
  ('lhc-venus', 'DSC 323 / MAT 314 / MSM 405', date '2026-11-24', time '09:00', time '12:00', 'Dr Nagaiah Chamakuri');

-- 3. Remove the exam events inside the dates of this PDF that are not in the list above.
delete from public.events e
where e.event_type = 'exam'
  and e.event_date between date '2026-11-23' and date '2026-11-24'   -- first and last date printed in the PDF
  and not exists (select 1 from new_exams n
                  where n.room_id = e.room_id and n.title = e.title and n.event_date = e.event_date
                    and n.start_time = e.start_time and n.end_time = e.end_time);

-- 4. Keep the events that are already right (and their seat marks); only the faculty name may change.
update public.events e set professor = n.professor
from new_exams n
where e.event_type = 'exam' and n.room_id = e.room_id and n.title = e.title and n.event_date = e.event_date
  and n.start_time = e.start_time and n.end_time = e.end_time and e.professor is distinct from n.professor;

-- 5. Add the events that are missing.
insert into public.events (room_id, title, event_type, event_date, start_time, end_time, professor, created_by)
select n.room_id, n.title, 'exam', n.event_date, n.start_time, n.end_time, n.professor, 'admin'
from new_exams n
where not exists (select 1 from public.events e
                  where e.event_type = 'exam' and e.room_id = n.room_id and e.title = n.title and e.event_date = n.event_date
                    and e.start_time = n.start_time and e.end_time = n.end_time);

commit;

-- Check: exam events per hall.
select r.name as hall, count(e.id) as exams
from public.rooms r left join public.events e on e.room_id = r.id and e.event_type = 'exam'
group by r.name order by r.name;
```

## Template B: class timetable

Follow this exactly. Replace every example row and date. `terms`, `no_class` and `follows` come from the calendar, `weekly` from the grid (one row per cell in one of our halls, one row per weekday it applies to). The two dates in step 2 are the first and last teaching day.

```sql
begin;

-- 1. Every class of the term: weekly pattern x teaching days.
create temp table new_classes on commit drop as
with
terms(grp, first_day, last_day) as (values
  ('main', date '2026-07-27', date '2026-11-17')               -- one row per academic calendar that applies
),
no_class(from_day, to_day) as (values
  (date '2026-08-25', date '2026-08-26'),                       -- holidays, exam weeks, breaks (from the calendar)
  (date '2026-09-19', date '2026-09-26')
),
follows(day, dow) as (values                                    -- a date that runs another weekday's timetable (ISO weekday 1 = Mon ... 7 = Sun)
  (date '2026-08-29', 5)
),
weekly(room_id, grp, dow, start_time, end_time, title) as (values   -- one row per timetable cell in a hall
  ('lhc-jupiter', 'main', 1, '08:00', '09:00', 'BIO 327 / MSB 404 / BIO 627'),
  ('lhc-jupiter', 'main', 1, '12:00', '13:00', 'DSC 322'),
  ('lhc-kaumudi', 'main', 4, '16:00', '17:00', 'HUM 412'),
  ('lhc-bhaskara', 'main', 4, '16:00', '17:00', 'HUM 412')
),
days as (
  select g::date as day, coalesce((select f.dow from follows f where f.day = g::date), extract(isodow from g)::int) as dow
  from generate_series(timestamp '2026-07-27', timestamp '2026-11-17', interval '1 day') g   -- first and last teaching day
  where not exists (select 1 from no_class n where g::date between n.from_day and n.to_day)
)
select distinct w.room_id, w.title, d.day as event_date, w.start_time::time as start_time, w.end_time::time as end_time
from days d
join weekly w on w.dow = d.dow
join terms t on t.grp = w.grp and d.day between t.first_day and t.last_day;

-- 2. Remove the classes of the term that are not in the list (leave this statement out in ADD ONLY mode).
delete from public.events e
where e.event_type = 'class'
  and e.event_date between date '2026-07-27' and date '2026-11-17'   -- first and last teaching day
  and not exists (select 1 from new_classes n
                  where n.room_id = e.room_id and n.title = e.title and n.event_date = e.event_date
                    and n.start_time = e.start_time and n.end_time = e.end_time);

-- 3. Add the classes that are missing.
insert into public.events (room_id, title, event_type, event_date, start_time, end_time, created_by)
select n.room_id, n.title, 'class', n.event_date, n.start_time, n.end_time, 'admin'
from new_classes n
where not exists (select 1 from public.events e
                  where e.event_type = 'class' and e.room_id = n.room_id and e.title = n.title and e.event_date = n.event_date
                    and e.start_time = n.start_time and e.end_time = n.end_time);

commit;

-- Check: classes per hall.
select r.name as hall, count(e.id) as classes, min(e.event_date) as first_class, max(e.event_date) as last_class
from public.rooms r left join public.events e on e.room_id = r.id and e.event_type = 'class'
group by r.name order by r.name;
```
