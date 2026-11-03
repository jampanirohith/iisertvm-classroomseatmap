import { canAddEvents, databaseRequest, getActor, getMode, jsonResponse, sameOriginRequest } from '../../_shared/admin-auth.js';

const ROOM_IDS = new Set(['lhc-jupiter', 'lhc-venus', 'lhc-bhaskara', 'lhc-kaumudi', 'lhc-aryabhatta']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TYPES = new Set(['class', 'exam', 'other']);
const COLUMNS = 'id,room_id,title,event_type,event_date,start_time,end_time,professor,description,created_by,created_at';

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
function validTime(value) { return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || '')); }
function time5(value) { return String(value || '').slice(0, 5); }
function timeOverlap(a, b) { return a.start < time5(b.end_time || b.end) && a.end > time5(b.start_time || b.start); }

function publicError(result) {
  if (!result.response) return jsonResponse({ error: result.error || 'Supabase is not configured.' }, 503);
  if (result.response.status === 409 || (result.data && ['23505', '23P01'].includes(result.data.code))) {
    return jsonResponse({ error: 'This event conflicts with an event already saved. Refresh the calendar and check the time range.' }, 409);
  }
  const status = result.response.status >= 400 && result.response.status < 500 ? result.response.status : 502;
  return jsonResponse({ error: 'Supabase could not complete that request. Check the schema and Cloudflare environment settings.' }, status);
}

// Validates one session from the browser. Returns the cleaned values, or null when something is wrong.
function cleanSession(item) {
  const title = String(item && item.title || '').trim();
  const type = String(item && item.type || 'other');
  const date = String(item && item.date || '');
  const start = String(item && item.start || '');
  const end = String(item && item.end || '');
  const professor = String(item && item.professor || '').trim();
  const note = String(item && item.note || '').trim();
  if (!title || title.length > 80 || !TYPES.has(type) || !validDate(date) || !validTime(start) || !validTime(end) || end <= start || professor.length > 80 || note.length > 200) return null;
  return { title, event_type: type, event_date: date, start_time: start, end_time: end, professor: professor || null, description: note || null };
}

// The admin may change any event. A co-admin may change the events they created, unless adding is limited to the admin.
function canModify(actor, mode, row) {
  if (!actor) return false;
  if (actor.role === 'admin') return true;
  return mode !== 'admin' && row.created_by === actor.email;
}

// Who created the event, as stored in events.created_by.
const creatorOf = actor => (actor ? (actor.role === 'admin' ? 'admin' : actor.email) : 'public');

async function handlePost(request, env, actor) {
  if (!sameOriginRequest(request)) return jsonResponse({ error: 'Request origin could not be verified.' }, 403);
  const mode = await getMode(env);
  if (!canAddEvents(actor, mode)) {
    if (!actor) return jsonResponse({ error: 'Sign in to add events.' }, 401);
    return jsonResponse({ error: 'Adding events is limited to the admin right now.' }, 403);
  }
  let body;
  try { body = await request.json(); }
  catch { return jsonResponse({ error: 'Invalid request body.' }, 400); }
  const roomId = String(body.roomId || '');
  const events = body.events;
  if (!ROOM_IDS.has(roomId)) return jsonResponse({ error: 'Choose a valid classroom.' }, 400);
  if (!Array.isArray(events) || events.length < 1 || events.length > 130) return jsonResponse({ error: 'Add between 1 and 130 event sessions at a time.' }, 400);

  const createdBy = creatorOf(actor);
  const normalized = [];
  for (const item of events) {
    const clean = cleanSession(item);
    if (!clean) return jsonResponse({ error: 'One or more sessions have invalid event details. Review the title, type, date, times and note.' }, 400);
    normalized.push({ room_id: roomId, ...clean, created_by: createdBy });
  }

  for (let i = 0; i < normalized.length; i++) {
    const event = normalized[i];
    for (let j = 0; j < i; j++) {
      const previous = normalized[j];
      if (previous.event_date === event.event_date && event.start_time < previous.end_time && event.end_time > previous.start_time) {
        return jsonResponse({ error: 'The submitted sessions overlap each other. Check the repeat pattern and times.' }, 409);
      }
    }
  }
  const dates = normalized.map(event => event.event_date).sort();
  const range = new URLSearchParams({
    select: 'id,title,event_date,start_time,end_time',
    room_id: `eq.${roomId}`,
    and: `(event_date.gte.${dates[0]},event_date.lte.${dates[dates.length - 1]})`
  });
  const existingResult = await databaseRequest(env, `events?${range.toString()}`);
  if (existingResult.error) return publicError(existingResult);
  const existing = Array.isArray(existingResult.data) ? existingResult.data : [];
  for (const event of normalized) {
    const conflict = existing.find(previous => previous.event_date === event.event_date && timeOverlap({ start: event.start_time, end: event.end_time }, previous));
    if (conflict) return jsonResponse({ error: `There is already an event in this classroom on ${event.event_date} that overlaps this time (${conflict.title}).` }, 409);
  }

  const insert = await databaseRequest(env, `events?select=${COLUMNS}`, {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(normalized)
  });
  if (insert.error) return publicError(insert);
  return jsonResponse({ events: insert.data || [] }, 201);
}

