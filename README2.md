# IISER TVM - Lecture Hall Complex seat map

A static classroom seat-map site with shared event and exam-seat data. Students can view classroom events and mark an available seat for an exam. Creating and deleting events is restricted to the password-protected admin page.

## Pages

- `index.html` - classroom list and the interactive-map link
- `interactive-map.html` - the Lecture Hall Complex floor plan; select a classroom
- `room.html?room=lhc-kaumudi` - seating arrangement, event timeline and exam seat marking
- `admin.html` - password-protected event management

## Responsive layout

The saved light/dark theme is retained. On small phones, the five classroom buttons display as a compact three-column grid, creating two rows. The seat map preserves tap size and can be panned in both directions.

## Shared backend and admin security

The app uses Supabase for shared event and seat-mark storage. Cloudflare Pages Functions provide public browser configuration and the protected admin endpoints. **Do not put `ADMIN_PASSWORD` or `SUPABASE_SECRET_KEY` in an HTML file, `js/` file, or `supabase/config.js`.**

### 1. Configure Supabase

1. Create a Supabase project.
2. In the SQL editor, run `supabase/schema.sql`, then `supabase/seed.sql`.
3. In Supabase API Keys, copy the Project URL, publishable key, and a server-side secret key. Use the current `sb_publishable_...` / `sb_secret_...` key types where available. Do not use a secret/service-role key in browser code.
4. If you already have a database with events, back it up and review any existing table grants or policies before applying the updated schema. The updated schema intentionally removes direct browser event writes and does not drop an old `rooms.layout` column. Existing data should be retained, but custom policies should be reviewed.

### 2. Add Cloudflare Pages environment variables

In **Cloudflare Dashboard → Workers & Pages → your Pages project → Settings → Variables and Secrets**, add these bindings for the Production environment:

| Name | Type | Value |
| --- | --- | --- |
| `SUPABASE_URL` | Variable | Your Supabase project URL, such as `https://PROJECT_REF.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | Variable | The project's publishable key (`sb_publishable_...`) |
| `SUPABASE_SECRET_KEY` | **Secret** | The server-side Supabase secret key (`sb_secret_...`) used only by the admin API |
| `ADMIN_PASSWORD` | **Secret** | A strong, unique password for the LHC admin page |

The public `/api/config` function only returns `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`. The two secrets are read only by Cloudflare Pages Functions. The admin password is not embedded in the website source; successful sign-in sets a signed, `HttpOnly`, `Secure` (on HTTPS), `SameSite=Strict` cookie that expires after eight hours.

Use separate test credentials for Preview deployments, or do not attach production secrets to previews. For an internet-facing site, configure a Cloudflare rate-limiting rule for `POST /api/admin/login` as additional protection against password guessing. See the [Cloudflare Pages Functions bindings guide](https://developers.cloudflare.com/pages/functions/bindings/) and [Supabase API keys guide](https://supabase.com/docs/guides/getting-started/api-keys) for the current dashboard steps and key handling rules.

### 3. Deploy to Cloudflare Pages

Deploy this project using **Git integration** (recommended) or Wrangler Pages deployment with Functions included. Keep the `functions/` directory at the project root beside `index.html`. For a no-framework project, use a build command such as `exit 0` and set the build output directory to the directory containing `index.html` and the `functions/` directory. The root `index.html` must be present in the deployed output.

After adding or changing environment bindings, redeploy the project. Test the deployed site by opening a classroom, verifying events and seat marks are shared across devices, signing in at `admin.html`, creating a test event, then deleting it. If an older database already has events at overlapping times, resolve those conflicts before using the admin form.

### 4. Local development

For basic layout work, run a static server:

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000`. Without Cloudflare Pages Functions, the site deliberately falls back to browser-local storage and the admin endpoints will not work. To test the server-side admin flow locally, use `wrangler pages dev` with environment variables configured locally; do not commit `.dev.vars` or any secret values.

## Shared seat marks

Public visitors can read events and seat marks, and can insert a seat mark for an exam. The database unique constraint on `(event_id, seat_id)` prevents two people marking the same seat for the same exam. Students' display names are not verified identities, so they should use their own name or initials. Event create/delete access is routed through Cloudflare admin functions instead of the public browser key. Browser-local events from previous deployments do not automatically migrate into Supabase; add/import the required events after configuring the shared database.

Seat marks from an earlier version used seat IDs such as `B-28`. They no longer match the current seat IDs; back up the database before deciding whether to delete any legacy marks.

## Editing a classroom

Seating arrangements are in `js/data.js`. A room with `layout: null` shows a notice instead of a map.

```js
layout: {
  rows: [ { seats: ['1', '2', ...], lead: 0, aislesAfter: [4, 12], tail: { kind: 'stairs', cols: 4 } } ],
  sideStairs: { side: 'left', fromRow: 0, toRow: 10 },
  aisleLabel: 'STAIRS',
  board: { from: 1, to: 2 },
  looseChairs: { segments: 4 },
  exits: {
    front: ['left', 'right'],
    sides: [{ row: 1, side: 'left' }],
    rear: [{ at: 'aisle', index: 0 }, { at: 'center' }]
  }
}
```

- `aislesAfter` lists how many seats come before each aisle. `lead` adds empty columns before a row's first seat so uneven rows stay aligned.
- `tail` adds a strip after the last seat: `stairs` joins consecutive rows into one flight, while `platform` shows loose chairs.
- A seat's number is its id, so numbers must be unique within a classroom.

## Classroom notes from this project's layout data

- **Venus** (112 seats) was surveyed from photos. Seat 1 is at the audience's right, and the map draws the room as seen facing the board.
- **Jupiter** (112 seats) is Venus mirrored: seat 1 at the left, front door on the left. It has not been photographed, so check it against the room.
- **Bhaskara** (252 numbered seats): 10 rows of 24 in blocks of 6, plus a 4-seat block in rows 8–10. 24 loose chairs at the front and 8 on the platform at rows 6–7 have no numbers.
- **Kaumudi** (228 seats) uses the surveyed layout represented in `js/data.js`.
- **Aryabhatta** is listed as 500 seats, but the seating arrangement has not been added yet.

## Tests

Run the smoke tests with:

```sh
node tests/smoke-test.js
```
