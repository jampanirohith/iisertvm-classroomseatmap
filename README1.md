# IISER TVM — Lecture Hall Complex seat map

A static HTML/CSS/JavaScript application for the four verified LHC seating layouts. No account or registration is required for visitors. Supabase provides shared events and exam seat marks when configured.

## Current rules

- Only **one event session** can be created at a time. Recurring-event controls have been removed.
- Events in the **same room cannot overlap**. Back-to-back times (for example, 10:00–11:00 and 11:00–12:00) are allowed. Database exclusion constraints enforce this even when two visitors submit concurrently.
- Events in different rooms may run at the same time.
- Anyone can create an event. The creating browser receives a long random private owner token. The server stores only its SHA-256 hash in the non-exposed `private` schema. Only a browser holding the token can delete that event; keep that browser's site data or there will be no recovery until the admin tools are added.
- Only **Exam** events allow seat marking. Students can enter a name, roll number, or both; at least one is required.
- Roll numbers are unique per exam (case-insensitive, with surrounding spaces ignored). Duplicate names are allowed. Roll numbers and owner/device tokens are stored in the non-exposed `private` schema; the public seat map does not reveal roll numbers.
- Each browser token can mark one seat per exam. A person can release their own mark using **Change my seat**, then mark another available seat. This is a convenience anti-duplicate check, not verified identity: clearing browser data or using another device can bypass it.
- The database validates exam type and the room's real seat IDs. Direct table writes are revoked; public writes use validated RPC functions.
- Professor is optional. Event notes are optional.
- All four current seat layouts live in `js/data.js`. Aryabhatta remains a placeholder without a verified layout, so event creation is disabled for that room by the database seat check.

## 1. Create/configure Supabase

1. Create a Supabase project.
2. Open **SQL Editor** in the Supabase Dashboard.
3. Run `supabase/schema.sql` first.
4. Run `supabase/seed.sql` second. It inserts the room records and the 704 verified numbered seats from Jupiter, Venus, Bhaskara, and Kaumudi.
5. In **Project Settings → API Keys**, copy the **Project URL** and the **publishable key** (a legacy anon/public key is also accepted).
6. Open `supabase/config.js` and paste those two values in `url` and `publishableKey`. Do not use a `service_role` key or any secret key in browser code.
7. Open **Database → Publications** and check that `events` and `seat_marks` are included in the `supabase_realtime` publication. `schema.sql` attempts to enable both automatically.

The publishable key is designed for browser use. Security comes from the database grants, RLS policies, private owner-token tables, and validated RPC functions in `schema.sql`—not from hiding the publishable key.

## 2. Run locally

From this project folder:

```bash
python3 -m http.server 8000
```

Open <http://localhost:8000>. A local server is recommended because Web Crypto and cross-origin requests work reliably on `localhost`; do not open the pages by double-clicking the HTML files.

If `supabase/config.js` is blank, the app explicitly reports **local-only mode**. Events and marks will not be shared with other devices. Once a URL/key is configured, a connection failure will not silently fall back to local writes.

## 3. Verify the database setup

Run `supabase/verify.sql` in the SQL Editor. Expected seat counts:

| Room | Expected seats |
|---|---:|
| Jupiter | 112 |
| Venus | 112 |
| Bhaskara | 252 |
| Kaumudi | 228 |

Then test using two different browsers or a private window:

1. Create an exam in one browser; confirm it appears in the other.
2. Try to create an overlapping event in the same room; it must be rejected.
3. Create an event in a different room at the same time; it should succeed.
4. Mark an exam seat with only a name, then another seat with only a roll number.
5. Try the same roll number on another seat in that exam; it must be rejected.
6. Try to mark a seat for a class event; it must be rejected.
7. Confirm the creator's browser can delete its event and a different browser cannot.
8. Mark a seat, use **Change my seat**, and mark a different seat.

`supabase/schema.sql` is intended to be re-runnable for this version. If the database already contains conflicting/overlapping events, PostgreSQL will refuse to add the no-overlap constraint. Resolve existing overlaps first; do not drop the constraint to work around that warning.

If an old test database contains seat marks with legacy IDs such as `B-28` that no longer exist in `js/data.js`, inspect them with `select event_id, seat_id from public.seat_marks;`. If they are disposable test data, you may clear them with `delete from public.seat_marks;` before going live. Do not run that delete if you need to retain existing marks.

## 4. Tests

```bash
node tests/smoke-test.js
node tests/supabase-contract-test.js
```

These tests validate classroom layouts and seat counts, required files, the public-vs-private database contract, and the storage API with mocked Supabase responses. They do not connect to your personal Supabase project. A live two-browser test is still required after you paste the real project URL/key and run the SQL.

## Security / production note

This phase deliberately does not add the admin page or Cloudflare Functions yet. Since event creation is public and account-free, a determined visitor could still automate many valid event-creation RPC calls. Before sharing this publicly with the whole institute, add server-side rate limiting (recommended through Cloudflare Pages Functions), then add the 20-character admin secret flow on that server side. Never put an admin secret or Supabase service-role key into the public JavaScript.

## Project files

- `index.html` — classroom list
- `interactive-map.html` — LHC map and room links
- `room.html` — event controls, seat map and exam-marking forms
- `js/data.js` — seating arrangements; preserved
- `js/store.js` — local/shared storage, event-owner tokens, seat-mark APIs and realtime subscriptions
- `supabase/config.js` — project URL and publishable key placeholders
- `supabase/schema.sql` — tables, constraints, grants, RLS policies, private token storage and RPCs
- `supabase/seed.sql` — room and valid-seat seed data
- `supabase/verify.sql` — post-setup checks
