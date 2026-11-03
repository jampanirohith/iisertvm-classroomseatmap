'use strict';
// Local preview with a working admin: serves the site and runs the real Cloudflare functions against an
// in-memory database (nothing is saved after you stop it).  Usage: node tests/dev-server.js [port]
// Admin password: "admin".  A co-admin "coadmin@example.com" / "coadmin123" is pre-created.
const fs = require('fs');
const path = require('path');
const http = require('http');
const { pathToFileURL } = require('url');
const { install } = require('./fake-supabase.js');

const root = path.join(__dirname, '..');
const port = Number(process.argv[2]) || 8788;
const { tables, env } = install();
env.ADMIN_PASSWORD = 'admin';
// The browser normally talks to Supabase directly; in this preview a tiny stand-in for supabase-js does the same against the in-memory data.
const shim = `window.supabase = { createClient() { return {
  channel() { const c = { on() { return c; }, subscribe() { return c; } }; return c; },
  from(table) {
    const filters = [], orders = []; let op = 'select', payload;
    const q = { select() { return q; }, eq(c, v) { filters.push([c, v]); return q; }, order(c) { orders.push(c); return q; }, insert(row) { op = 'insert'; payload = row; return q; }, then(res, rej) { return run().then(res, rej); } };
    async function run() {
      const params = new URLSearchParams(); filters.forEach(([c, v]) => params.append(c, 'eq.' + v)); if (orders.length) params.set('order', orders.map(o => o + '.asc').join(','));
      const r = await fetch('/__dev/rest/' + table + '?' + params, { method: op === 'insert' ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json' }, body: op === 'insert' ? JSON.stringify([].concat(payload)) : undefined });
      const data = await r.json().catch(() => null);
      return r.ok ? { data, error: null } : { data: null, error: data || { message: 'error' } };
    }
    return q;
  } }; } };`;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
const routes = {
  '/api/config': 'api/config.js', '/api/admin/login': 'api/admin/login.js', '/api/admin/logout': 'api/admin/logout.js', '/api/admin/session': 'api/admin/session.js',
  '/api/admin/settings': 'api/admin/settings.js', '/api/admin/coadmins': 'api/admin/coadmins.js', '/api/admin/events': 'api/admin/events.js'
};

async function seed() {
  const { hashPassword } = await import(pathToFileURL(path.join(root, 'functions/_shared/admin-auth.js')).href);
  tables.coadmins.push({ id: crypto.randomUUID(), email: 'coadmin@example.com', password_hash: await hashPassword('coadmin123'), created_at: new Date().toISOString() });
  const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const add = (room, n, title, type, start, end, professor, by) => tables.events.push({ id: crypto.randomUUID(), room_id: room, title, event_type: type, event_date: day(n), start_time: start, end_time: end, professor: professor || null, description: null, created_by: by || 'admin', created_at: new Date().toISOString() });
  add('lhc-kaumudi', 0, 'Quantum Mechanics', 'class', '09:00', '10:00', 'Dr Nair');
  add('lhc-kaumudi', 0, 'Linear Algebra', 'class', '11:00', '12:30', 'Dr Menon');
  add('lhc-kaumudi', 0, 'Organic Chemistry', 'class', '14:00', '15:00', 'Dr Iyer');
  add('lhc-kaumudi', 1, 'Signals and Systems', 'class', '10:00', '11:00', 'Dr Rao');
  add('lhc-kaumudi', 1, 'Physics Lab Briefing', 'other', '15:00', '16:00');
  add('lhc-kaumudi', 3, 'Mid-semester Mathematics', 'exam', '10:00', '12:00');
  add('lhc-kaumudi', 5, 'Mid-semester Chemistry', 'exam', '14:00', '16:00');
  add('lhc-venus', 2, 'Biology 101', 'class', '09:30', '10:30', 'Dr Pillai');
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  try {
    if (url.pathname === '/__dev/supabase-shim.js') { res.writeHead(200, { 'Content-Type': 'text/javascript' }); res.end(shim); return; }
    if (url.pathname.startsWith('/__dev/rest/')) {
      const chunks = []; for await (const c of req) chunks.push(c);
      const response = await fetch(`https://fake-project.supabase.co/rest/v1/${url.pathname.slice('/__dev/rest/'.length)}${url.search}`, { method: req.method, headers: { Prefer: 'return=representation' }, body: chunks.length ? Buffer.concat(chunks).toString() : undefined });
      res.writeHead(response.status, { 'Content-Type': 'application/json' }); res.end(await response.text()); return;
    }
    if (routes[url.pathname]) {
      const mod = await import(pathToFileURL(path.join(root, 'functions', routes[url.pathname])).href);
      const chunks = []; for await (const c of req) chunks.push(c);
      const body = chunks.length ? Buffer.concat(chunks) : undefined;
      const request = new Request(url, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : body });
      const handler = mod.onRequest || mod.onRequestGet;
      const response = await handler({ request, env });
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
      return;
    }
    let file = path.join(root, url.pathname === '/' ? 'index.html' : url.pathname);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('Not found'); return; }
    const type = types[path.extname(file)] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    if (type === 'text/html') res.end(fs.readFileSync(file, 'utf8').replace('</head>', '<script src="/__dev/supabase-shim.js"></script></head>'));
    else fs.createReadStream(file).pipe(res);
  } catch (error) { console.error(error); res.writeHead(500); res.end(String(error)); }
}).listen(port, () => seed().then(() => console.log(`Preview at http://localhost:${port}  (admin password: admin)`)));
