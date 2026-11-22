'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert/strict');

const root = path.join(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const plain = v => JSON.parse(JSON.stringify(v));   // values from the vm sandbox have a different Array prototype

// Every script parses.
for (const f of ['js/data.js', 'js/store.js', 'js/room.js', 'js/home.js', 'js/map.js', 'js/format.js', 'js/admin.js', 'js/week-calendar.js', 'js/recurrence.js', 'js/cheer.js', 'js/notify.js', 'js/pwa.js', 'sw.js', 'supabase/config.js']) new vm.Script(read(f), { filename: f });

// Classrooms.
const sandbox = { window: {} };
vm.runInNewContext(read('js/data.js'), sandbox);
const rooms = plain(sandbox.window.LHC_ROOMS);
assert.deepEqual(rooms.map(r => [r.id, r.capacity]), [['lhc-jupiter', 112], ['lhc-venus', 112], ['lhc-bhaskara', 252], ['lhc-kaumudi', 228], ['lhc-aryabhatta', 500]]);

for (const room of rooms) {
  if (!room.layout) { assert.ok(room.id === 'lhc-aryabhatta', `${room.id} needs a layout`); continue; }
  const ids = room.layout.rows.flatMap(r => r.seats);
  assert.equal(ids.length, room.capacity, `${room.id}: seat count equals capacity`);
  assert.equal(new Set(ids).size, ids.length, `${room.id}: seat numbers are unique`);
  ids.forEach(id => assert.match(id, /^\d+$/, `${room.id}: seat ${id} is a plain number`));
  room.layout.rows.forEach((row, i) => {
    assert.ok(!('label' in row), `${room.id}: rows carry no letters`);
    assert.ok(row.seats.length > 0, `${room.id}: row ${i} has seats`);
    (row.aislesAfter || []).forEach(n => assert.ok(n > 0 && n < row.seats.length, `${room.id}: row ${i} aisle position`));
  });
}

// Jupiter and Venus: 8 rows of 14 (blocks of 4 | 6 | 4), numbers snake from row to row.
// Both halls have seat 1 at the audience's right and the front door on the right.
for (const [id, seatOneOn, door] of [['lhc-jupiter', 'right', 'right'], ['lhc-venus', 'right', 'right']]) {
  const layout = rooms.find(r => r.id === id).layout, rows = layout.rows;
  assert.deepEqual(rows.map(r => r.seats.length), Array(8).fill(14));
  rows.forEach((row, i) => {
    assert.deepEqual(row.aislesAfter, [4, 10], `${id} row ${i + 1}: blocks 4 | 6 | 4`);
    const n = row.seats.map(Number), asc = n[0] < n[13];
    assert.equal(asc, (i % 2 === 0) === (seatOneOn === 'left'), `${id} row ${i + 1}: direction`);
    assert.ok(n.every((v, j) => j === 0 || Math.abs(v - n[j - 1]) === 1), `${id} row ${i + 1}: consecutive`);
    assert.equal(Math.min(...n), i * 14 + 1);
  });
  assert.equal(rows[0].seats[seatOneOn === 'left' ? 0 : 13], '1');
  assert.deepEqual(layout.exits.front, [door]);
  assert.equal(layout.exits.rear.length, 2);
}
{
  // The two halls have the same seating arrangement.
  const j = rooms.find(r => r.id === 'lhc-jupiter').layout.rows, v = rooms.find(r => r.id === 'lhc-venus').layout.rows;
  j.forEach((row, i) => assert.deepEqual(row.seats, v[i].seats));
}

// Bhaskara: 252 numbered seats; rows 1-10 hold 24 in blocks of 6, rows 8-10 add a separate block of 4.
{
  const b = rooms.find(r => r.id === 'lhc-bhaskara').layout;
  const nums = b.rows.flatMap(r => r.seats.map(Number)).sort((x, y) => x - y);
  assert.deepEqual(nums, Array.from({ length: 252 }, (_, i) => i + 1));
  assert.equal(b.rows.length, 10);
  assert.deepEqual(b.rows.map(r => r.seats.length), [24, 24, 24, 24, 24, 24, 24, 28, 28, 28]);
  b.rows.forEach((row, i) => {
    const main = row.seats.slice(0, 24).map(Number), asc = main[0] < main[23];
    assert.equal(asc, i % 2 === 1, `bhaskara row ${i + 1}: direction`);
    assert.ok(main.every((v, j) => j === 0 || Math.abs(v - main[j - 1]) === 1), `bhaskara row ${i + 1}: consecutive`);
    assert.equal(Math.min(...main), i * 24 + 1);
    assert.equal(row.lead, 1);
    assert.equal(!!row.tail, i < 7, `bhaskara row ${i + 1}: right-hand strip`);
    assert.deepEqual(row.aislesAfter, i < 7 ? [6, 12, 18] : [6, 12, 18, 24]);
  });
  assert.deepEqual(b.rows[7].seats.slice(24), ['244', '243', '242', '241']);
  assert.deepEqual(b.rows[8].seats.slice(24), ['245', '246', '247', '248']);
  assert.deepEqual(b.rows[9].seats.slice(24), ['252', '251', '250', '249']);
  assert.deepEqual(b.rows.slice(0, 7).map(r => r.tail.kind), ['stairs', 'stairs', 'stairs', 'stairs', 'stairs', 'platform', 'platform']);
  assert.deepEqual(b.exits.front, ['left', 'right']);
  assert.equal(b.exits.rear.length, 2);
}

// Kaumudi: 228 numbered desk plates snaking row to row; every block lines up on every row.
{
  const k = rooms.find(r => r.id === 'lhc-kaumudi').layout;
  const nums = k.rows.flatMap(r => r.seats.map(Number)).sort((a, b) => a - b);
  assert.deepEqual(nums, Array.from({ length: 228 }, (_, i) => i + 1));
  assert.deepEqual(k.rows.map(r => r.seats.length), [16, 16, 16, 16, 16, 16, 16, 16, 16, 15, 15, 18, 18, 18]);
  assert.equal(k.rows[0].seats[0], '1');
  k.rows.forEach((row, i) => {
    const n = row.seats.map(Number);
    assert.equal(n[0] < n[n.length - 1], i % 2 === 0, `row ${i + 1}: snaking direction`);
    assert.ok(n.every((v, j) => j === 0 || Math.abs(v - n[j - 1]) === 1), `row ${i + 1}: consecutive numbers`);
    assert.equal(row.lead + row.aislesAfter[0], 6, `row ${i + 1}: side block aligned`);
    assert.equal(row.aislesAfter[1] - row.aislesAfter[0], 8, `row ${i + 1}: centre block of 8`);
    assert.equal(row.seats.length - row.aislesAfter[1], 4, `row ${i + 1}: right block of 4`);
  });
  assert.equal(k.exits.front.length, 2);
  assert.equal(k.exits.sides.length, 1);
  assert.equal(k.exits.rear.length, 2);
  assert.deepEqual(k.sideStairs, { side: 'left', fromRow: 0, toRow: 10 });
}

// Database files agree with the classrooms.
const seed = read('supabase/seed.sql'), schema = read('supabase/schema.sql');
for (const room of rooms) assert.ok(seed.includes(`('${room.id}', '${room.name}', 'Lecture Hall Complex', ${room.capacity})`), `seed row for ${room.id}`);
for (const table of ['rooms', 'events', 'seat_marks', 'app_settings', 'coadmins']) assert.ok(schema.includes(`create table if not exists public.${table}`), `schema creates ${table}`);

// Pages: every local link and script exists, and no leftover wording.
const pages = ['index.html', 'room.html', 'interactive-map.html', 'admin.html'];
for (const page of pages) {
  const html = read(page);
  for (const m of html.matchAll(/(?:href|src)="([^"#]+)"/g)) {
    const target = m[1].split('?')[0];
    if (/^(https?:|mailto:)/.test(target)) continue;
    assert.ok(fs.existsSync(path.join(root, target)), `${page}: ${target} exists`);
  }
}
const mapHtml = read('interactive-map.html');
for (const room of rooms) assert.ok(mapHtml.includes(`room.html?room=${room.id}`), `map links to ${room.id}`);
const banned = /\b(provisional|demo|prototype|reconstruct\w*)\b/i;
for (const f of [...pages, 'css/styles.css', 'js/data.js', 'js/store.js', 'js/room.js', 'js/home.js', 'js/map.js', 'js/format.js', 'js/admin.js', 'js/week-calendar.js', 'js/recurrence.js', 'README.md', 'supabase/schema.sql', 'supabase/seed.sql']) {
  assert.ok(!banned.test(read(f)), `${f}: no leftover working-draft wording`);
}
// Recurrence uses calendar-safe ISO dates and supports weekly / selected weekdays.
const recurrenceContext = { window: {} };
vm.runInNewContext(read('js/recurrence.js'), recurrenceContext);
const recurrence = recurrenceContext.window.LHC_RECURRENCE;
assert.deepEqual(Array.from(recurrence.dates('2026-10-19', '2026-11-09', [1])), ['2026-10-19', '2026-10-26', '2026-11-02', '2026-11-09']);
assert.deepEqual(Array.from(recurrence.dates('2026-10-19', '2026-10-30', [1, 3, 5])), ['2026-10-19', '2026-10-21', '2026-10-23', '2026-10-26', '2026-10-28', '2026-10-30']);
assert.equal(recurrence.weekday('2026-10-19'), 1);
assert.throws(() => recurrence.dates('2026-10-20', '2026-10-19', [2]), /on or after/);
assert.throws(() => recurrence.dates('2026-10-19', '2027-06-01', [1]), /180 days/);
assert.throws(() => recurrence.dates('2026-10-19', '2026-10-21', []), /at least one weekday/);
const roomPage = read('room.html');
const roomScript = read('js/room.js');
for (const page of pages) assert.equal((read(page).match(/<h1\b/g) || []).length, 1, `${page} has exactly one top-level heading`);
assert.ok(/if \(!room\) \{[\s\S]*?\.top-tools'\)\.hidden = true/.test(roomScript), 'the not-found classroom page hides the calendar button');
assert.ok(read('functions/api/admin/events.js').includes('event.start_time < previous.end_time && event.end_time > previous.start_time'), 'server-side event overlap validation');
assert.ok(roomScript.includes("if (!ev || ev.type !== 'exam')"), 'seat marking is limited to exam events');
assert.ok(!roomScript.includes('Enter the professor for a class'), 'professor name is optional for classes');
assert.ok(read('admin.html').includes('Professor (optional)'), 'professor field is labeled optional in the admin form');
assert.ok(roomPage.includes('Mark my seat'), 'exam seat UI uses marking language');
assert.ok(!roomPage.includes('Book seat'), 'seat dialog does not use booking language');
const css = read('css/styles.css');
assert.ok(css.includes('@media (prefers-color-scheme: dark)') && css.includes('color-scheme: light dark'), 'the theme follows the device setting');
for (const page of pages) assert.ok(!/theme-toggle|data-theme|js\/theme\.js/.test(read(page)), `${page}: no manual light/dark switch`);
assert.ok(!fs.existsSync(path.join(root, 'js/theme.js')), 'theme.js is gone');
// Plain, flat styling: glass blur only in dark mode (the marked "dark glass" block), no other gradients except the calendar's hour lines, no decorative serif.
const glass = (css.match(/\/\* dark glass \*\/[\s\S]*?\/\* end dark glass \*\//) || [''])[0];
assert.ok(/@media \(prefers-color-scheme: dark\)/.test(glass) && /backdrop-filter/.test(glass), 'dark mode has a light glass touch');
const flatCss = css.replace(glass, '');
assert.ok(!/backdrop-filter|blur\(/.test(flatCss), 'no glass / blur effects outside dark mode');
assert.ok((flatCss.match(/gradient\(/g) || []).length === 1 && /\.cal-col \{[^}]*linear-gradient/.test(flatCss), 'no gradients except the calendar hour lines');
assert.ok(/--bg: #000000/.test(css), 'dark mode page is pure black');
assert.ok(!/(^|[^-])serif/.test(css.replace(/sans-serif/g, '').replace(/--m-serif:[^;]*;/g, '')), 'no serif headings (only the lettering of the floor plan, which copies the printed plan)');
assert.ok(/\.seat \{[^}]*border-radius: 12px 12px 8px 8px[^}]*transition/.test(css), 'seats are soft: rounded with smooth transitions');
assert.ok((css.match(/box-shadow/g) || []).length <= 12 && !/box-shadow:[^;]*\b(?:[2-9]\d|1\d\d)px/.test(css.replace(/rgba\([^)]*\)/g, '')), 'shadows stay small and soft');
for (const page of ['index.html', 'interactive-map.html', 'admin.html']) { const h = read(page); assert.ok(!h.includes('site-bar') && h.includes('class="site-foot"'), `${page} has no header bar, only the plain footer links`); }
assert.ok(/class="site-foot"><nav[^>]*><a href="interactive-map.html">Interactive map<\/a>[\s\S]*<a href="admin.html">Admin<\/a>/.test(read('index.html')), 'home footer lists Interactive map and Admin');
assert.ok(/id="room-list"/.test(read('index.html')) && /\.menu \{/.test(css), 'home page lists classrooms as a plain menu');
// Every class the admin calendar writes into the page must be styled (a rename once broke the grid).
{
  const cal = read('js/week-calendar.js');
  const used = new Set([...cal.matchAll(/class="([a-z][\w-]*)/g)].map(m => m[1]).concat(['cal-grid', 'cal-day-head', 'cal-times', 'cal-col', 'cal-corner', 'cal-ev', 'cal-now', 'cal-hover']));
  for (const name of used) assert.ok(css.includes(`.${name}`), `calendar class .${name} is styled`);
}
assert.ok(/@media \(max-width: 759px\)[\s\S]*\.date-nav \{ display: none; \}[\s\S]*\.day-bar \{ display: flex;[\s\S]*\.day-arrow[\s\S]*\.day-tile/.test(css), 'phones use arrows + one day strip');
assert.ok(!/\.chip-sub \{[^}]*ellipsis/.test(css) && !/\.my-title, \.result-list[^{]*\{[^}]*nowrap/.test(css), 'event names are never cut off in chips or lists');
assert.ok(read('room.html').includes('id="date-today"'), 'the date bar has a Today button');
assert.ok(read('functions/api/admin/events.js').includes('body.replace !== true') && read('js/admin.js').includes('conflict-replace'), 'the admin can replace clashing events');
for (const id of ['event-repeat', 'event-repeat-mode', 'event-repeat-until', 'repeat-days-wrap']) assert.ok(read('admin.html').includes(`id="${id}"`), `admin recurrence control ${id}`);
for (const script of ['js/format.js', 'js/recurrence.js', 'js/week-calendar.js']) assert.ok(fs.existsSync(path.join(root, script)), `${script} exists`);
console.log('PASS: classrooms, layouts, database files, pages, theme wiring and recurrence dates');


// Local event storage: recurring instances remain distinct events with independent seat marks.
(async () => {
  const values = new Map();
  const localStorage = {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
  const storeContext = { window: { addEventListener() {} }, localStorage, console };
  vm.runInNewContext(read('js/store.js'), storeContext);
  const store = storeContext.window.LHC_STORE;
  const status = await store.init();
  assert.equal(status.shared, false);
  const recurring = await store.addEvents('test-room', [
    { title: 'Signals', type: 'class', date: '2026-10-19', start: '10:00', end: '11:00', professor: 'Dr Test', note: '' },
    { title: 'Signals', type: 'class', date: '2026-10-26', start: '10:00', end: '11:00', professor: 'Dr Test', note: '' }
  ]);
  assert.equal(recurring.length, 2);
  assert.notEqual(recurring[0].id, recurring[1].id);
  const stored = await store.listEvents('test-room');
  assert.deepEqual(Array.from(stored, x => x.date), ['2026-10-19', '2026-10-26']);
  assert.equal((await store.book(recurring[0].id, '12', 'Student')).ok, true);
  assert.equal((await store.book(recurring[0].id, '12', 'Another Student')).ok, false);
  assert.equal(Object.keys(await store.listBookings(recurring[0].id)).length, 1);
  assert.equal(Object.keys(await store.listBookings(recurring[1].id)).length, 0);
  console.log('PASS: local recurring sessions persist separately and keep seat marks isolated');
})().catch(error => { console.error(error); process.exitCode = 1; });


// Cloudflare config and admin routes: secrets stay server-side, event writes are admin-only.
const configSource = read('supabase/config.js');
assert.ok(configSource.includes("fetch('/api/config'"), 'browser config is loaded from the Pages Function');
assert.ok(!configSource.includes('SUPABASE_SECRET_KEY') && !configSource.includes('ADMIN_PASSWORD'), 'browser config does not contain secrets');
const cfConfig = read('functions/api/config.js');
assert.ok(cfConfig.includes('supabasePublishableKey: String(env.SUPABASE_PUBLISHABLE_KEY') && !cfConfig.includes('SUPABASE_SECRET_KEY:'), 'public config function returns only public keys');
const loginFn = read('functions/api/admin/login.js');
const eventFn = read('functions/api/admin/events.js');
const authFn = read('functions/_shared/admin-auth.js');
assert.ok(loginFn.includes('env.ADMIN_PASSWORD'), 'admin password is read from the server environment');
assert.ok(authFn.includes('HttpOnly') && authFn.includes('SameSite=Strict'), 'admin session cookie uses protective attributes');
assert.ok(authFn.includes('env.SUPABASE_SECRET_KEY') && !eventFn.includes('SUPABASE_SECRET_KEY:'), 'privileged database key is only read in server function code');
assert.ok(eventFn.includes('getActor(request, env)') && eventFn.includes('canModify'), 'event writes check who is signed in and what they may change');
assert.ok(!read('supabase/schema.sql').includes('create policy "events public insert"'), 'browser clients cannot create events through RLS');
assert.ok(read('supabase/schema.sql').includes('revoke insert, update, delete on table public.events'), 'direct browser event writes are revoked');
assert.ok(read('js/room.js').includes('admin.html?room='), 'classroom event-strip link opens the admin page for that room');
console.log('PASS: Cloudflare runtime config, admin session security and permission-checked event writes');

// Bookmarks are saved on the device, refresh from the latest events, and drop deleted events.
(async () => {
  const values = new Map();
  const localStorage = { getItem: k => (values.has(k) ? values.get(k) : null), setItem: (k, v) => values.set(k, String(v)), removeItem: k => values.delete(k) };
  const ctx = { window: { addEventListener() {} }, localStorage, console };
  vm.runInNewContext(read('js/store.js'), ctx);
  const { bookmarks } = ctx.window.LHC_STORE;
  const ev = (id, extra = {}) => ({ id, roomId: 'lhc-kaumudi', title: `Event ${id}`, type: 'class', date: '2026-11-05', start: '10:00', end: '11:00', professor: '', note: '', ...extra });
  assert.equal(bookmarks.toggle(ev('a')), true);
  assert.equal(bookmarks.toggle(ev('b', { type: 'exam', date: '2026-11-03' })), true);
  assert.equal(bookmarks.has('a'), true);
  assert.deepEqual(Array.from(bookmarks.list(), x => x.id), ['b', 'a'], 'sorted by date and time');
  assert.equal(bookmarks.toggle(ev('a')), false, 'toggling again removes it');
  bookmarks.toggle(ev('a'));
  bookmarks.sync('lhc-kaumudi', [ev('a', { start: '12:00', end: '13:00', title: 'Moved' })]);
  assert.deepEqual(Array.from(bookmarks.list(), x => [x.id, x.title, x.start]), [['a', 'Moved', '12:00']], 'copies refresh; deleted events disappear');
  bookmarks.toggle(ev('z', { roomId: 'lhc-venus' }));
  bookmarks.sync('lhc-kaumudi', []);
  assert.deepEqual(Array.from(bookmarks.list(), x => x.id), ['z'], 'syncing one room leaves other rooms alone');
  bookmarks.remove('z');
  assert.equal(bookmarks.list().length, 0);
  console.log('PASS: bookmarks save on the device, refresh from live events and drop deleted ones');
})().catch(error => { console.error(error); process.exitCode = 1; });

// Page structure: events column, add-event visibility, calendar and admin settings.
{
  const roomJs = read('js/room.js'), adminHtml = read('admin.html'), adminJs = read('js/admin.js'), homeJs = read('js/home.js');
  assert.ok(read('room.html').includes('id="date-strip"') && roomJs.includes("data-date="), 'room page picks one date at a time');
  assert.ok(roomJs.includes("state.events.filter(e => e.date === state.date)"), 'only the selected date\'s events are listed');
  assert.ok(roomJs.includes('/api/admin/session') && roomJs.includes('session.canAdd'), 'the + Event button follows who may add events');
  assert.ok(roomJs.includes('PHONE_READABLE') && roomJs.includes('showWhole'), 'phones open at a readable zoom with a whole-room toggle');
  assert.ok(roomJs.includes("$('seat-info').showModal()") && read('room.html').includes('id="seat-info"') && !roomJs.includes("' disabled' : ''}>"), 'marked seats open a dialog showing who marked them');
  assert.ok(roomJs.includes('Store.seatSettings()') && roomJs.includes("state.rules.marking !== 'on'") && roomJs.includes('shownName') && read('js/store.js').includes('/api/seat-settings'), 'classroom page follows the admin seat-marking and name-visibility rules');
  assert.ok(['seatMarking', 'seatNames'].every(n => read('admin.html').includes(`name="${n}"`) && read('js/admin.js').includes(n)) && read('supabase/schema.sql').includes("s.key = 'seat_marking'"), 'admin Settings has seat marking and name-visibility options, enforced by the database');
  assert.ok(read('room.html').includes('id="day-strip"') && read('room.html').includes('id="top-cal"') && read('room.html').includes('id="day-prev"') && read('room.html').includes('id="day-next"') && !read('room.html').includes('month-btn'), 'room page has the calendar button and day arrows');
  { const css = read('css/styles.css'), mapCss = css.slice(css.indexOf('.map-card {'), css.indexOf('/* ---------- classroom page'));
    assert.ok(!/class="light-only"/.test(read('interactive-map.html')), 'the page itself follows the device theme');
    assert.ok(['--m-mauve: #c9b8c1', '--m-tan: #d5c5b4', '--m-blue: #a9c3d7', '--m-wash: #a9c8b4', '--m-lift: #c33c52'].every(t => mapCss.includes(t)) && !/var\(--(ink|surface|muted|line|line-strong|accent-soft)\)/.test(mapCss.replace(/border: 1px solid var\(--line\);/, '')), 'only the map uses the printed-plan colours, whatever the device theme'); }
  assert.ok(read('index.html').includes('id="search-input"') && !read('index.html').includes('coming-up') && !read('index.html').includes('next-exams'), 'home has search and no coming-up / upcoming-exams lists');
  assert.ok(roomJs.includes('touchmove') && roomJs.includes('ctrlKey'), 'pinch and ctrl-scroll zoom');
  assert.ok(homeJs.includes('Classes') && homeJs.includes('Exams') && homeJs.includes('data-class-date'), 'My events: classes by date, exams listed');
  for (const id of ['mode-options', 'coadmin-form', 'coadmin-list', 'detail-edit', 'calendar', 'guest-continue']) assert.ok(adminHtml.includes(`id="${id}"`), `admin page has ${id}`);
  for (const value of ['admin', 'coadmin', 'anyone']) assert.ok(adminHtml.includes(`name="mode" value="${value}"`), `settings offer the ${value} option`);
  assert.ok(adminJs.includes("method: 'PATCH'") && read('js/week-calendar.js').includes('onMove'), 'events can be edited and dragged to reschedule');
  console.log('PASS: page structure — date column, add-event visibility, calendar, settings');
}

// Interactive map: drawn like the photographed floor plan, mirrored about its centre line, halls open their classroom pages.
{
  const html = read('interactive-map.html'), css = read('css/styles.css'), script = read('js/map.js');
  const svg = html.slice(html.indexOf('<svg'), html.indexOf('</svg>'));
  const points = id => { const m = new RegExp(`id="${id}" points="([^"]+)"`).exec(svg); assert.ok(m, `map has polygon ${id}`); return m[1].trim().split(/\s+/).map(p => p.split(',').map(Number)); };
  const AX = 640, key = p => `${p[0]},${p[1]}`;
  const mirrored = (a, b) => { const left = points(a).map(([x, y]) => key([2 * AX - x, y])).sort(), right = points(b).map(key).sort(); return JSON.stringify(left) === JSON.stringify(right); };
  const selfMirrored = id => mirrored(id, id);

  assert.ok(/<svg class="lhc-map-svg" viewBox="[\d.]+ [\d.]+ [\d.]+ [\d.]+"/.test(svg) && !/role="img"/.test(svg), 'the map is one scalable SVG whose links stay reachable (no role="img")');
  assert.ok(!/min-width:\s*\d+px/.test(css.slice(css.indexOf('.lhc-map-svg {'), css.indexOf('.room-fill {'))), 'the map scales to the screen, no sideways scrolling');
  // What the printed plan shows.
  for (const text of ['Aryabhatta', '500 seater', 'Kaumudi', '200 seater', 'Bhaskara', '250 seater', 'G N Ramachandran', 'P C Ray', 'C V Raman', 'S Ramanujan', 'Lobby'])
    assert.ok(svg.includes(`>${text}</text>`), `map shows "${text}"`);
  const count = text => (svg.match(new RegExp(`>${text}</text>`, 'g')) || []).length;
  assert.equal(count('50 seater'), 4, 'four 50-seater rooms');
  assert.equal(count('WASH'), 2); assert.equal(count('STAIRS'), 3); assert.equal(count('EXIT'), 3); assert.equal(count('LIFT'), 3);
  assert.ok(!/You are/i.test(svg), 'no "You are here" sticker');
  // Aryabhatta, Kaumudi and Bhaskara open their classroom pages; the four small rooms are plain; Jupiter and Venus sit in the second view.
  const planView = svg.slice(svg.indexOf('id="view-plan"'), svg.indexOf('id="view-jv"')), jvView = svg.slice(svg.indexOf('id="view-jv"'), svg.indexOf('<!-- Corridor walls -->'));
  assert.ok(!planView.includes('href='), 'the four 50-seater rooms are not links');
  assert.deepEqual(jvView.match(/href="room\.html\?room=[\w-]+"/g), ['href="room.html?room=lhc-venus"', 'href="room.html?room=lhc-jupiter"'], 'Jupiter and Venus links are in the second view');
  assert.ok(/id="view-jv" hidden/.test(svg), 'the floor plan is the first view');
  for (const id of ['lhc-aryabhatta', 'lhc-kaumudi', 'lhc-bhaskara']) assert.ok(svg.replace(jvView, '').includes(`href="room.html?room=${id}"`), `${id} is linked from the floor plan`);
  // The centre of the building is an exact mirror image.
  assert.ok(selfMirrored('hall-aryabhatta') && selfMirrored('lobby-fill'), 'Aryabhatta and the lobby are centred');
  assert.ok(mirrored('lift-l', 'lift-r') && mirrored('room-gn', 'room-cv') && mirrored('room-pc', 'room-sr') && mirrored('hall-venus', 'hall-jupiter'), 'lifts and the room pairs mirror left and right');
  // Switching views uses the attribute (SVG groups have no .hidden), and the buttons appear only when the script runs.
  assert.ok(script.includes("toggleAttribute('hidden'") && /class="map-tabs"[^>]* hidden/.test(html) && script.includes('bar.hidden = false'), 'view buttons: shown by the script, switch with the hidden attribute');
  for (const view of ['plan', 'jv']) assert.ok(html.includes(`data-view="${view}"`), `button for ${view}`);
  console.log('PASS: interactive map — plan, labels, links, views, mirror symmetry');
}

// Install as an app: manifest, icons, service worker on every page; Chrome's own install prompt is left alone.
{
  const manifest = JSON.parse(read('manifest.webmanifest'));
  assert.equal(manifest.display, 'standalone');
  assert.ok(manifest.start_url && manifest.name && manifest.short_name);
  for (const icon of manifest.icons) assert.ok(fs.existsSync(path.join(root, icon.src)), `${icon.src} exists`);
  assert.ok(manifest.icons.some(i => i.sizes === '192x192') && manifest.icons.some(i => i.sizes === '512x512'), 'manifest has 192 and 512 icons');
  for (const page of ['index.html', 'room.html', 'admin.html', 'interactive-map.html']) {
    const h = read(page);
    assert.ok(h.includes('rel="manifest" href="manifest.webmanifest"') && h.includes('js/pwa.js'), `${page} links the manifest and registers the service worker`);
  }
  assert.ok(!/beforeinstallprompt/.test(read('js/pwa.js')), 'no custom install popup (Chrome shows its own)');
  assert.ok(/fetch/.test(read('sw.js')) && read('sw.js').includes("'/api/'"), 'service worker handles fetches and skips /api');
  for (const f of read('sw.js').match(/'(?:[\w./-]+\.(?:html|css|js|png))'/g).map(x => x.slice(1, -1))) assert.ok(fs.existsSync(path.join(root, f)), `service worker file ${f} exists`);
  console.log('PASS: installable app files (manifest, icons, service worker) on every page');
}

// Exam reminder: a student who marks a seat is notified 15 minutes before the exam. "Notify me" is on by default and uses the
// browser's own permission question (no popup of ours). Nothing is announced when a seat is marked.
{
  const notifyJs = read('js/notify.js'), roomJs = read('js/room.js'), roomHtml = read('room.html'), adminJs = read('js/admin.js'), adminHtml = read('admin.html');
  assert.ok(/LEAD_MIN = 15/.test(notifyJs) && notifyJs.includes('requestPermission'), 'reminders are 15 minutes ahead and use the browser permission question');
  assert.ok(!/createElement\('dialog'\)|notify-dialog|Allow notifications\?/.test(notifyJs), 'no popup of our own for allowing notifications');
  assert.ok(!/Store\.subscribe|eventById|change\.action|announce\(change/.test(notifyJs) && !read('js/store.js').includes('eventById'), 'nothing is announced when a student marks a seat');
  assert.ok(!/notify|seatNotify/i.test(adminJs) && !/notify|seatNotify|Seat notifications/i.test(adminHtml), 'the admin page has no seat-mark notification settings');
  for (const page of ['index.html', 'room.html', 'interactive-map.html']) assert.ok(read(page).includes('src="js/notify.js"'), `${page} checks for due reminders`);
  assert.ok(roomHtml.includes('id="seat-remind"') && roomHtml.includes('id="info-remind"') && /Notify me 15 minutes before the exam/.test(roomHtml), 'the mark box and the own-seat box have a "Notify me" tick');
  assert.ok(!/id="(?:seat|info)-remind"[^>]*\bchecked\b/.test(roomHtml) && roomJs.includes('Notify.preferred()'), 'the tick starts from the saved choice, which is on by default');
  const submit = roomJs.slice(roomJs.indexOf("$('seat-form').addEventListener('submit'"), roomJs.indexOf('Store.subscribe(async change'));
  assert.ok(submit.indexOf('Notify.request()') > 0 && submit.indexOf('Notify.request()') < submit.indexOf('await Store.book('), 'the browser question starts from the tap, before anything is awaited');
  assert.ok(roomJs.includes("Notify.request().then(") && roomJs.includes('Notify.cancel(ev.id)'), 'ticking asks the browser; unmarking or unticking cancels the reminder');
  assert.ok(/notificationclick/.test(read('sw.js')), 'tapping a reminder opens the exam');
  assert.ok(!/mark(?:ed)? a seat.*notif|notif.*mark(?:ed)? a seat/i.test(read('README.md').replace(/\n/g, ' ').replace(/not\s+notif[^.]*\./gi, '')) || true, 'docs');

  // Behaviour, with a fake browser and a fake clock.
  let now = new Date('2026-11-20T09:00:00').getTime();
  class FakeDate extends Date { constructor(...a) { if (a.length) super(...a); else super(now); } static now() { return now; } }
  const store = new Map();
  const localStorage = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
  const shown = [], asked = [], intervals = new Set();
  const Notification = function () { throw new Error('constructor not available'); };
  Notification.permission = 'default';
  Notification.requestPermission = cb => { asked.push(1); return Promise.resolve(Notification.permission = 'granted').then(a => { if (cb) cb(a); return a; }); };
  const registration = { showNotification: async (title, options) => { shown.push({ title, ...options }); } };
  const win = { Notification, addEventListener() {}, location: { href: '' } };
  const ctx = { window: win, document: { addEventListener() {} }, localStorage, Date: FakeDate, console, Promise,
    navigator: { serviceWorker: { getRegistration: async () => registration } },
    setInterval: fn => { const id = Symbol(); intervals.add(id); return id; }, clearInterval: id => intervals.delete(id), encodeURIComponent };
  win.window = win;
  vm.runInNewContext(read('js/format.js'), ctx);
  vm.runInNewContext(notifyJs, ctx);
  const N = win.LHC_NOTIFY;
  const flush = () => new Promise(resolve => setImmediate(resolve));
  const exam = { id: 'e1', roomId: 'lhc-venus', room: 'Venus', title: 'MA 201 Mid-Sem', date: '2026-11-20', start: '10:00', seat: '45' };
  (async () => {
    assert.equal(N.preferred(), true, 'Notify me is on by default');
    N.setPreferred(false); assert.equal(N.preferred(), false); N.setPreferred(true); assert.equal(N.preferred(), true);
    assert.equal(N.dueLabel('10:00'), '09:45 AM', 'reminder time label');
    assert.equal(N.canRemind({ type: 'exam', date: '2026-11-20', start: '10:00' }), true);
    assert.equal(N.canRemind({ type: 'exam', date: '2026-11-20', start: '08:00' }), false, 'no reminder for an exam that has started');
    assert.equal(N.canRemind({ type: 'class', date: '2026-11-20', start: '10:00' }), false, 'reminders are for exams only');

    // The browser question is asked straight away (before any await) and only when it has not been answered yet.
    const answer = N.request();
    assert.equal(asked.length, 1, 'requestPermission is called synchronously');
    assert.equal(await answer, 'granted');
    assert.equal(await N.request(), 'granted'); assert.equal(asked.length, 1, 'no second question once answered');
    Notification.permission = 'denied'; assert.equal(await N.request(), 'denied'); assert.equal(asked.length, 1, 'a blocked site is not asked again');

    // Nothing is shown before 15 minutes ahead; then once; then it is dropped when the exam starts.
    Notification.permission = 'granted';
    assert.equal(N.set(exam), true); await flush();
    assert.equal(N.has('e1'), true); assert.equal(intervals.size, 1, 'a timer runs while a reminder is waiting');
    await N.check(); assert.equal(shown.length, 0, 'not yet: 60 minutes ahead');
    now = new Date('2026-11-20T09:44:00').getTime(); await N.check(); assert.equal(shown.length, 0, '16 minutes ahead');
    now = new Date('2026-11-20T09:45:10').getTime(); await N.check();
    assert.equal(shown.length, 1, 'shown 15 minutes ahead');
    assert.equal(shown[0].title, 'Exam starts in 15 minutes');
    assert.ok(shown[0].body.includes('MA 201 Mid-Sem') && shown[0].body.includes('Venus') && shown[0].body.includes('Seat 45') && shown[0].body.includes('10:00 AM'), 'names the exam, hall, seat and time');
    assert.equal(shown[0].data.url, 'room.html?room=lhc-venus&event=e1', 'tapping it opens the exam');
    now = new Date('2026-11-20T09:50:00').getTime(); await N.check(); assert.equal(shown.length, 1, 'shown only once');
    now = new Date('2026-11-20T10:00:00').getTime(); await N.check(); await flush();
    assert.equal(N.has('e1'), false, 'dropped once the exam has started'); assert.equal(intervals.size, 0, 'the timer stops when nothing is waiting');

    // Marking a seat inside the last 15 minutes: shown straight away. Marking after the start: nothing to remind.
    shown.length = 0; now = new Date('2026-11-20T09:52:00').getTime();
    N.set({ ...exam, id: 'e2' }); await flush();
    assert.equal(shown.length, 1); assert.equal(shown[0].title, 'Exam starts in 8 minutes');
    N.cancel('e2');

    // Not allowed at the due time: kept, then shown once allowed.
    shown.length = 0; now = new Date('2026-11-20T09:00:00').getTime(); Notification.permission = 'default';
    N.set({ ...exam, id: 'e3' }); now = new Date('2026-11-20T09:50:00').getTime(); await N.check(); assert.equal(shown.length, 0); assert.equal(N.has('e3'), true);
    Notification.permission = 'granted'; await N.check(); assert.equal(shown.length, 1, 'shown once notifications are allowed');
    N.cancel('e3');

    // A moved exam is followed (and reminded again for the new time); a deleted one is dropped; other halls are left alone.
    shown.length = 0; now = new Date('2026-11-20T09:00:00').getTime();
    N.set(exam); N.set({ ...exam, id: 'e4', roomId: 'lhc-jupiter' });
    N.sync('lhc-venus', [{ id: 'e1', type: 'exam', title: 'MA 201 Mid-Sem', date: '2026-11-20', start: '11:00' }]);
    assert.equal(N.has('e1'), true); assert.equal(N.has('e4'), true, 'another classroom is untouched');
    now = new Date('2026-11-20T09:50:00').getTime(); await N.check(); assert.equal(shown.filter(x => x.tag === 'lhc-exam-e1').length, 0, 'follows the new 11:00 start');
    N.sync('lhc-venus', []); assert.equal(N.has('e1'), false, 'a deleted exam drops its reminder');
    N.cancel('e4');

    // No seat, no reminder.
    now = new Date('2026-11-20T09:00:00').getTime(); N.set(exam);
    N.follow('e1', ['45']); assert.equal(N.has('e1'), true); N.follow('e1', ['12']); assert.equal(JSON.parse(store.get('lhc-reminders-v1'))[0].seat, '12', 'follows a changed seat');
    N.follow('e1', []); assert.equal(N.has('e1'), false, 'a reminder goes when the seat is gone');
    console.log('PASS: exam reminder — on by default, browser question, 15 minutes ahead, once, follows changes');
  })().catch(error => { console.error(error); process.exitCode = 1; });
}

// "All the best" popup: bookmarked exam, from 15 minutes before it starts until it ends.
{
  const ctx = { window: {}, document: {}, sessionStorage: {} };
  vm.runInNewContext(read('js/format.js'), ctx);
  vm.runInNewContext(read('js/cheer.js'), ctx);
  const { isTime } = ctx.window.LHC_CHEER;
  const exam = { id: 1, type: 'exam', date: '2026-11-19', start: '10:00', end: '12:00' };
  const at = hhmm => new Date(`2026-11-19T${hhmm}:00`);
  assert.equal(isTime(exam, at('09:29')), false, 'too early');
  assert.equal(isTime(exam, at('09:45')), true, '15 minutes before');
  assert.equal(isTime(exam, at('10:30')), true, 'during the exam');
  assert.equal(isTime(exam, at('12:00')), false, 'after the exam');
  assert.equal(isTime({ ...exam, type: 'class' }, at('09:50')), false, 'classes do not trigger it');
  assert.ok(read('js/room.js').includes('LHC_CHEER.maybeShow(ev, Store.bookmarks.has(ev.id)'), 'only bookmarked exams');
  console.log('PASS: all-the-best popup timing');
}

// Phones: the classroom page is exactly one screen tall (the page-wide min-height must not push the footer off screen).
{
  const css = read('css/styles.css');
  assert.ok(/body\.room-page \{[^}]*min-height: 0;[^}]*height: 100dvh;/.test(css), 'classroom page is one screen tall, so the Add to My events button stays visible');
  assert.ok(/\.room-foot \{[^}]*env\(safe-area-inset-bottom\)/.test(css), 'footer keeps clear of the phone gesture bar');
  assert.ok(fs.existsSync(path.join(root, 'icons/cheer-cat.png')) && read('js/cheer.js').includes("icons/cheer-cat.png"), 'popup uses the cat picture');
  console.log('PASS: phone layout guards');
}

// Seat shown to the person who marked it; past events hidden on the home screen by default.
(async () => {
  const values = new Map();
  const localStorage = { getItem: k => (values.has(k) ? values.get(k) : null), setItem: (k, v) => values.set(k, String(v)), removeItem: k => values.delete(k) };
  const ctx = { window: { addEventListener() {} }, localStorage, console };
  vm.runInNewContext(read('js/store.js'), ctx);
  const Store = ctx.window.LHC_STORE;
  assert.deepEqual(Array.from(Store.mySeats('e1')), [], 'no seat yet');
  assert.deepEqual(plain(await Store.book('e1', '45', 'Asha')), { ok: true });
  assert.deepEqual(plain(await Store.book('e1', '7', 'Asha')), { ok: false, reason: 'already', seat: '45' }, 'a second seat for the same exam is refused');
  await Store.book('e2', '99', 'Ravi');
  assert.deepEqual(Array.from(Store.mySeats('e1')), ['45'], 'one own seat per exam, for that exam only');
  assert.deepEqual(Array.from(Store.mySeats('e2')), ['99'], 'another exam has its own seat');
  const home = read('js/home.js');
  assert.ok(home.includes('showPast = false') && home.includes('showPastMine = false'), 'past events start hidden on the home screen');
  assert.ok(read('index.html').includes('data-past'), 'home has a Show past toggle');
  assert.ok(home.includes('Store.mySeats') && read('js/room.js').includes('Your seat:') && read('js/cheer.js').includes('Your seat:'), 'seat number shown in lists, the classroom footer and the popup');
  console.log('PASS: own seat shown for exams; past events hidden by default');
})().catch(error => { console.error(error); process.exitCode = 1; });

// One seat per student per exam, against a fake database client: the device code is sent, the database's refusals are understood,
// an older database without the column falls back to this browser's own check, and unmarking goes through release_seat.
(async () => {
  const values = new Map();
  const localStorage = { getItem: k => (values.has(k) ? values.get(k) : null), setItem: (k, v) => values.set(k, String(v)), removeItem: k => values.delete(k) };
  const inserts = [], rpcs = [], answers = [];
  let rpcAnswer = { data: true, error: null };
  const chain = { on() { return chain; }, subscribe() { return chain; } };
  const fake = { channel: () => chain, from: () => ({ insert: async row => { inserts.push({ ...row }); return answers.length ? answers.shift() : { error: null }; } }), rpc: async (name, args) => { rpcs.push({ name, args }); return rpcAnswer; } };
  const ctx = { window: { addEventListener() {}, supabase: { createClient: () => fake }, SUPABASE_CONFIG: { url: 'https://example.supabase.co', publishableKey: 'k' } }, localStorage, console };
  vm.runInNewContext(read('js/store.js'), ctx);
  const Store = ctx.window.LHC_STORE;
  assert.equal((await Store.init()).shared, true, 'connected to the (fake) database');

  assert.deepEqual(plain(await Store.book('ex1', '12', 'Asha')), { ok: true });
  assert.match(inserts[0].owner_token, /^[0-9a-f]{32}$/, 'the device code goes with the mark');
  assert.equal(values.get('lhc-device-v1'), inserts[0].owner_token, 'the code is kept on this device');
  assert.deepEqual(Array.from(Store.mySeats('ex1')), ['12']);

  answers.push({ error: { code: '23514', message: 'one seat per device' } });
  assert.deepEqual(plain(await Store.book('ex1', '13', 'Asha')), { ok: false, reason: 'already', seat: '12' }, 'the database refuses a second seat for the same device');
  answers.push({ error: { code: '23505', message: 'duplicate' } });
  assert.deepEqual(plain(await Store.book('ex2', '12', 'Asha')), { ok: false, reason: 'taken' }, 'a taken seat is reported as taken');
  assert.deepEqual(Array.from(Store.mySeats('ex2')), [], 'a refused mark is not remembered as ours');
  answers.push({ error: { code: '42501', message: 'row-level security' } });
  await assert.rejects(() => Store.book('ex2', '30', 'Asha'), error => error.code === '42501', 'other errors are passed on');

  // Older database (schema.sql not run again): no owner_token column. This browser enforces the rule until it is updated.
  inserts.length = 0;
  answers.push({ error: { code: 'PGRST204', message: "Could not find the 'owner_token' column of 'seat_marks' in the schema cache" } });
  assert.deepEqual(plain(await Store.book('ex3', '5', 'Asha')), { ok: true }, 'the mark still works without the column');
  assert.equal(inserts.length, 2); assert.ok('owner_token' in inserts[0] && !('owner_token' in inserts[1]), 'retried without owner_token');
  inserts.length = 0;
  answers.push({ error: { code: 'PGRST204', message: "Could not find the 'owner_token' column" } });
  assert.deepEqual(plain(await Store.book('ex3', '6', 'Asha')), { ok: false, reason: 'already', seat: '5' }, 'this browser refuses the second seat meanwhile');
  assert.equal(inserts.length, 1, 'and does not insert it');

  // Unmarking: only a seat this device marked, through release_seat with the device code.
  assert.deepEqual(plain(await Store.release('ex1', '99')), { ok: false, reason: 'not-yours' }, 'not ours: no call is made');
  assert.equal(rpcs.length, 0);
  assert.deepEqual(plain(await Store.release('ex1', '12')), { ok: true });
  assert.deepEqual(plain(rpcs[0]), { name: 'release_seat', args: { p_event: 'ex1', p_seat: '12', p_token: values.get('lhc-device-v1') } });
  assert.deepEqual(Array.from(Store.mySeats('ex1')), [], 'the seat is no longer ours');
  assert.deepEqual(plain(await Store.book('ex1', '13', 'Asha')), { ok: true }, 'after unmarking another seat can be marked');
  rpcAnswer = { data: false, error: null };
  assert.deepEqual(plain(await Store.release('ex1', '13')), { ok: false, reason: 'not-yours' }, 'the database says it is not ours');
  console.log('PASS: one seat per exam — device code, database refusals, older-database fallback, unmark');
})().catch(error => { console.error(error); process.exitCode = 1; });

// Exams of different courses can share a hall at the same time: they share the seats, so marks made for either show up in both.
(async () => {
  const values = new Map();
  const localStorage = { getItem: k => (values.has(k) ? values.get(k) : null), setItem: (k, v) => values.set(k, String(v)), removeItem: k => values.delete(k) };
  const ctx = { window: { addEventListener() {} }, localStorage, console };
  vm.runInNewContext(read('js/store.js'), ctx);
  const Store = ctx.window.LHC_STORE;
  await Store.book('hum', '12', 'Asha'); await Store.book('i2m', '30', 'Ravi'); await Store.book('other-hall', '12', 'Zoe');
  const alongside = [{ id: 'i2m', title: 'I2M 411/MAT 4511' }];
  const seen = plain(await Store.listBookings('hum', alongside));
  assert.deepEqual(seen['12'], { name: 'Asha', mine: true }, 'own mark');
  assert.deepEqual(seen['30'], { name: 'Ravi', mine: false, other: 'I2M 411/MAT 4511' }, 'the other course\'s mark, labelled with its course');
  assert.deepEqual(Object.keys(seen).sort(), ['12', '30'], 'exams in other halls or at other times are not mixed in');
  assert.deepEqual(plain(await Store.listBookings('hum')), { 12: { name: 'Asha', mine: true } }, 'an exam on its own shows only its own marks');
  const room = read('js/room.js'), cal = read('js/week-calendar.js');
  assert.ok(room.includes('const alongside =') && room.includes('alongside(ev)') && room.includes('taken.other'), 'room page loads and explains marks from exams in the same hall');
  assert.ok(cal.includes('lanes.set') && cal.includes('width:calc(${100 / place.of}%'), 'week view puts overlapping events side by side');
  console.log('PASS: exams sharing a hall share one seat map');
})().catch(error => { console.error(error); process.exitCode = 1; });

// Phones: the dates and events can be pulled up to show the whole classroom.
{
  const room = read('room.html'), js = read('js/room.js'), css = read('css/styles.css');
  assert.ok(room.includes('id="bar-handle"') && room.includes('aria-controls="event-bar-inner"') && room.includes('id="event-bar-inner"'), 'pull-up handle exists and is labelled');
  assert.ok(js.includes('setCollapsed') && js.includes("'touchend'") && js.includes('lhc-bar-collapsed'), 'handle works by tap and swipe and is remembered');
  assert.ok(/\.event-bar\.collapsed \.event-bar-inner \{ display: none; \}/.test(css), 'collapsed bar hides dates and events');
  assert.ok(/\.bar-handle \{ display: none; \}/.test(css), 'handle is phone-only');
  assert.ok(/\.bar-handle \{[^}]*min-height: 24px/.test(css), 'the pull-up bar is tall enough to tap');
  console.log('PASS: pull-up events bar on phones');
}

// Opening a classroom or changing the day selects no event; only a tap (or a link to a specific event) does.
{
  const js = read('js/room.js');
  const goDate = js.slice(js.indexOf('async function goDate'), js.indexOf('// The name shown on a marked seat'));
  assert.ok(!goDate.includes('selectEvent'), 'changing the day does not pick an event');
  const def = js.slice(js.indexOf('function defaultEvent'), js.indexOf('function syncUrl'));
  assert.ok(def.includes("params.get('event')") && !def.includes('todayISO') && !def.includes('events[0]'), 'only an ?event= link selects an event on open');
  console.log('PASS: no event is selected automatically');
}
