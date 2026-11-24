'use strict';
// A tiny in-memory stand-in for the Supabase REST API (PostgREST), enough for the Cloudflare functions.
// Used by api-test.js and dev-server.js. It replaces globalThis.fetch for requests to the fake project URL.
const URL_BASE = 'https://fake-project.supabase.co';
const realFetch = globalThis.fetch;
const nodeCrypto = require('crypto');
// Same fingerprint the database computes: sha256 of "code:eventId", hex.
const fingerprint = (token, eventId) => nodeCrypto.createHash('sha256').update(`${token}:${eventId}`).digest('hex');

function install() {
  const tables = { events: [], coadmins: [], app_settings: [], seat_marks: [] };
  // Every change to events and seat marks, in order: the dev server hands these to browsers as "live updates".
  const changes = [];
  const record = (table, eventType, row, old) => { if (table === 'events' || table === 'seat_marks') changes.push({ id: changes.length + 1, table, eventType, new: row ? { ...row } : null, old: old ? { ...old } : null }); };
  const unique = { coadmins: ['email'], app_settings: ['key'], seat_marks: ['event_id', 'seat_id'] };

  const matches = (row, key, value) => {
    const [op, ...rest] = value.split('.');
    const want = rest.join('.');
    if (op === 'eq') return String(row[key]) === want;
    if (op === 'gte') return String(row[key]) >= want;
    if (op === 'lte') return String(row[key]) <= want;
    if (op === 'in') return want.replace(/^\(|\)$/g, '').split(',').includes(String(row[key]));
    return true;
  };

  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    if (url.origin !== URL_BASE) return realFetch(input, init);
    const table = url.pathname.replace('/rest/v1/', '');
    const jsonOut = (data, status = 200) => new Response(data === undefined ? '' : JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
    if (table === 'rpc/release_seat') {   // supabase/schema.sql: release_seat(p_event, p_seat, p_token)
      const args = JSON.parse(init.body || '{}');
      if (tables.app_settings.some(r => r.key === 'seat_marking' && r.value === 'off')) return jsonOut({ code: '22023', message: 'Seat marking is turned off' }, 400);
      if (!args.p_token || String(args.p_token).length < 16) return jsonOut(false);
      const hit = tables.seat_marks.find(r => r.event_id === args.p_event && r.seat_id === args.p_seat && r.owner_hash === fingerprint(args.p_token, args.p_event));
      if (!hit) return jsonOut(false);
      tables.seat_marks.splice(tables.seat_marks.indexOf(hit), 1);
      record('seat_marks', 'DELETE', null, hit);
      return jsonOut(true);
    }
    const rows = tables[table];
    if (!rows) return new Response(JSON.stringify({ message: `relation ${table} does not exist` }), { status: 404 });
    const method = (init.method || 'GET').toUpperCase();
    const prefer = (init.headers && init.headers.Prefer) || '';
    const filters = [];
    for (const [key, value] of url.searchParams) {
      if (['select', 'order', 'limit', 'offset', 'on_conflict'].includes(key)) continue;
      if (key === 'and') value.slice(1, -1).split(',').forEach(part => { const [col, ...r] = part.split('.'); filters.push([col, r.join('.')]); });
      else filters.push([key, value]);
    }
    const selected = () => rows.filter(row => filters.every(([k, v]) => matches(row, k, v)));
    const project = list => {
      const cols = (url.searchParams.get('select') || '*').split(',');
      return list.map(row => (cols.includes('*') ? { ...row } : Object.fromEntries(cols.map(c => [c, row[c]]))));
    };
    const json = (data, status = 200) => new Response(data === undefined ? '' : JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
    const wantsRows = prefer.includes('return=representation');

    if (method === 'GET') {
      let list = selected();
      const order = url.searchParams.get('order');
      if (order) for (const part of order.split(',').reverse()) { const [col, dir] = part.split('.'); list.sort((a, b) => String(a[col]).localeCompare(String(b[col])) * (dir === 'desc' ? -1 : 1)); }
      list = list.slice(Number(url.searchParams.get('offset')) || 0);
      const limit = Number(url.searchParams.get('limit'));
      if (limit) list = list.slice(0, limit);
      return json(project(list));
    }
    if (method === 'POST') {
      const body = JSON.parse(init.body);
      const added = [];
      for (const item of body) {
        if (table === 'seat_marks') {   // what the seat_marks_guard trigger does
          const exam = tables.events.find(e => e.id === item.event_id);
          if (!exam || exam.event_type !== 'exam') return json({ code: '22023', message: 'Seats can only be marked for exams' }, 400);
          if (tables.app_settings.some(r => r.key === 'seat_marking' && r.value === 'off')) return json({ code: '22023', message: 'Seat marking is turned off' }, 400);
          if ('owner_token' in item && !('owner_hash' in item)) {
            const token = item.owner_token;
            item.owner_hash = null;
            if (token) {
              item.owner_hash = fingerprint(token, item.event_id);
              if (rows.some(r => r.event_id === item.event_id && r.owner_hash === item.owner_hash)) return json({ code: '23514', message: 'You have already marked a seat for this exam' }, 400);
            }
            delete item.owner_token;
          }
        }
        const keys = unique[table];
        const existing = keys && rows.find(r => keys.every(k => r[k] === item[k]));
        if (existing && prefer.includes('merge-duplicates')) { Object.assign(existing, item); added.push(existing); continue; }
        if (existing) return json({ code: '23505', message: 'duplicate key value' }, 409);
        const row = { ...item };
        if (table !== 'app_settings') { row.id = crypto.randomUUID(); row.created_at = new Date().toISOString(); }
        rows.push(row); added.push(row);
        record(table, 'INSERT', row);
      }
      return wantsRows ? json(project(added), 201) : json(undefined, 201);
    }
    if (method === 'PATCH') {
      const list = selected();
      const patch = JSON.parse(init.body);
      list.forEach(row => { const before = { ...row }; Object.assign(row, patch); record(table, 'UPDATE', row, before); });
      return wantsRows ? json(project(list)) : json(undefined, 204);
    }
    if (method === 'DELETE') {
      const list = selected();
      list.forEach(row => { rows.splice(rows.indexOf(row), 1); record(table, 'DELETE', null, row); });
      return wantsRows ? json(project(list)) : json(undefined, 204);
    }
    return json({ message: 'unsupported' }, 400);
  };
  return { tables, changes, env: { SUPABASE_URL: URL_BASE, SUPABASE_SECRET_KEY: 'sb_secret_fake', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fake', ADMIN_PASSWORD: 'correct horse battery staple' } };
}
module.exports = { install, URL_BASE };
