# Project status

Updated: 2026-11-16

## Done
- Plain, flat look on every page (no glass, blur, gradients or serif headings). It follows the device setting (light or dark); no theme button.
- Simple top menu (Classrooms, Floor plan, Admin) on the home, floor plan and admin pages; home is a plain classroom list with My events below.
- Seat map redrawn as plain numbered boxes: free, marked and yours.
- Phone date bar is one row (back, date, forward, Today) with the day's events scrolling below it.
- Admin calendar styling repaired (the weekly grid lost its day columns in the previous patch). A test now checks every calendar class is styled.
- Admin add-event: a clash now lists the events in the way, and the admin can replace them in one step (co-admins cannot).
- Floor plan is head-on and symmetrical: diamond classrooms mirrored left/right, Aryabhatta centred. A test checks the mirror symmetry.
- Admin calendar: hovering highlights only the half-hour cell a click would add to.
- Admin error names its cause and fix; details go to the Cloudflare logs.
- `supabase/exams-midsem.sql` adds the Varsha 2026 mid-sem exam allocations (19-26 Sep) for Bhaskara, Kaumudi, Jupiter and Venus: 68 exam events, one per hall per slot, courses sharing a hall listed together. It only replaces exam events in that date range. Tested on a local Postgres together with schedule.sql.
- Classroom page: the left of the event row has a date control: previous day, the chosen day and next day as real dates, with arrows. Clicking the middle date opens a month calendar (dots mark days with events); days with no events show a short message.
- `functions/_middleware.js` hides tests, SQL files and notes from the public site.
- `supabase/schedule.sql` loads the Varsha 2026 class timetable (all four years) for Jupiter, Venus, Bhaskara and Kaumudi: 1,500 class events, Mon 27 Jul to Tue 17 Nov 2026. It deletes all existing events first. Tested on a local Postgres with the overlap constraint, run twice. Re-run it only to reset the schedule.

## Open
- BSMS 1 has its own academic calendar that was not in the PDFs; it uses the same dates for now (edit the `terms` rows in schedule.sql).
- Aryabhatta has no classes in the timetables.
- Nothing known. After deploying, check /admin, a classroom page and the floor plan in light and dark.
