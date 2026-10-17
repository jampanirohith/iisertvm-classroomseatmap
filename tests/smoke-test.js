'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert/strict');

const root = path.join(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const plain = v => JSON.parse(JSON.stringify(v));   // values from the vm sandbox have a different Array prototype

// Every script parses.
for (const f of ['js/data.js', 'js/store.js', 'js/room.js', 'js/home.js', 'js/map.js', 'js/theme.js', 'supabase/config.js']) new vm.Script(read(f), { filename: f });

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
const pages = ['index.html', 'room.html', 'interactive-map.html'];
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
for (const f of [...pages, 'css/styles.css', 'js/data.js', 'js/store.js', 'js/room.js', 'js/home.js', 'js/map.js', 'js/theme.js', 'README.md', 'supabase/schema.sql', 'supabase/seed.sql']) {
  assert.ok(!banned.test(read(f)), `${f}: no leftover working-draft wording`);
}
const roomPage = read('room.html');
const roomScript = read('js/room.js');
assert.ok(roomScript.includes('ev.start < prev.end && ev.end > prev.start'), 'event overlap validation');
assert.ok(roomScript.includes("if (!ev || ev.type !== 'exam')"), 'seat marking is limited to exam events');
assert.ok(roomScript.includes('Seat marking is available for exams only'), 'class events explain why seats cannot be marked');
assert.ok(!roomScript.includes('Enter the professor for a class'), 'professor name is optional for classes');
assert.ok(roomPage.includes('Professor (optional)'), 'professor field is labeled optional');
assert.ok(roomPage.includes('Mark your seat') && roomPage.includes('Mark my seat'), 'exam seat UI uses marking language');
assert.ok(roomPage.includes('Name (optional)') && roomPage.includes('Roll number (optional)'), 'name and roll number are independently optional');
assert.ok(roomScript.includes('Enter your name, roll number, or both.'), 'at least one identity field must be entered');
assert.ok(!roomPage.includes('event-repeat') && !roomScript.includes('Recurrence'), 'recurring-event controls are removed');
assert.ok(read('css/styles.css').includes('--bg: #080808'), 'dark mode uses neutral black');
assert.ok(schema.includes('events_no_overlap_per_room'), 'database enforces event overlap prevention');
assert.ok(schema.includes('private.event_owners') && schema.includes('private.seat_mark_owners'), 'private token hashes are kept out of public tables');
assert.ok(schema.includes('mark_exam_seat') && schema.includes('validate_exam_seat_mark'), 'database functions enforce exam-only marks');
assert.ok(schema.includes('seat_mark_owners_unique_roll_per_exam'), 'database enforces unique roll number per exam in the private schema');
assert.ok(schema.includes('revoke all on table public.rooms, public.room_seats, public.events, public.seat_marks'), 'direct public writes are revoked');
assert.ok(fs.existsSync(path.join(root, 'supabase/verify.sql')), 'database verification SQL exists');
assert.ok(!fs.existsSync(path.join(root, 'js/recurrence.js')), 'obsolete recurrence helper removed');
console.log('PASS: classrooms, layouts, database safeguards, pages, optional identity fields and no-recurring-events rule');


// Local-storage fallback: one-off events, overlap rejection, exam-only seat marks, and creator deletion.
(async () => {
  const values = new Map();
  const localStorage = {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
  const storeContext = { window: { addEventListener() {} }, localStorage, console, TextEncoder };
  vm.runInNewContext(read('js/store.js'), storeContext);
  const store = storeContext.window.LHC_STORE;
  const status = await store.init();
  assert.equal(status.shared, false);
  const exam = await store.addEvent('test-room', { title: 'Midterm', type: 'exam', date: '2026-10-19', start: '10:00', end: '11:00', professor: '', note: '' });
  assert.equal(exam.professor, '');
  await assert.rejects(() => store.addEvent('test-room', { title: 'Conflict', type: 'class', date: '2026-10-19', start: '10:30', end: '11:30' }), /overlaps/);
  const parallel = await store.addEvent('different-room', { title: 'Concurrent lecture', type: 'class', date: '2026-10-19', start: '10:00', end: '11:00' });
  assert.ok(parallel.id);
  await assert.rejects(() => store.book(parallel.id, '1', 'Student', ''), /exam events only/);
  assert.equal((await store.book(exam.id, '12', '', 'R001')).ok, true, 'roll number alone is allowed');
  assert.equal((await store.book(exam.id, '12', 'Another', 'R002')).ok, false, 'taken seat is rejected');
  assert.equal(Object.keys(await store.listBookings(exam.id)).length, 1);
  assert.equal(store.canDelete(exam), true, 'creator browser may delete its event');
  await store.releaseSeat(exam.id, '12');
  assert.equal(Object.keys(await store.listBookings(exam.id)).length, 0);
  await store.deleteEvent(exam);
  assert.equal((await store.listEvents('test-room')).length, 0);
  console.log('PASS: local fallback event conflicts, optional identity, seat release and owner deletion');
})().catch(error => { console.error(error); process.exitCode = 1; });
