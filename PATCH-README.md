# Patch: Seats booked report in the admin panel

Copy these files over your repo (same paths), then commit and push. No database or Cloudflare setting changes.

What changed
- New **Seats booked** tab in the admin page (signed-in admin and co-admins). It lists every exam with the seats students marked for it and their names, grouped by classroom and sorted by date and time. Each exam shows its date, time, teacher, how many seats are booked, and a table of seat number and name in seat order. Classes and other events have no seat marks (marking is for exams only), so only exams appear.
- Filters: classroom (all or one), dates (today and later, earlier dates, all dates), and show (exams with seats booked, or all exams). Refresh reloads the latest marks.
- **Print or save as PDF** opens the print dialog (choose Save as PDF). The print layout is A4 with only the report: a title block, one heading per classroom, one table per exam, page numbers, and the exam heading repeated on every page of a long list. The proposed file name is "Seats booked - classroom - date". Print is always black on white, also in dark mode.
- Long lists work: seat marks are read page by page (the database returns 1000 rows at a time), so an exam with more than 1000 marks is complete.
- The offline cache version is renewed so installed copies pick up the changed files.

Files
- admin.html, js/admin.js, js/store.js, css/styles.css, sw.js
- tests/smoke-test.js, tests/dev-server.js, tests/fake-supabase.js (test additions: store paging, tab access, print rules)
- README.md, STATUS.md
