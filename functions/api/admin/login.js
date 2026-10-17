import { constantTimeEqual, jsonResponse, sameOriginRequest, sessionCookie } from '../../_shared/admin-auth.js';

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405, { Allow: 'POST' });
  if (!sameOriginRequest(request)) return jsonResponse({ error: 'Request origin could not be verified.' }, 403);
  const password = String(env.ADMIN_PASSWORD || '');
  if (!password) return jsonResponse({ error: 'Admin password is not configured in Cloudflare Pages environment secrets.' }, 503);

  let body;
  try { body = await request.json(); }
  catch { return jsonResponse({ error: 'Invalid request.' }, 400); }
  const supplied = body && typeof body.password === 'string' ? body.password : '';
  if (!constantTimeEqual(supplied, password)) return jsonResponse({ error: 'Incorrect admin password.' }, 401);

  return jsonResponse({ ok: true }, 200, { 'Set-Cookie': await sessionCookie(password, request.url) });
}
