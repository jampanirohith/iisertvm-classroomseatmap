'use strict';
// Exercises the real Cloudflare functions (login, roles, settings, co-admins, events) against an in-memory Supabase.
const path = require('path');
const assert = require('assert/strict');
const { pathToFileURL } = require('url');
const { install } = require('./fake-supabase.js');

const fn = rel => import(pathToFileURL(path.join(__dirname, '..', 'functions', rel)).href);
const ORIGIN = 'https://lhc.example';

(async () => {
  const { tables, env } = install();
  const [login, logout, session, settings, coadmins, events] = await Promise.all(['api/admin/login.js', 'api/admin/logout.js', 'api/admin/session.js', 'api/admin/settings.js', 'api/admin/coadmins.js', 'api/admin/events.js'].map(fn));

  const call = async (mod, method, route, { body, cookie, origin = ORIGIN } = {}) => {
    const headers = {};
    if (body) headers['Content-Type'] = 'application/json';
    if (cookie) headers.Cookie = cookie;
    if (origin && method !== 'GET') headers.Origin = origin;
    const response = await mod.onRequest({ request: new Request(`${ORIGIN}${route}`, { method, headers, body: body ? JSON.stringify(body) : undefined }), env });
    const data = await response.json().catch(() => ({}));
    const set = response.headers.get('Set-Cookie');
    return { status: response.status, data, cookie: set ? set.split(';')[0] : null, setCookie: set };
  };
  const event = (extra = {}) => ({ title: 'Signals', type: 'class', date: '2026-11-09', start: '10:00', end: '11:00', professor: '', note: '', ...extra });
  const add = (cookie, extra, room = 'lhc-kaumudi') => call(events, 'POST', '/api/admin/events', { cookie, body: { roomId: room, events: [event(extra)] } });

  // --- admin sign-in
  assert.equal((await call(login, 'POST', '/api/admin/login', { body: { role: 'admin', password: 'nope' } })).status, 401);
  assert.equal((await call(login, 'POST', '/api/admin/login', { body: { role: 'admin', password: env.ADMIN_PASSWORD }, origin: 'https://evil.example' })).status, 403, 'cross-origin sign-in is refused');
  const admin = await call(login, 'POST', '/api/admin/login', { body: { role: 'admin', password: env.ADMIN_PASSWORD } });
  assert.equal(admin.status, 200);
  assert.ok(/HttpOnly/.test(admin.setCookie) && /SameSite=Strict/.test(admin.setCookie) && /Path=\/api\/admin/.test(admin.setCookie));
  const adminCookie = admin.cookie;
  assert.deepEqual((await call(session, 'GET', '/api/admin/session', { cookie: adminCookie })).data, { role: 'admin', email: null, mode: 'admin', canAdd: true, canManage: true });
  const tampered = adminCookie.slice(0, -3) + 'AAA';
  assert.equal((await call(session, 'GET', '/api/admin/session', { cookie: tampered })).data.role, null, 'a tampered cookie is ignored');

  // --- default mode is admin-only; co-admins cannot be managed by anyone but the admin
  assert.equal((await call(session, 'GET', '/api/admin/session')).data.mode, 'admin');
  assert.equal((await call(coadmins, 'GET', '/api/admin/coadmins')).status, 401);
  assert.equal((await call(settings, 'PUT', '/api/admin/settings', { body: { whoCanAdd: 'anyone' } })).status, 401);

  // --- co-admin accounts
  const created = await call(coadmins, 'POST', '/api/admin/coadmins', { cookie: adminCookie, body: { email: 'Prof.Rao@iisertvm.ac.in', password: 'tiger-lily-42' } });
  assert.equal(created.status, 201);
  assert.equal(created.data.coadmin.email, 'prof.rao@iisertvm.ac.in', 'emails are stored in lower case');
  assert.ok(tables.coadmins[0].password_hash.startsWith('pbkdf2$') && !tables.coadmins[0].password_hash.includes('tiger'), 'passwords are stored hashed');
  assert.equal((await call(coadmins, 'POST', '/api/admin/coadmins', { cookie: adminCookie, body: { email: 'prof.rao@iisertvm.ac.in', password: 'another-pass-1' } })).status, 409);
  assert.equal((await call(coadmins, 'POST', '/api/admin/coadmins', { cookie: adminCookie, body: { email: 'x@y.in', password: 'short' } })).status, 400);
  assert.equal((await call(coadmins, 'POST', '/api/admin/coadmins', { cookie: adminCookie, body: { email: 'not-an-email', password: 'long-enough-1' } })).status, 400);
  const listed = (await call(coadmins, 'GET', '/api/admin/coadmins', { cookie: adminCookie })).data.coadmins;
  assert.deepEqual(listed.map(c => Object.keys(c).sort()), [['created_at', 'email']], 'the list never exposes password hashes');

  assert.equal((await call(login, 'POST', '/api/admin/login', { body: { role: 'coadmin', email: 'prof.rao@iisertvm.ac.in', password: 'wrong-password' } })).status, 401);
  assert.equal((await call(login, 'POST', '/api/admin/login', { body: { role: 'coadmin', email: 'nobody@iisertvm.ac.in', password: 'tiger-lily-42' } })).status, 401);
  const co = await call(login, 'POST', '/api/admin/login', { body: { role: 'coadmin', email: 'PROF.RAO@iisertvm.ac.in', password: 'tiger-lily-42' } });
  assert.equal(co.status, 200);
  const coCookie = co.cookie;
  assert.equal((await call(coadmins, 'GET', '/api/admin/coadmins', { cookie: coCookie })).status, 403, 'a co-admin cannot manage users');
  assert.equal((await call(settings, 'PUT', '/api/admin/settings', { cookie: coCookie, body: { whoCanAdd: 'anyone' } })).status, 403, 'a co-admin cannot change settings');

  // --- who can add: admin only (default)
  assert.equal((await add(null)).status, 401, 'visitors cannot add in admin-only mode');
  assert.equal((await add(coCookie)).status, 403, 'co-admins cannot add in admin-only mode');
  const first = await add(adminCookie);
  assert.equal(first.status, 201);
  assert.equal(first.data.events[0].created_by, 'admin');
  assert.equal((await add(adminCookie, { start: '10:30', end: '11:30' })).status, 409, 'overlapping events are rejected');
  assert.equal((await add(adminCookie, { start: '11:00', end: '12:00', title: 'Back to back' })).status, 201, 'back-to-back events are allowed');
  assert.equal((await add(adminCookie, {}, 'lhc-venus')).status, 201, 'other rooms are independent');

  // --- who can add: admin and co-admins
  assert.equal((await call(settings, 'PUT', '/api/admin/settings', { cookie: adminCookie, body: { whoCanAdd: 'bogus' } })).status, 400);
  assert.equal((await call(settings, 'PUT', '/api/admin/settings', { cookie: adminCookie, body: { whoCanAdd: 'coadmin' } })).status, 200);
  assert.equal((await call(session, 'GET', '/api/admin/session', { cookie: coCookie })).data.canAdd, true);
  assert.equal((await add(null, { date: '2026-11-10' })).status, 401, 'visitors still cannot add');
  const mine = await add(coCookie, { date: '2026-11-10', title: 'Rao lecture' });
  assert.equal(mine.status, 201);
  assert.equal(mine.data.events[0].created_by, 'prof.rao@iisertvm.ac.in');
  const mineId = mine.data.events[0].id, adminId = first.data.events[0].id;

  // --- edit and reschedule
  const edit = (cookie, id, extra, room = 'lhc-kaumudi') => call(events, 'PATCH', `/api/admin/events?roomId=${room}&eventId=${id}`, { cookie, body: event(extra) });
  const moved = await edit(coCookie, mineId, { date: '2026-11-12', start: '14:00', end: '15:30', title: 'Rao lecture (moved)' });
  assert.equal(moved.status, 200);
  assert.deepEqual([moved.data.event.event_date, moved.data.event.start_time, moved.data.event.end_time], ['2026-11-12', '14:00', '15:30']);
  assert.equal((await edit(coCookie, adminId, { title: 'Hijack' })).status, 403, 'a co-admin cannot edit the admin\'s events');
  assert.equal((await edit(coCookie, mineId, { date: '2026-11-09', start: '10:15', end: '10:45' })).status, 409, 'rescheduling into another event is rejected');
  assert.equal((await edit(coCookie, mineId, { date: '2026-11-12', start: '14:00', end: '15:00' })).status, 200, 'an event never conflicts with itself');
  assert.equal((await edit(null, mineId, {})).status, 401);
  assert.equal((await edit(adminCookie, mineId, { end: '09:00', start: '10:00' })).status, 400, 'end must be after start');
  assert.equal((await edit(adminCookie, mineId, { title: 'Renamed by admin', date: '2026-11-12', start: '14:00', end: '15:00' })).status, 200, 'the admin can edit anything');

  // --- deleting
  const del = (cookie, id, room = 'lhc-kaumudi') => call(events, 'DELETE', `/api/admin/events?roomId=${room}&eventId=${id}`, { cookie });
  assert.equal((await del(null, mineId)).status, 401);
  assert.equal((await del(coCookie, adminId)).status, 403, 'a co-admin cannot delete the admin\'s events');
  assert.equal((await del(coCookie, mineId)).status, 200, 'a co-admin can delete their own');
  assert.equal((await del(adminCookie, adminId)).status, 200, 'the admin can delete any');
  assert.equal((await del(adminCookie, adminId)).status, 404);

  // --- who can add: anyone
  await call(settings, 'PUT', '/api/admin/settings', { cookie: adminCookie, body: { whoCanAdd: 'anyone' } });
  assert.equal((await call(session, 'GET', '/api/admin/session')).data.canAdd, true);
  const guest = await add(null, { date: '2026-11-20', title: 'Club meeting', type: 'other' });
  assert.equal(guest.status, 201);
  assert.equal(guest.data.events[0].created_by, 'public');
  assert.equal((await del(null, guest.data.events[0].id)).status, 401, 'visitors cannot delete');
  assert.equal((await edit(null, guest.data.events[0].id, {})).status, 401, 'visitors cannot edit');
  assert.equal((await add(null, { type: 'party' })).status, 400, 'invalid types are rejected');

  // --- events are public to read
  const read = await call(events, 'GET', '/api/admin/events?roomId=lhc-kaumudi');
  assert.equal(read.status, 200);
  assert.ok(read.data.events.some(e => e.title === 'Club meeting'));

  // --- removing a co-admin ends their session; resetting a password does too
  await call(settings, 'PUT', '/api/admin/settings', { cookie: adminCookie, body: { whoCanAdd: 'coadmin' } });
  assert.equal((await call(coadmins, 'PATCH', '/api/admin/coadmins', { cookie: adminCookie, body: { email: 'prof.rao@iisertvm.ac.in', password: 'new-password-9' } })).status, 200);
  assert.equal((await call(session, 'GET', '/api/admin/session', { cookie: coCookie })).data.role, null, 'old co-admin sessions stop working after a password reset');
  const again = await call(login, 'POST', '/api/admin/login', { body: { role: 'coadmin', email: 'prof.rao@iisertvm.ac.in', password: 'new-password-9' } });
  assert.equal(again.status, 200);
  assert.equal((await call(coadmins, 'DELETE', '/api/admin/coadmins?email=prof.rao%40iisertvm.ac.in', { cookie: adminCookie })).status, 200);
  assert.equal((await call(session, 'GET', '/api/admin/session', { cookie: again.cookie })).data.role, null, 'a removed co-admin is signed out');

  // --- sign out
  const out = await call(logout, 'POST', '/api/admin/logout');
  assert.ok(/Max-Age=0/.test(out.setCookie));
  console.log('PASS: API — admin/co-admin sign-in, who-can-add modes, edit/reschedule, delete rules, co-admin management');
})().catch(error => { console.error(error); process.exitCode = 1; });
