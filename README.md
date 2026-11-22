# IISER TVM - Lecture Hall Complex seat map

Open a classroom to see its seating arrangement, browse its events by date, bookmark the ones you care about, and mark your seat for exams.

## Pages

| Page | What it does |
| --- | --- |
| `index.html` | Search, the classroom list, **My events** and footer links (Interactive map, Admin) |
| `room.html?room=lhc-kaumudi` | Seat map, one-date-at-a-time event column, bookmarks, exam seat marking |
| `manifest.webmanifest`, `sw.js`, `icons/`, `js/pwa.js` | Install-as-app files (Chrome's own install prompt) |
| `icons/icon-*.png` | Logo: diamond classroom with seats; used as tab, install and home-screen icon (`icon.svg` is the source) |
| `js/room.js` | Classroom page (phones: pull-up dates and events bar; no event is selected until tapped) |
| `js/cheer.js`, `icons/cheer-cat.png` | "All the best" popup (dancing kitten) for a bookmarked exam from 15 minutes before it starts |
| `js/notify.js` | Exam reminders: a notification 15 minutes before an exam in which the student marked a seat |
| `interactive-map.html`, `js/map.js`, `js/campus-data.js` | Interactive 3D map of the LHC, Physics Block and Maths Block placed as on the satellite view; tap a building to pull its floors apart, tap a hall to open its seating; flat floor plan underneath |
| `admin.html` | Weekly schedule for each classroom: add, edit, reschedule, delete; settings and co-admins (admin only) |

## For students

- **Date bar.** Left of the events: yesterday, the chosen day and tomorrow as real dates, with arrows. Tap the middle date for a calendar (dots mark days with events). On phones the date bar is a strip of day tiles with an arrow at each end to step one day; the calendar button at the top right of the page opens the month calendar, with Today beside it. The events for that day are listed beside it, or below it on phones. Event names are shown in full.
- **Bookmarks.** Tap the bookmark on an event, or **Add to My events** under the map. Bookmarks are saved on that device only (browser storage), so they are private and do not follow you to another phone.
- **My events** (homepage) has two columns: **Classes**, shown one date at a time (pick the date), and **Exams**, all in one list. Anything else you bookmark appears under **Other**.
- **Home search.** Search classes and exams by course code (with or without a space), hall, teacher or date ("25 Nov", today, tomorrow), with All/Classes/Exams filters. Without a search the home page shows the classrooms (with today's count) and My events.
- **Seat map.** On computers the whole classroom is in view when the page opens. On phones it opens at a readable size and centred; the fit button switches between the whole room and the readable size. Pulling the events bar up also shows the whole room. Pinch (or Ctrl + scroll) to zoom and drag to move around.
- **Exams only:** tap a free seat to mark it with your name; tap a marked seat to see who marked it. Classes and other events are view-only.
- **One seat per exam.** A student can mark one seat for each exam. Tapping another seat shows the seat you already marked; **Unmark seat** frees it so you can choose again. The rule is tied to the device, not to the name, and the database enforces it once `supabase/schema.sql` has been run again.
- **Exam reminder.** When you mark a seat, **Notify me 15 minutes before the exam** is ticked by default. Marking the seat (or ticking the box) makes the browser show its own "Allow notifications?" question; there is no popup of ours. After you allow it, a notification "Exam starts in 15 minutes" with the course, hall, seat and time appears 15 minutes before the exam, and tapping it opens that exam. You can switch the reminder on or off later from your own seat's box, and unmarking the seat cancels it. Reminders are kept on that device and are shown while the site is open in the browser (a tab, even in the background, or the installed app); nothing is sent from a server, so a closed browser shows nothing. If the site is opened inside the last 15 minutes the reminder shows at once; after the exam has started it is dropped. If notifications are blocked, the box says so: allow them from the icon next to the address in Chrome. An iPhone or iPad shows no reminder box in a plain Safari tab (add the site to the Home Screen to use notifications there).
- **Look.** Plain and flat: solid colours, thin borders, the device's own font. It follows the device's light or dark setting; there is no theme button.

## For the admin

Sign in at `admin.html`. The **Schedule** tab is a weekly calendar (Monday to Sunday) for the selected classroom:

- Click an empty slot to add an event at that time, or use **+ Add event**.
- Click an event for its details, then **Edit** or **Delete**.
- **Drag an event** (mouse) to another time or day to reschedule it. On touch screens, use **Edit**.
- Classes can repeat weekly or on chosen weekdays; each occurrence is a separate event you can edit or delete on its own.
- Classes and other events need the classroom to themselves (back-to-back is fine). Exams of different courses can share a classroom at the same time: the week view shows them side by side and they share one seat map. An exam can never overlap a class. If a new event clashes, the form lists what is in the way and the admin can replace those events with one click.

### Settings (admin only)

**Who can add events**

| Option | Who can add | Who can edit or delete |
| --- | --- | --- |
| Only the admin (default) | Admin | Admin |
| Admin and co-admins | Admin, and co-admins who sign in | Admin: any event. Co-admin: the events they added |
| Anyone | Anyone, no sign-in needed | Admin: any event. Co-admin: their own. Visitors cannot edit or delete |

**Exam seat marking**

| Option | Effect |
| --- | --- |
| Students can mark their seats (default) | Anyone opening an exam can mark a free seat with their name |
| Seat marking is off | The seat map is view-only; seats already marked stay marked |
| Names: Everyone (default) | Tapping a marked seat shows who marked it |
| Names: Only the person who marked it | Other students see the seat as marked, without a name |

When two exams share a classroom at the same time, a seat marked for one is taken for the other too (tapping it says "Marked by Asha for HUM 212"). Seat marking is enforced by the database once `supabase/schema.sql` has been run again. The name setting is applied by the website, so it keeps names out of the page for other students but is not a lock on the database itself.

**Co-admins.** Add an email and a password for each person, share the password with them directly, and they sign in from the **Co-admin** tab. You can reset a password or remove a co-admin at any time; either one signs them out immediately.

The **+ Event** button on a classroom page appears only for people who may add events right now. Visitors who cannot add never see it.

## Loading timetables

- `supabase/schedule.sql` is the Varsha 2026 class timetable and `supabase/exams.sql` the mid-sem and end-sem exams (one event per course per hall; codes joined by "/" in a seating plan are one course, shown as `DSC 323 / MAT 314 / MSM 405`). Both only replace their own kind of event, keep events that are already right (so bookmarks and seat marks survive) and are safe to run again. `exams.sql` also installs the room rules, so two exams can share a hall.
- `supabase/courses.md` lists every course code of the three catalogues and the 2026 timetables, with the codes that are one course grouped together. `supabase/timetable-command.md` is a prompt to give any AI together with a timetable PDF and `courses.md`: it returns the SQL for Supabase. Neither file is served on the website.

## Setup (Cloudflare Pages + Supabase)

1. Create a Supabase project. In the SQL editor run `supabase/schema.sql`, then `supabase/seed.sql`. If you already have a database, run `schema.sql` again: it only adds what is missing (the `created_by` column, `app_settings`, `coadmins`, the exam-only seat guard, the one-seat-per-student rule with its `release_seat` function, and the room rules: no overlap for classes, exams of different courses may share a hall). Until it has been run again the site still works, and each browser enforces the one-seat rule on its own.
2. In Cloudflare Pages, add these for Production:

| Name | Type | Value |
| --- | --- | --- |
| `SUPABASE_URL` | Variable | `https://PROJECT_REF.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | Variable | the `sb_publishable_...` key (used by the browser) |
| `SUPABASE_SECRET_KEY` | **Secret** | the `sb_secret_...` key (used only by the functions) |
| `ADMIN_PASSWORD` | **Secret** | the admin's password. Also signs the session cookie, so changing it signs everyone out |

3. Optional but recommended: add a Cloudflare rate-limiting rule for `POST /api/admin/login` to slow down password guessing.
4. Run `supabase/verify.sql` and check the expected results noted inside.

Secrets are read only by Cloudflare Pages Functions; they are never in the HTML or `js/` files. Sessions use a signed, `HttpOnly`, `SameSite=Strict` cookie that lasts eight hours. Co-admin passwords are stored as salted PBKDF2 hashes.

## Troubleshooting: "Supabase could not complete that request"

The admin page now says what is actually wrong. The usual causes:

| Message | Fix |
| --- | --- |
| The database is out of date (a column is missing) | Supabase > SQL editor > run `supabase/schema.sql` again (safe to repeat). This is the most common cause after updating the site. |
| A database table is missing | Run `supabase/schema.sql`, then `supabase/seed.sql`. |
| Supabase rejected the key / denied access | In Cloudflare Pages > Settings > Variables and Secrets, check `SUPABASE_URL` (the project URL) and `SUPABASE_SECRET_KEY` (the `sb_secret_...` key, not the publishable one). Redeploy after changing them. |
| Supabase is not configured | Add `SUPABASE_URL` and `SUPABASE_SECRET_KEY` for **Production** (and Preview if you test there), then redeploy. |

Exam reminder not shown: the site must be open in the browser at that time, notifications must be allowed for the site (Chrome: the icon next to the address, then Notifications > Allow), and the seat must still be marked on that device. Chrome sometimes shows the permission question as a small crossed bell in the address bar instead of a popup (for example when quieter notification prompts are on in Chrome's settings); tap the bell and choose Allow.

Full details are written to the Cloudflare logs: Workers & Pages > your project > the deployment > Functions > Real-time logs.

Files that are not part of the website (`tests/`, `*.sql`, `*.md`) are hidden from visitors by `functions/_middleware.js`.

## Preview without any setup

```
node tests/dev-server.js
```

Open http://localhost:8788. This runs the real functions against an in-memory database seeded with sample events (admin password `admin`; co-admin `coadmin@example.com` / `coadmin123`). Nothing is saved when you stop it.

## Interactive map

- **Look around.** Drag to turn the campus (mouse or finger), pinch or Ctrl + scroll to zoom, Shift + drag or two fingers to move. The buttons under the map turn, tilt, zoom and reset; the keyboard works too (arrow keys, + and -, 0, Escape).
- **Buildings and floors.** Tap a building or its button: it opens into Ground, First and Second floor. Pick a floor (button, label or tap) to see it alone; tap a hall for its seat count and the button that opens its seating arrangement. Escape, or tapping empty ground, steps back.
- **Flat plan.** Below the map the chosen floor is drawn flat. The LHC first and second floors use the printed floor plan with clickable halls; other floors show the outline.
- **Editing.** Building shapes and rooms are in `js/campus-data.js` (units are satellite-view pixels, y points south). Each building lists `rooms[floor]` as `features` and `rooms`; a room with an `id` opens `room.html?room=<id>`. Roads are `LHC_CAMPUS.roads`.

## Editing a classroom

Seating arrangements are in `js/data.js`. A room with `layout: null` shows a short notice instead of a map.

```
layout: {
  rows: [ { seats: ['1', '2', ...], lead: 0, aislesAfter: [4, 12], tail: { kind: 'stairs', cols: 4 } } ],   // seats left to right; tail is optional
  sideStairs: { side: 'left', fromRow: 0, toRow: 10 },                    // optional stair strip
  aisleLabel: 'STAIRS',                                                   // optional label for aisles
  board: { from: 1, to: 2 },                                              // optional: board spans these blocks (default: the middle one)
  looseChairs: { segments: 4 },                                           // optional: unnumbered chairs in front of row 1
  exits: {
    front: ['left', 'right'],                                             // doors beside the board
    sides: [{ row: 1, side: 'left' }],                                    // doors on a side wall
    rear: [{ at: 'aisle', index: 0 }, { at: 'center' }]                   // doors on the back wall
  }
}
```

- `aislesAfter` lists how many seats come before each aisle. `lead` adds empty columns before a row's first seat so uneven rows stay aligned.
- `tail` adds a strip after the last seat that is `cols` seats wide: `kind: 'stairs'` or `'platform'` (shows loose chairs).
- A seat's number is its id, so numbers must be unique within a classroom.
- New classrooms also need a row in `supabase/seed.sql` and an entry in `ROOM_IDS` in `functions/api/admin/events.js`.

## Classroom notes

- **Jupiter** and **Venus** (112 seats each) have the same arrangement: seat 1 at the audience's right, front door on the right.
- **Bhaskara** (252 seats): 10 rows of 24 in blocks of 6, plus a 4-seat block on rows 8-10. 24 loose chairs in front of row 1 and 8 on the platform at rows 6-7 have no numbers.
- **Kaumudi** (228 seats): numbered like the desk plates, snaking from row to row.
- To flip a hall, change `seatOneOn` / `frontDoor` in `twinHall(...)` in `js/data.js`.

## Tests

```
node tests/smoke-test.js    # layouts, pages, theme, bookmarks, interactive map (3D data, placement, floor plan), one seat per exam, exam reminder, page structure
node tests/api-test.js      # sign-in, roles, who-can-add modes, edit/reschedule, delete rules, co-admins
node tests/error-hint-test.js   # Supabase failures give specific, safe hints
```
