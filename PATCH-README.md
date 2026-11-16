# Patch: plain redesign, admin fixes, schedule SQL

Copy these files over your repo (same paths), then commit and push.

Delete these old files from the repo if they are still there:
- js/theme.js
- README1.md, README2.md, ideas.txt, PATCH-NOTES.md
- tests/supabase-contract-test.js

Supabase SQL (run in the SQL editor, only when you want them):
- supabase/schedule.sql: replaces ALL events with the Varsha 2026 class timetable (27 Jul to 17 Nov).
- supabase/exams-midsem.sql: adds the mid-sem exam halls (19-26 Sep). Run it after schedule.sql.

What changed
- Plain, flat look; simple top menu; plain seat map; one-row date bar on phones.
- Admin weekly calendar styling repaired; adding an event that clashes now lists the clash and lets the admin replace it.
