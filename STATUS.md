# Project status

Updated: 2026-11-16

## Done
- Softer seat map: seats are rounded like small chairs (rounder at the top) with a faint shadow, a bit more space between seats and rows, rounded stairs and aisles, a pill-shaped board and door labels, gentle pastel tones (translucent in dark mode). Seats lift slightly when hovered, your seat has a soft glow, and taken seats are a quiet flat grey. Layout and numbers are unchanged.
- Jupiter seating corrected: it now has the same arrangement as Venus (seat 1 at the audience's right, numbers snaking from row to row, front door on the right), instead of the mirror image it had before. Seat numbers are unchanged, so existing seat marks stay on the same numbers.
- No header bar, title or logo on the home, interactive map and admin pages. Navigation is plain text links in a footer at the bottom of the page: home shows Interactive map and Admin; the map and admin pages link back to Classrooms and the other page. The logo is still used as the browser tab and installed app icon.
- Phone classroom page: the dates and events can be pulled up. Swipe up on the date and events area (or tap the bar under it) to collapse it to one line (date and chosen event) and show the whole classroom; swipe down or tap to bring it back. The choice is remembered on the device.
- Phone events row redesigned: day tiles sized to fit about seven days, and event cards with a colour bar, the time, an Exam/Other tag and the full name (cards widen for long names; the bookmark icon shows only on bookmarked events, the Add to My events button is in the footer).
- Dark mode is now pure black with a light glass touch: a faint blue glow at the top and frosted headers, cards, menus, buttons and popups. Light mode is unchanged and flat.
- Logo: an original mark, a diamond classroom (like the diamond halls on the floor plan) with its seats in rows, white on blue. Used as the browser tab, installed app and home-screen icon (`icons/icon.svg` is the source for the three PNGs). It is not based on the institute's official logo; to use that instead, replace the three PNGs in `icons/`.
- Home screen hides past events by default, in search results ("N past hidden" and a Show past button) and in My events (Show past (n) / Hide past).
- Exams show the seat the person marked: "Seat 12" on exam rows (My events and search), "Your seat: 12" in the classroom footer, and in the "All the best" popup. It reads the seats marked on that device.
- Phones: the classroom page was taller than the visible screen (page-wide `min-height: 100vh` overrode `100dvh`), pushing "Add to My events" off screen; fixed, and the footer now keeps clear of the gesture bar. The date and events area is more compact (about 30% less height) so the seat map gets more room. 
- Installable as an app: web app manifest, icons and a service worker on every page. Chrome shows its own install option (install icon in the address bar on computers; the standard install prompt on Android). There is no custom popup. Pages open offline from the last visit; live data needs a connection.
- "All the best" popup: when someone opens a bookmarked exam from 15 minutes before it starts until it ends (tapping the exam, or opening it from My events), a dancing kitten (transparent background, `icons/cheer-cat.png`; swap in a GIF by changing `CAT_SRC` in `js/cheer.js`) appears with "All the best!" and the exam name and time. Shown once per exam per browser tab session.
- Plain, flat look on every page (no glass, blur, gradients or serif headings). It follows the device setting (light or dark); no theme button.
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
- BSMS 1 has its own academic calendar that was not in the PDFs; it uses the same dates for now (edit the `terms` rows in schedule.sql).
- Aryabhatta has no classes in the timetables.
- Nothing known. After deploying, check /admin, a classroom page and the interactive map in light and dark.