async function handleDelete(request, env, url, actor) {
  if (!sameOriginRequest(request)) return jsonResponse({ error: 'Request origin could not be verified.' }, 403);
  if (!actor) return jsonResponse({ error: 'Sign in to delete events.' }, 401);
  const roomId = String(url.searchParams.get('roomId') || '');
  const eventId = String(url.searchParams.get('eventId') || '');
  if (!ROOM_IDS.has(roomId) || !UUID.test(eventId)) return jsonResponse({ error: 'Choose a valid event.' }, 400);

  const filter = { id: `eq.${eventId}`, room_id: `eq.${roomId}` };
  const lookup = await databaseRequest(env, `events?${new URLSearchParams({ ...filter, select: 'id,created_by' })}`);
  if (lookup.error) return publicError(lookup);
  const row = Array.isArray(lookup.data) ? lookup.data[0] : null;
  if (!row) return jsonResponse({ error: 'That event no longer exists. Refresh the calendar.' }, 404);
  if (!canModify(actor, await getMode(env), row)) return jsonResponse({ error: 'You can only delete events you created, and only while co-admins may add events.' }, 403);

  const result = await databaseRequest(env, `events?${new URLSearchParams({ ...filter, select: 'id' })}`, {
    method: 'DELETE',
    headers: { Prefer: 'return=representation' }
  });
  if (result.error) return publicError(result);
  if (!Array.isArray(result.data) || result.data.length === 0) return jsonResponse({ error: 'That event no longer exists. Refresh the calendar.' }, 404);
  return jsonResponse({ ok: true, deleted: eventId });
}

// Edit or reschedule one event (change its title, type, date, time, professor or note).
async function handlePatch(request, env, url, actor) {
  if (!sameOriginRequest(request)) return jsonResponse({ error: 'Request origin could not be verified.' }, 403);
  if (!actor) return jsonResponse({ error: 'Sign in to edit events.' }, 401);
  const roomId = String(url.searchParams.get('roomId') || '');
  const eventId = String(url.searchParams.get('eventId') || '');
  if (!ROOM_IDS.has(roomId) || !UUID.test(eventId)) return jsonResponse({ error: 'Choose a valid event.' }, 400);
  let body;
  try { body = await request.json(); }
  catch { return jsonResponse({ error: 'Invalid request body.' }, 400); }
  const clean = cleanSession(body);
  if (!clean) return jsonResponse({ error: 'Review the event name, type, date, times and note.' }, 400);

  const filter = { id: `eq.${eventId}`, room_id: `eq.${roomId}` };
  const lookup = await databaseRequest(env, `events?${new URLSearchParams({ ...filter, select: 'id,created_by' })}`);
  if (lookup.error) return publicError(lookup);
  const row = Array.isArray(lookup.data) ? lookup.data[0] : null;
  if (!row) return jsonResponse({ error: 'That event no longer exists. Refresh the calendar.' }, 404);
  if (!canModify(actor, await getMode(env), row)) return jsonResponse({ error: 'You can only edit events you created, and only while co-admins may add events.' }, 403);

  const sameDay = await databaseRequest(env, `events?${new URLSearchParams({ select: 'id,title,start_time,end_time', room_id: `eq.${roomId}`, event_date: `eq.${clean.event_date}` })}`);
  if (sameDay.error) return publicError(sameDay);
  const conflict = (Array.isArray(sameDay.data) ? sameDay.data : []).find(other => other.id !== eventId && timeOverlap({ start: clean.start_time, end: clean.end_time }, other));
  if (conflict) return jsonResponse({ error: `That time overlaps another event in this classroom (${conflict.title}).` }, 409);

  const result = await databaseRequest(env, `events?${new URLSearchParams({ ...filter, select: COLUMNS })}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(clean)
  });
  if (result.error) return publicError(result);
  if (!Array.isArray(result.data) || !result.data.length) return jsonResponse({ error: 'That event no longer exists. Refresh the calendar.' }, 404);
  return jsonResponse({ event: result.data[0] });
}

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  if (request.method === 'GET') {
    // Events are public data, so anyone who may open the calendar can read them.
    const roomId = String(url.searchParams.get('roomId') || '');
    if (!ROOM_IDS.has(roomId)) return jsonResponse({ error: 'Choose a valid classroom.' }, 400);
    const query = new URLSearchParams({ select: COLUMNS, room_id: `eq.${roomId}`, order: 'event_date.asc,start_time.asc' });
    const result = await databaseRequest(env, `events?${query.toString()}`);
    if (result.error) return publicError(result);
    return jsonResponse({ events: Array.isArray(result.data) ? result.data : [] });
  }
  const actor = await getActor(request, env);
  if (request.method === 'POST') return handlePost(request, env, actor);
  if (request.method === 'PATCH') return handlePatch(request, env, url, actor);
  if (request.method === 'DELETE') return handleDelete(request, env, url, actor);
  return jsonResponse({ error: 'Method not allowed.' }, 405, { Allow: 'GET, POST, PATCH, DELETE' });
}
