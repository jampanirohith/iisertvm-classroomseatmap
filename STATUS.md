# Project status

Updated: 2026-11-16

## Done
- Home screen hides past events by default, in search results ("N past hidden" and a Show past button) and in My events (Show past (n) / Hide past).
- Exams show the seat the person marked: "Seat 12" on exam rows (My events and search), "Your seat: 12" in the classroom footer, and in the "All the best" popup. It reads the seats marked on that device.
- Phones: the classroom page was taller than the visible screen (page-wide `min-height: 100vh` overrode `100dvh`), pushing "Add to My events" off screen; fixed, and the footer now keeps clear of the gesture bar. The date and events area is more compact (about 30% less height) so the seat map gets more room. The home header shows the app icon with the name, and the menu is a tab row with an underline on the current page.
- Installable as an app: web app manifest, icons and a service worker on every page. Chrome shows its own install option (install icon in the address bar on computers; the standard install prompt on Android). There is no custom popup. Pages open offline from the last visit; live data needs a connection.
- "All the best" popup: when someone opens a bookmarked exam from 15 minutes before it starts until it ends (tapping the exam, or opening it from My events), a dancing kitten (transparent background, `icons/cheer-cat.png`; swap in a GIF by changing `CAT_SRC` in `js/cheer.js`) appears with "All the best!" and the exam name and time. Shown once per exam per browser tab session.
- Plain, flat look on every page (no glass, blur, gradients or serif headings). It follows the device setting (light or dark); no theme button.
- Simple top menu (Classrooms, Interactive map, Admin) on the home, map and admin pages; home is a plain classroom list with My events below.
- Seat map redrawn as plain numbered boxes: free, marked and yours.
- Home page: a search box for classes and exams (course code with or without a space, hall, teacher, date such as "25 Nov", or today/tomorrow), with All/Classes/Exams filters. Below it: the classrooms (with today's count) and My events.
- Phone room page: month name plus a scrolling strip of day tiles (weekday, date, dot where events exist) with Today; replaces the old date row. The seat map opens at a readable size instead of the whole room; the fit button toggles whole room / readable.
- Event names are shown in full (they wrap) in the event row, event details and lists.
- Admin calendar styling repaired (the weekly grid lost its day columns in the previous patch). A test now checks every calendar class is styled.
- Admin add-event: a clash now lists the events in the way, and the admin can replace them in one step (co-admins cannot).
- Interactive map (renamed from Floor plan): only the map uses the colours of the printed floor plan (pale yellow Jupiter/Venus, pink-beige Bhaskara/Kaumudi, mauve Aryabhatta, green wash rooms, red lifts, white corridors), in light and dark mode; the rest of the page follows the device theme. It is head-on and symmetrical: diamond classrooms mirrored left/right, Aryabhatta centred. A test checks the mirror symmetry.
- Admin calendar: hovering highlights only the half-hour cell a click would add to.
- Admin error names its cause and fix; details go to the Cloudflare logs.
- `supabase/exams.sql` loads both exam schedules for Bhaskara, Kaumudi, Jupiter and Venus: mid-sem (19-26 Sep) and end-sem (18 Nov - 1 Dec), 141 events. It first deletes all exam events in those two date ranges (so earlier exam scripts are replaced), then adds them with plain titles: just the course code, courses sharing a hall listed together; the professor shows only when one course has the hall to itself. Tested on a local Postgres with schedule.sql, run twice; classes and other events are untouched.
- Classroom page: the left of the event row has a date control: previous day, the chosen day and next day as real dates, with arrows. Clicking the middle date opens a month calendar (dots mark days with events); days with no events show a short message.
- `functions/_middleware.js` hides tests, SQL files and notes from the public site.
- `supabase/schedule.sql` loads the Varsha 2026 class timetable (all four years) for Jupiter, Venus, Bhaskara and Kaumudi: 1,500 class events, Mon 27 Jul to Tue 17 Nov 2026. It deletes all existing events first. Tested on a local Postgres with the overlap constraint, run twice. Re-run it only to reset the schedule.

## Open
- Logo: the app icon is a simple original mark (board and seats). The official IISER TVM logo was not copied; to use it, replace `icons/icon-192.png`, `icons/icon-512.png` and `icons/apple-touch-icon.png` with files made from the official artwork.
- BSMS 1 has its own academic calendar that was not in the PDFs; it uses the same dates for now (edit the `terms` rows in schedule.sql).
- Aryabhatta has no classes in the timetables.
- Nothing known. After deploying, check /admin, a classroom page and the interactive map in light and dark.
