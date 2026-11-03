# Project status

Updated: 2026-11-03

## Done
- Obsidian glass look on every page. It follows the device setting (light by day, dark obsidian on dark devices); no theme button.
- Floor plan redrawn head-on and symmetrical: large diamond classrooms mirrored left/right, Aryabhatta centred, lobby, lifts, stairs and washrooms mirrored. A test now checks the mirror symmetry.
- Admin calendar: hovering highlights only the half-hour cell a click would add to.
- Admin error names its cause and fix; details go to the Cloudflare logs.
- Classroom page: the left of the event row has a date control: previous day, the chosen day and next day as real dates, with arrows. Clicking the middle date opens a month calendar (dots mark days with events); days with no events show a short message.
- `functions/_middleware.js` hides tests, SQL files and notes from the public site.
- `supabase/schedule.sql` loads the Varsha 2026 class timetable (all four years) for Jupiter, Venus, Bhaskara and Kaumudi: 1,500 class events, Mon 27 Jul to Tue 17 Nov 2026. It deletes all existing events first. Tested on a local Postgres with the overlap constraint, run twice. Re-run it only to reset the schedule.

## Open
- BSMS 1 has its own academic calendar that was not in the PDFs; it uses the same dates for now (edit the `terms` rows in schedule.sql).
- Aryabhatta has no classes in the timetables.
- Nothing known. After deploying, check /admin, a classroom page and the floor plan in light and dark.
