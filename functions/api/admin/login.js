import { constantTimeEqual, findCoadmin, hashPassword, jsonResponse, normalizeEmail, sameOriginRequest, sessionCookie, sessionFingerprint, verifyPassword } from '../../_shared/admin-auth.js';

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405, { Allow: 'POST' });
  if (!sameOriginRequest(request)) return jsonResponse({ error: 'Request origin could not be verified.' }, 403);
  const adminPassword = String(env.ADMIN_PASSWORD || '');
  if (!adminPassword) return jsonResponse({ error: 'Admin password is not configured in Cloudflare Pages environment secrets.' }, 503);

  let body;
  try { body = await request.json(); }
  catch { return jsonResponse({ error: 'Invalid request.' }, 400); }
  const supplied = body && typeof body.password === 'string' ? body.password : '';

  if (body && body.role === 'coadmin') {
    const email = normalizeEmail(body.email);
    const { record, error } = email ? await findCoadmin(env, email) : { record: null, error: null };
    if (error) return jsonResponse({ error: 'Co-admin sign-in is not set up yet. Run supabase/schema.sql and check the Cloudflare settings.' }, 503);
    // Hash even when the account does not exist so the response time does not reveal which emails are co-admins.
    const valid = record ? await verifyPassword(supplied, record.password_hash) : (await hashPassword(supplied), false);
    if (!valid) return jsonResponse({ error: 'Incorrect email or password.' }, 401);
    const cookie = await sessionCookie(env, request.url, { role: 'coadmin', email: record.email, pv: sessionFingerprint(record.password_hash) });
    return jsonResponse({ ok: true, role: 'coadmin', email: record.email }, 200, { 'Set-Cookie': cookie });
  }

  if (!constantTimeEqual(supplied, adminPassword)) return jsonResponse({ error: 'Incorrect admin password.' }, 401);
  return jsonResponse({ ok: true, role: 'admin', email: null }, 200, { 'Set-Cookie': await sessionCookie(env, request.url, { role: 'admin' }) });
}
