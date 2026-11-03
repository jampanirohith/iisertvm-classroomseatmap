# Patch notes

Unzip this over your project folder (overwrite when asked), then:

1. Delete the files listed under "Delete" below.
2. Supabase: open the SQL editor and run `supabase/schema.sql` again. It is safe to repeat; it only adds the new pieces.
3. Cloudflare Pages: no new variables. Keep SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY and ADMIN_PASSWORD.
4. Redeploy. Admin sign-in now has an Admin tab and a Co-admin tab. Use Settings to choose who can add events and to create co-admins.

Try it locally first: `node tests/dev-server.js`, open http://localhost:8788 (admin password: admin).

## Delete
- README1.md
- README2.md
- js/theme.js
- tests/supabase-contract-test.js

## Changed or added
- README.md
- admin.html
- css/styles.css
- functions/_shared/admin-auth.js
- functions/api/admin/coadmins.js
- functions/api/admin/events.js
- functions/api/admin/login.js
- functions/api/admin/logout.js
- functions/api/admin/session.js
- functions/api/admin/settings.js
- index.html
- interactive-map.html
- js/admin.js
- js/format.js
- js/home.js
- js/room.js
- js/store.js
- js/week-calendar.js
- room.html
- supabase/schema.sql
- supabase/verify.sql
- tests/api-test.js
- tests/dev-server.js
- tests/fake-supabase.js
- tests/smoke-test.js
