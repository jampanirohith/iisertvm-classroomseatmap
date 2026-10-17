'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert/strict');

const root = path.join(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const plain = v => JSON.parse(JSON.stringify(v));   // values from the vm sandbox have a different Array prototype

// Every script parses.
for (const f of ['js/data.js', 'js/store.js', 'js/room.js', 'js/home.js', 'js/map.js', 'js/theme.js', 'js/recurrence.js', 'supabase/config.js']) new vm.Script(read(f), { filename: f });

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
// Venus has seat 1 at the audience's right; Jupiter is its mirror image.
for (const [id, seatOneOn, door] of [['lhc-jupiter', 'left', 'left'], ['lhc-venus', 'right', 'right']]) {
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
  // The two halls are exact mirror images of each other.
  const j = rooms.find(r => r.id === 'lhc-jupiter').layout.rows, v = rooms.find(r => r.id === 'lhc-venus').layout.rows;
  j.forEach((row, i) => assert.deepEqual(row.seats, v[i].seats.slice().reverse()));
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
for (const table of ['rooms', 'events', 'seat_marks']) assert.ok(schema.includes(`create table if not exists public.${table}`), `schema creates ${table}`);

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
for (const f of [...pages, 'css/styles.css', 'js/data.js', 'js/store.js', 'js/room.js', 'js/home.js', 'js/map.js', 'js/theme.js', 'js/recurrence.js', 'README.md', 'supabase/schema.sql', 'supabase/seed.sql']) {
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
assert.ok(read('functions/api/admin/events.js').includes('event.start_time < previous.end_time && event.end_time > previous.start_time'), 'server-side event overlap validation');
assert.ok(roomScript.includes("if (!ev || ev.type !== 'exam')"), 'seat marking is limited to exam events');
assert.ok(roomScript.includes('Seat marking is available for exams only'), 'class events explain why seats cannot be marked');
assert.ok(!roomScript.includes('Enter the professor for a class'), 'professor name is optional for classes');
assert.ok(read('admin.html').includes('Professor (optional)'), 'professor field is labeled optional in the admin form');
assert.ok(roomPage.includes('Mark your seat') && roomPage.includes('Mark my seat'), 'exam seat UI uses marking language');
assert.ok(!roomPage.includes('Book seat'), 'seat dialog does not use booking language');
assert.ok(read('css/styles.css').includes('--bg: #080808'), 'dark mode uses neutral black');
for (const id of ['event-repeat', 'event-repeat-mode', 'event-repeat-until', 'repeat-days-wrap']) assert.ok(read('admin.html').includes(`id="${id}"`), `admin recurrence control ${id}`);
for (const script of ['js/theme.js', 'js/recurrence.js']) assert.ok(fs.existsSync(path.join(root, script)), `${script} exists`);
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
assert.ok(eventFn.includes('env.SUPABASE_SECRET_KEY'), 'privileged database key is only read in server function code');
assert.ok(eventFn.includes('isAdmin(request, env)'), 'admin event APIs require a valid admin session');
assert.ok(!read('supabase/schema.sql').includes('create policy "events public insert"'), 'browser clients cannot create events through RLS');
assert.ok(read('supabase/schema.sql').includes('revoke insert, update, delete on table public.events'), 'direct browser event writes are revoked');
assert.ok(read('js/room.js').includes('admin.html?room='), 'classroom event-strip link opens the admin page for that room');
assert.ok(read('css/styles.css').includes('grid-template-columns: repeat(3, minmax(0, 1fr))'), 'mobile homepage grid has 3 columns for two rows of rooms');
console.log('PASS: Cloudflare runtime config, admin session security, admin-only event writes and mobile room grid');
