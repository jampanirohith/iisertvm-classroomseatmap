# Project status

Updated: 2026-11-16

## Done
- Plain, flat look on every page (no glass, blur, gradients or serif headings). It follows the device setting (light or dark); no theme button.
- Simple top menu (Classrooms, Interactive map, Admin) on the home, map and admin pages; home is a plain classroom list with My events below.
- Seat map redrawn as plain numbered boxes: free, marked and yours.
- Home page: a search box for classes and exams (course code with or without a space, hall, teacher, date such as "25 Nov", or today/tomorrow), with All/Classes/Exams filters. Below it: the classrooms (with today's count) and My events.
- Phone room page: month name plus a scrolling strip of day tiles (weekday, date, dot where events exist) with Today; replaces the old date row. The seat map opens at a readable size instead of the whole room; the fit button toggles whole room / readable.
- Event names are shown in full (they wrap) in the event row, event details and lists.
- Admin calendar styling repaired (the weekly grid lost its day columns in the previous patch). A test now checks every calendar class is styled.
- Admin add-event: a clash now lists the events in the way, and the admin can replace them in one step (co-admins cannot).
- Interactive map (renamed from Floor plan) always uses the default light colours, even when the device is in dark mode. It is head-on and symmetrical: diamond classrooms mirrored left/right, Aryabhatta centred. A test checks the mirror symmetry.
- Admin calendar: hovering highlights only the half-hour cell a click would add to.
- Admin error names its cause and fix; details go to the Cloudflare logs.
- `supabase/exams.sql` loads both exam schedules for Bhaskara, Kaumudi, Jupiter and Venus: mid-sem (19-26 Sep) and end-sem (18 Nov - 1 Dec), 141 events. It first deletes all exam events in those two date ranges (so earlier exam scripts are replaced), then adds them with plain titles: just the course code, courses sharing a hall listed together; the professor shows only when one course has the hall to itself. Tested on a local Postgres with schedule.sql, run twice; classes and other events are untouched.
- Classroom page: the left of the event row has a date control: previous day, the chosen day and next day as real dates, with arrows. Clicking the middle date opens a month calendar (dots mark days with events); days with no events show a short message.
- `functions/_middleware.js` hides tests, SQL files and notes from the public site.
- `supabase/schedule.sql` loads the Varsha 2026 class timetable (all four years) for Jupiter, Venus, Bhaskara and Kaumudi: 1,500 class events, Mon 27 Jul to Tue 17 Nov 2026. It deletes all existing events first. Tested on a local Postgres with the overlap constraint, run twice. Re-run it only to reset the schedule.

## Open
- BSMS 1 has its own academic calendar that was not in the PDFs; it uses the same dates for now (edit the `terms` rows in schedule.sql).
- Aryabhatta has no classes in the timetables.
- Nothing known. After deploying, check /admin, a classroom page and the interactive map in light and dark.
