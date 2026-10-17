'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto');
const { TextEncoder } = require('node:util');

const root = path.join(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}

function createFakeBackend() {
  const db = { events: [], marks: [], eventOwners: new Map(), markOwners: new Map(), seq: 1 };
  const client = {
    channel() {
      const channel = { on() { return channel; }, subscribe() { return channel; } };
      return channel;
    },
    from(table) {
      const filters = [];
      const orders = [];
      const query = {
        select() { return query; },
        eq(column, value) { filters.push([column, value]); return query; },
        order(column) { orders.push(column); return query; },
        then(resolve, reject) {
          const source = table === 'seat_marks' ? db.marks : (db[table] || []);
          let rows = source.filter(row => filters.every(([column, value]) => String(row[column]) === String(value)));
          rows = rows.map(row => ({ ...row }));
          for (const column of orders.slice().reverse()) rows.sort((a, b) => String(a[column]).localeCompare(String(b[column])));
          return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
        }
      };
      return query;
    },
    async rpc(name, args) {
      if (name === 'create_event') {
        if (db.events.some(e => e.room_id === args.p_room_id && e.event_date === args.p_event_date && args.p_start_time < e.end_time && args.p_end_time > e.start_time)) {
          return { data: null, error: { code: '23P01', message: 'overlap' } };
        }
        const id = `00000000-0000-4000-8000-${String(db.seq++).padStart(12, '0')}`;
        const row = {
          id, room_id: args.p_room_id, title: args.p_title, event_type: args.p_event_type,
          event_date: args.p_event_date, start_time: args.p_start_time, end_time: args.p_end_time,
          status: 'OPEN', professor: args.p_professor, description: args.p_description, created_at: new Date().toISOString()
        };
        db.events.push(row);
        db.eventOwners.set(id, args.p_owner_token_hash);
        return { data: [row], error: null };
      }
      if (name === 'delete_event') {
        if (db.eventOwners.get(args.p_event_id) !== args.p_owner_token_hash) return { data: false, error: null };
        db.events = db.events.filter(e => e.id !== args.p_event_id);
        db.eventOwners.delete(args.p_event_id);
        const removedMarks = db.marks.filter(m => m.event_id === args.p_event_id);
        db.marks = db.marks.filter(m => m.event_id !== args.p_event_id);
        for (const mark of removedMarks) db.markOwners.delete(mark.id);
        return { data: true, error: null };
      }
      if (name === 'mark_exam_seat') {
        const event = db.events.find(e => e.id === args.p_event_id);
        if (!event || event.event_type !== 'exam' || event.status !== 'OPEN') return { data: null, error: { code: '23514', message: 'exam events only' } };
        if (!args.p_display_name && !args.p_roll_number) return { data: null, error: { code: '22023', message: 'name or roll required' } };
        if (db.marks.some(m => m.event_id === args.p_event_id && m.seat_id === args.p_seat_id)) return { data: 'seat_taken', error: null };
        if (args.p_roll_number && db.marks.some(m => { const owner = db.markOwners.get(m.id); return m.event_id === args.p_event_id && owner && owner.rollNumber && owner.rollNumber.trim().toLowerCase() === args.p_roll_number.trim().toLowerCase(); })) return { data: 'roll_taken', error: null };
        if (db.marks.some(m => { const owner = db.markOwners.get(m.id); return m.event_id === args.p_event_id && owner && owner.markerTokenHash === args.p_marker_token_hash; })) return { data: 'already_marked', error: null };
        const id = `mark-${db.seq++}`;
        db.marks.push({ id, event_id: args.p_event_id, seat_id: args.p_seat_id, display_name: args.p_display_name });
        db.markOwners.set(id, { markerTokenHash: args.p_marker_token_hash, rollNumber: args.p_roll_number });
        return { data: 'ok', error: null };
      }
      if (name === 'release_exam_seat') {
        const mark = db.marks.find(m => { const owner = db.markOwners.get(m.id); return m.event_id === args.p_event_id && owner && owner.markerTokenHash === args.p_marker_token_hash; });
        if (!mark) return { data: false, error: null };
        db.marks = db.marks.filter(m => m.id !== mark.id);
        db.markOwners.delete(mark.id);
        return { data: true, error: null };
      }
      throw new Error(`Unexpected RPC: ${name}`);
    }
  };
  return { db, client };
}

