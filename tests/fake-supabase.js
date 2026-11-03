'use strict';
// A tiny in-memory stand-in for the Supabase REST API (PostgREST), enough for the Cloudflare functions.
// Used by api-test.js and dev-server.js. It replaces globalThis.fetch for requests to the fake project URL.
const URL_BASE = 'https://fake-project.supabase.co';
const realFetch = globalThis.fetch;

function install() {
  const tables = { events: [], coadmins: [], app_settings: [], seat_marks: [] };
  const unique = { coadmins: ['email'], app_settings: ['key'], seat_marks: ['event_id', 'seat_id'] };

  const matches = (row, key, value) => {
    const [op, ...rest] = value.split('.');
    const want = rest.join('.');
    if (op === 'eq') return String(row[key]) === want;
    if (op === 'gte') return String(row[key]) >= want;
    if (op === 'lte') return String(row[key]) <= want;
    return true;
  };

  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    if (url.origin !== URL_BASE) return realFetch(input, init);
    const table = url.pathname.replace('/rest/v1/', '');
    const rows = tables[table];
    if (!rows) return new Response(JSON.stringify({ message: `relation ${table} does not exist` }), { status: 404 });
    const method = (init.method || 'GET').toUpperCase();
    const prefer = (init.headers && init.headers.Prefer) || '';
    const filters = [];
    for (const [key, value] of url.searchParams) {
      if (['select', 'order', 'limit', 'on_conflict'].includes(key)) continue;
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
      const limit = Number(url.searchParams.get('limit'));
      if (limit) list = list.slice(0, limit);
      return json(project(list));
    }
    if (method === 'POST') {
      const body = JSON.parse(init.body);
      const added = [];
      for (const item of body) {
        const keys = unique[table];
        const existing = keys && rows.find(r => keys.every(k => r[k] === item[k]));
        if (existing && prefer.includes('merge-duplicates')) { Object.assign(existing, item); added.push(existing); continue; }
        if (existing) return json({ code: '23505', message: 'duplicate key value' }, 409);
        const row = { ...item };
        if (table !== 'app_settings') { row.id = crypto.randomUUID(); row.created_at = new Date().toISOString(); }
        rows.push(row); added.push(row);
      }
      return wantsRows ? json(project(added), 201) : json(undefined, 201);
    }
    if (method === 'PATCH') {
      const list = selected();
      const patch = JSON.parse(init.body);
      list.forEach(row => Object.assign(row, patch));
      return wantsRows ? json(project(list)) : json(undefined, 204);
    }
    if (method === 'DELETE') {
      const list = selected();
      list.forEach(row => rows.splice(rows.indexOf(row), 1));
      return wantsRows ? json(project(list)) : json(undefined, 204);
    }
    return json({ message: 'unsupported' }, 400);
  };
  return { tables, env: { SUPABASE_URL: URL_BASE, SUPABASE_SECRET_KEY: 'sb_secret_fake', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fake', ADMIN_PASSWORD: 'correct horse battery staple' } };
}
module.exports = { install, URL_BASE };
