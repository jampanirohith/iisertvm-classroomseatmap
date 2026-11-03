# Patch: device-default theme, new floor plan, calendar hover, clearer errors

1. Unzip over your project folder (overwrite when asked).
2. Delete these old files from the repo:
   - js/theme.js
   - README1.md
   - README2.md
   - ideas.txt
   - PATCH-NOTES.md
   - tests/supabase-contract-test.js
   - PATCH-README.md (this file, once applied)
3. Commit and push; Cloudflare Pages redeploys. No new variables or SQL.

## Class schedule
Run `supabase/schedule.sql` in the Supabase SQL editor. It deletes every event and adds the timetable (27 Jul to 17 Nov 2026).