function makeStore(fakeClient, storage) {
  const context = {
    window: {
      SUPABASE_CONFIG: { url: 'https://unit-test.supabase.co', publishableKey: 'sb_publishable_test' },
      supabase: { createClient() { return fakeClient; } },
      crypto: webcrypto,
      addEventListener() {}
    },
    localStorage: storage,
    TextEncoder,
    console
  };
  vm.runInNewContext(read('js/store.js'), context, { filename: 'js/store.js' });
  return context.window.LHC_STORE;
}

(async () => {
  const { db, client } = createFakeBackend();
  const storeA = makeStore(client, memoryStorage());
  const storeB = makeStore(client, memoryStorage());
  assert.equal((await storeA.init()).shared, true);
  assert.equal((await storeB.init()).shared, true);

  const exam = await storeA.addEvent('lhc-kaumudi', {
    title: 'Chemistry Exam', type: 'exam', date: '2026-10-19', start: '10:00', end: '11:00', professor: '', note: ''
  });
  assert.ok(exam.id);
  assert.equal(exam.professor, '');
  assert.equal(storeA.canDelete(exam), true);
  assert.equal(storeB.canDelete(exam), false, 'another browser must not receive the creator delete permission');

  assert.equal((await storeA.book(exam.id, '1', '', 'CH-001')).ok, true, 'roll-only marks work in shared mode');
  const duplicateRoll = await storeB.book(exam.id, '2', 'Other Name', 'ch-001');
  assert.deepEqual({ ok: duplicateRoll.ok, reason: duplicateRoll.reason }, { ok: false, reason: 'roll_taken' });
  assert.equal((await storeB.book(exam.id, '2', 'Same Name', '')).ok, true, 'duplicate names are not globally blocked');
  assert.equal(Object.keys(await storeA.listBookings(exam.id)).length, 2);
  assert.equal(await storeA.releaseSeat(exam.id, '1'), true);
  assert.equal(Object.keys(await storeA.listBookings(exam.id)).length, 1);

  const cls = await storeA.addEvent('lhc-kaumudi', {
    title: 'Lecture', type: 'class', date: '2026-10-19', start: '11:00', end: '12:00', professor: '', note: ''
  });
  await assert.rejects(() => storeA.book(cls.id, '3', 'Student', ''), /exam events only/);
  await assert.rejects(() => storeA.addEvent('lhc-kaumudi', {
    title: 'Overlap', type: 'class', date: '2026-10-19', start: '10:30', end: '11:30'
  }), /overlaps/);
  await assert.rejects(() => storeA.addEvent('lhc-kaumudi', {
    title: 'Overlapping other event', type: 'class', date: '2026-10-19', start: '10:45', end: '11:15'
  }), /overlaps/);
  assert.equal((await storeB.addEvent('lhc-venus', {
    title: 'Same time, different room', type: 'class', date: '2026-10-19', start: '10:00', end: '11:00'
  })).roomId, 'lhc-venus');

  await assert.rejects(() => storeB.deleteEvent(exam), /private owner key/);
  await storeA.deleteEvent(exam);
  assert.equal(db.events.some(e => e.id === exam.id), false);
  assert.equal(db.marks.some(m => m.event_id === exam.id), false);

  console.log('PASS: mocked Supabase contract — owner-only deletion, one-off/non-overlap events, exam-only marks, roll uniqueness, duplicate names, release flow');
})().catch(error => { console.error(error); process.exitCode = 1; });
