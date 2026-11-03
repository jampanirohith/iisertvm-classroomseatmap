# IISER TVM - Lecture Hall Complex seat map

Open a classroom to see its seating arrangement, browse its events by date, bookmark the ones you care about, and mark your seat for exams.

## Pages

| Page | What it does |
| --- | --- |
| `index.html` | Classrooms (two per row on phones) and **My events** |
| `room.html?room=lhc-kaumudi` | Seat map, one-date-at-a-time event column, bookmarks, exam seat marking |
| `interactive-map.html` | Floor plan of the Lecture Hall Complex |
| `admin.html` | Weekly schedule for each classroom: add, edit, reschedule, delete; settings and co-admins (admin only) |

## For students

- **Event column.** Tap a date to see that day's events, then tap an event to show it on the map. Only one date is shown at a time.
- **Bookmarks.** Tap the bookmark on an event, or **Add to My events** under the map. Bookmarks are saved on that device only (browser storage), so they are private and do not follow you to another phone.
- **My events** (homepage) has two columns: **Classes**, shown one date at a time (pick the date), and **Exams**, all in one list. Anything else you bookmark appears under **Other**.
- **Seat map.** The whole classroom is in view when the page opens, including on phones. Pinch (or Ctrl + scroll) to zoom, drag to move around, and use the fit button to return to the whole room.
- **Exams only:** tap a free seat to mark it with your name. Classes and other events are view-only.
- The page follows the device's light or dark setting. There is no theme switch.

## For the admin

Sign in at `admin.html`. The **Schedule** tab is a weekly calendar (Monday to Sunday) for the selected classroom:

- Click an empty slot to add an event at that time, or use **+ Add event**.
- Click an event for its details, then **Edit** or **Delete**.
- **Drag an event** (mouse) to another time or day to reschedule it. On touch screens, use **Edit**.
- Classes can repeat weekly or on chosen weekdays; each occurrence is a separate event you can edit or delete on its own.
- Two events in the same classroom cannot overlap (back-to-back is fine).

### Settings (admin only)

**Who can add events**

| Option | Who can add | Who can edit or delete |
| --- | --- | --- |
| Only the admin (default) | Admin | Admin |
| Admin and co-admins | Admin, and co-admins who sign in | Admin: any event. Co-admin: the events they added |
| Anyone | Anyone, no sign-in needed | Admin: any event. Co-admin: their own. Visitors cannot edit or delete |

**Co-admins.** Add an email and a password for each person, share the password with them directly, and they sign in from the **Co-admin** tab. You can reset a password or remove a co-admin at any time; either one signs them out immediately.

The **+ Event** button on a classroom page appears only for people who may add events right now. Visitors who cannot add never see it.

## Setup (Cloudflare Pages + Supabase)

1. Create a Supabase project. In the SQL editor run `supabase/schema.sql`, then `supabase/seed.sql`. If you already have a database, run `schema.sql` again: it only adds what is missing (the `created_by` column, `app_settings`, `coadmins`, the exam-only seat guard and the no-overlap rule).
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

## Preview without any setup

```
node tests/dev-server.js
```

Open http://localhost:8788. This runs the real functions against an in-memory database seeded with sample events (admin password `admin`; co-admin `coadmin@example.com` / `coadmin123`). Nothing is saved when you stop it.

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

- **Venus** (112 seats) was surveyed from photos. Seat 1 is at the audience's right.
- **Jupiter** (112 seats) is Venus mirrored: seat 1 at the left, front door on the left. Check it against the room.
- **Bhaskara** (252 seats): 10 rows of 24 in blocks of 6, plus a 4-seat block on rows 8-10. 24 loose chairs in front of row 1 and 8 on the platform at rows 6-7 have no numbers.
- **Kaumudi** (228 seats): numbered like the desk plates, snaking from row to row.
- To flip a hall, change `seatOneOn` / `frontDoor` in `twinHall(...)` in `js/data.js`.

## Tests

```
node tests/smoke-test.js    # layouts, pages, theme, bookmarks, page structure
node tests/api-test.js      # sign-in, roles, who-can-add modes, edit/reschedule, delete rules, co-admins
```
