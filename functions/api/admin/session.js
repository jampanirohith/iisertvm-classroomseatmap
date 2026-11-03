import { canAddEvents, getActor, getMode, jsonResponse } from '../../_shared/admin-auth.js';

// Who is signed in, and who may add events right now. Safe to call without signing in.
export async function onRequest({ request, env }) {
  if (request.method !== 'GET') return jsonResponse({ error: 'Method not allowed.' }, 405, { Allow: 'GET' });
  const [actor, mode] = await Promise.all([getActor(request, env), getMode(env)]);
  return jsonResponse({
    role: actor ? actor.role : null,
    email: actor ? actor.email : null,
    mode,
    canAdd: canAddEvents(actor, mode),
    canManage: Boolean(actor && actor.role === 'admin')
  });
}
