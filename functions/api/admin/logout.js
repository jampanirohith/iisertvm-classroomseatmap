import { jsonResponse, sameOriginRequest, sessionCookie } from '../../_shared/admin-auth.js';

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405, { Allow: 'POST' });
  if (!sameOriginRequest(request)) return jsonResponse({ error: 'Request origin could not be verified.' }, 403);
  return jsonResponse({ ok: true }, 200, { 'Set-Cookie': await sessionCookie(String(env.ADMIN_PASSWORD || ''), request.url, true) });
}
