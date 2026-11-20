# Patch: plain redesign, admin fixes, schedule SQL

Copy these files over your repo (same paths), then commit and push.

Delete these old files from the repo if they are still there:
- js/theme.js
- README1.md, README2.md, ideas.txt, PATCH-NOTES.md
- tests/supabase-contract-test.js

Supabase SQL (run in the SQL editor, only when you want them):
- supabase/exams.sql: run this first. It replaces the mid-sem and end-sem exam events (19-26 Sep and 18 Nov - 1 Dec) with 218 events, one per course per hall. Codes joined by "/" in a seating plan are one course ("DSC 323 / MAT 314 / MSM 405"); different courses that share a hall are separate events ("HUM 212" and "I2M 411 / MAT 4511"). It also installs the room rules that let exams share a hall. Classes and other events are not touched; safe to run again.
- supabase/schema.sql: run once more (safe to re-run). It adds the room rules, the rule that a seat can be marked once across exams in the same hall, and the refusal of seat marks while the admin has marking turned off.
- supabase/schedule.sql: only if you want to reset the class timetable (27 Jul to 17 Nov). It no longer deletes everything: it replaces only class events, keeps the ones that are already right and never touches exams.
- supabase/courses.md and supabase/timetable-command.md: the course reference and the prompt for an AI that turns a timetable PDF into SQL (they are not served on the website).

What changed
- Two exams of different courses can share a hall at the same time: the admin accepts it, the week view shows them side by side, and they share one seat map (a seat marked for one is taken for the other; tapping it says who marked it and for which course).
- Plain, flat look; plain seat map; no header bar (links to Interactive map and Admin sit in a plain-text footer).
- Home: search for classes and exams; today's count per classroom.
- Phones: classroom page is less crowded and smaller in text; calendar button at the top right of the classroom name bar (replaces the month row), arrows at both ends of the day strip. The seat map still opens at a readable size (fit button or pulling the events bar up shows the whole room).
- Install as an app (Chrome's default install prompt) and offline fallback pages.
- Bookmarked exam opened 15 minutes before it starts: "All the best!" popup with the dancing kitten (transparent background).
- Phones: Add to My events no longer falls below the screen; date and events area more compact.
- Home hides past events by default (Show past button); exams show your marked seat in lists, the classroom footer and the popup.
- "Floor plan" is now "Interactive map"; the map uses the colours of the printed floor plan while the rest of the page follows the device theme.
- New logo (diamond classroom with seats) for the browser tab and installed app.
- Phones: pull-up dates/events bar (swipe or tap) to see the whole classroom; events row redesigned.
- Dark mode: pure black with a light glass touch.
- Jupiter seating corrected (seat 1 at the audience's right, front door on the right, same as Venus).
- Softer seat map: rounded chair-shaped seats, light shadows, rounded stairs, pill board and doors, gentle hover.
- Exams: tap a marked seat to see who marked it.
- Admin Settings: turn exam seat marking on or off, and choose who sees the name on a marked seat (everyone, or only the person who marked it).
- Full event names everywhere (no cut-off text).
- Admin weekly calendar styling repaired; adding an event that clashes now lists the clash and lets the admin replace it.
