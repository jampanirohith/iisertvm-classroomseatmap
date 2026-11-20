import { MODES, SEAT_MARKING, SEAT_NAMES, databaseHint, databaseRequest, getActor, getMode, getSeatSettings, jsonResponse, sameOriginRequest } from '../../_shared/admin-auth.js';

// Admin only: who may add events ('admin', 'coadmin' or 'anyone'), whether students can mark exam seats ('on' / 'off')
// and who sees the name on a marked seat ('everyone' / 'self'). A PUT may carry any of the three.
export async function onRequest({ request, env }) {
  const actor = await getActor(request, env);
  if (!actor || actor.role !== 'admin') return jsonResponse({ error: 'Only the admin can change settings.' }, actor ? 403 : 401);
  if (request.method === 'GET') return jsonResponse({ whoCanAdd: await getMode(env), ...(await getSeatSettings(env)) });
  if (request.method !== 'PUT') return jsonResponse({ error: 'Method not allowed.' }, 405, { Allow: 'GET, PUT' });
  if (!sameOriginRequest(request)) return jsonResponse({ error: 'Request origin could not be verified.' }, 403);

  let body;
  try { body = await request.json(); }
  catch { return jsonResponse({ error: 'Invalid request body.' }, 400); }
  body = body || {};
  const fields = [
    ['whoCanAdd', 'who_can_add', MODES, 'Choose admin only, co-admins, or anyone.'],
    ['seatMarking', 'seat_marking', SEAT_MARKING, 'Choose on or off for seat marking.'],
    ['seatNames', 'seat_names', SEAT_NAMES, 'Choose who can see the names on marked seats.']
  ];
  const rows = [], saved = {};
  for (const [field, key, allowed, message] of fields) {
    if (body[field] === undefined) continue;
    const value = String(body[field]);
    if (!allowed.includes(value)) return jsonResponse({ error: message }, 400);
    rows.push({ key, value, updated_at: new Date().toISOString() });
    saved[field] = value;
  }
  if (!rows.length) return jsonResponse({ error: 'Choose admin only, co-admins, or anyone.' }, 400);

  const result = await databaseRequest(env, 'app_settings?on_conflict=key', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(rows)
  });
  if (result.error) return jsonResponse({ error: databaseHint(result) }, result.response ? 502 : 503);
  return jsonResponse({ ok: true, ...saved });
}
