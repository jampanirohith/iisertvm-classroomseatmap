# Patch: exam reminders, one seat per exam, 3D interactive map, fixes

Copy these files over your repo (same paths), then commit and push.

Delete these old files from the repo if they are still there:
- js/theme.js
- README1.md, README2.md, ideas.txt, PATCH-NOTES.md
- tests/supabase-contract-test.js

Supabase SQL (run in the SQL editor, only when you want them):
- supabase/exams.sql: run this first. It replaces the mid-sem and end-sem exam events (19-26 Sep and 18 Nov - 1 Dec) with 218 events, one per course per hall. Codes joined by "/" in a seating plan are one course ("DSC 323 / MAT 314 / MSM 405"); different courses that share a hall are separate events ("HUM 212" and "I2M 411 / MAT 4511"). It also installs the room rules that let exams share a hall. Classes and other events are not touched; safe to run again.
- supabase/schema.sql: run once more (safe to re-run). It adds the room rules, the rule that a seat can be marked once across exams in the same hall, the refusal of seat marks while the admin has marking turned off, and the new rule that one student (device) can mark only one seat per exam, with the function that lets a student unmark their own seat. Until it has been run the site still works and each browser applies the one-seat rule itself.
- supabase/schedule.sql: only if you want to reset the class timetable (27 Jul to 17 Nov). It no longer deletes everything: it replaces only class events, keeps the ones that are already right and never touches exams.
- supabase/courses.md and supabase/timetable-command.md: the course reference and the prompt for an AI that turns a timetable PDF into SQL (they are not served on the website).

What changed
- Exam reminder: when a student marks a seat, "Notify me 15 minutes before the exam" is ticked by default. The browser shows its own "Allow notifications?" question (no popup of ours). 15 minutes before the exam a notification shows the course, hall, seat and time; tapping it opens the exam. The tick can be switched off and on from the student's own seat box; unmarking cancels the reminder. Nothing is announced when a seat is marked. Reminders are shown while the site is open in the browser or installed app (a closed browser shows nothing).
- One seat per student per exam: tapping another seat shows the seat already marked, with an Unmark seat button to choose again. The database enforces it per device (needs schema.sql).
- Interactive map is now a 3D campus: the LHC, the Physics Block and the Maths Block stand where they do on the satellite view. Drag to turn, tilt, pinch or Ctrl + scroll to zoom; tap a building to pull its floors apart (Ground, First, Second), pick a floor, then tap a hall to open its seating. The LHC first and second floors are drawn from the printed floor plan (Venus and Jupiter on the second floor) and shown flat under the map with clickable halls; the Physics and Maths blocks show their outline on each floor. New file: `js/campus-data.js`.
- Sweep of every page in light and dark at five screen sizes: no console errors or sideways scrolling; fixed the double heading on the home page, a larger tap area for the phone pull-up bar, and the not-found classroom page.
- Classroom page: no event is selected on opening a classroom or changing the day; an event is selected only when tapped (links to a specific event still select it).
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
