import { databaseRequest, getActor, hashPassword, jsonResponse, normalizeEmail, sameOriginRequest } from '../../_shared/admin-auth.js';

const PASSWORD_ERROR = 'Use a password of 8 to 128 characters.';
const validPassword = value => typeof value === 'string' && value.length >= 8 && value.length <= 128;
const failure = result => jsonResponse({ error: 'Could not reach the co-admin list. Run supabase/schema.sql and check the Cloudflare settings.' }, result.response ? 502 : 503);

// Admin only: create, list, reset the password of, and remove co-admins.
export async function onRequest({ request, env }) {
  const actor = await getActor(request, env);
  if (!actor || actor.role !== 'admin') return jsonResponse({ error: 'Only the admin can manage co-admins.' }, actor ? 403 : 401);
  const url = new URL(request.url);

  if (request.method === 'GET') {
    const result = await databaseRequest(env, `coadmins?${new URLSearchParams({ select: 'email,created_at', order: 'created_at.asc' })}`);
    if (result.error) return failure(result);
    return jsonResponse({ coadmins: Array.isArray(result.data) ? result.data : [] });
  }
  if (!['POST', 'PATCH', 'DELETE'].includes(request.method)) return jsonResponse({ error: 'Method not allowed.' }, 405, { Allow: 'GET, POST, PATCH, DELETE' });
  if (!sameOriginRequest(request)) return jsonResponse({ error: 'Request origin could not be verified.' }, 403);

  if (request.method === 'DELETE') {
    const email = normalizeEmail(url.searchParams.get('email'));
    if (!email) return jsonResponse({ error: 'Choose a valid co-admin.' }, 400);
    const result = await databaseRequest(env, `coadmins?${new URLSearchParams({ email: `eq.${email}`, select: 'email' })}`, { method: 'DELETE', headers: { Prefer: 'return=representation' } });
    if (result.error) return failure(result);
    if (!Array.isArray(result.data) || !result.data.length) return jsonResponse({ error: 'That co-admin no longer exists.' }, 404);
    return jsonResponse({ ok: true });
  }

  let body;
  try { body = await request.json(); }
  catch { return jsonResponse({ error: 'Invalid request body.' }, 400); }
  const email = normalizeEmail(body && body.email);
  if (!email) return jsonResponse({ error: 'Enter a valid email address.' }, 400);
  if (!validPassword(body.password)) return jsonResponse({ error: PASSWORD_ERROR }, 400);
  const password_hash = await hashPassword(body.password);

  if (request.method === 'POST') {
    const result = await databaseRequest(env, 'coadmins?select=email,created_at', {
      method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify([{ email, password_hash }])
    });
    if (result.response && (result.response.status === 409 || (result.data && result.data.code === '23505'))) return jsonResponse({ error: 'A co-admin with that email already exists. Use Reset password instead.' }, 409);
    if (result.error) return failure(result);
    return jsonResponse({ coadmin: result.data[0] }, 201);
  }

  // PATCH: reset the password. Existing sessions for this co-admin stop working.
  const result = await databaseRequest(env, `coadmins?${new URLSearchParams({ email: `eq.${email}`, select: 'email' })}`, {
    method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ password_hash })
  });
  if (result.error) return failure(result);
  if (!Array.isArray(result.data) || !result.data.length) return jsonResponse({ error: 'That co-admin no longer exists.' }, 404);
  return jsonResponse({ ok: true });
}
