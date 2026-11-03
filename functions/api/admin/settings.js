import { MODES, databaseHint, databaseRequest, getActor, getMode, jsonResponse, sameOriginRequest } from '../../_shared/admin-auth.js';

// Admin only: choose who may add events ('admin', 'coadmin' or 'anyone').
export async function onRequest({ request, env }) {
  const actor = await getActor(request, env);
  if (!actor || actor.role !== 'admin') return jsonResponse({ error: 'Only the admin can change settings.' }, actor ? 403 : 401);
  if (request.method === 'GET') return jsonResponse({ whoCanAdd: await getMode(env) });
  if (request.method !== 'PUT') return jsonResponse({ error: 'Method not allowed.' }, 405, { Allow: 'GET, PUT' });
  if (!sameOriginRequest(request)) return jsonResponse({ error: 'Request origin could not be verified.' }, 403);

  let body;
  try { body = await request.json(); }
  catch { return jsonResponse({ error: 'Invalid request body.' }, 400); }
  const value = String(body && body.whoCanAdd || '');
  if (!MODES.includes(value)) return jsonResponse({ error: 'Choose admin only, co-admins, or anyone.' }, 400);

  const result = await databaseRequest(env, 'app_settings?on_conflict=key', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify([{ key: 'who_can_add', value, updated_at: new Date().toISOString() }])
  });
  if (result.error) return jsonResponse({ error: databaseHint(result) }, result.response ? 502 : 503);
  return jsonResponse({ ok: true, whoCanAdd: value });
}
