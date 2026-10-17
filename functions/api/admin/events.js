import { isAdmin, jsonResponse, sameOriginRequest } from '../../_shared/admin-auth.js';

const ROOM_IDS = new Set(['lhc-jupiter', 'lhc-venus', 'lhc-bhaskara', 'lhc-kaumudi', 'lhc-aryabhatta']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TYPES = new Set(['class', 'exam', 'other']);

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
function validTime(value) { return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || '')); }
function time5(value) { return String(value || '').slice(0, 5); }
function timeOverlap(a, b) { return a.start < time5(b.end_time || b.end) && a.end > time5(b.start_time || b.start); }

function configuration(env) {
  const url = String(env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const key = String(env.SUPABASE_SECRET_KEY || '').trim();
  if (!url || !key) return null;
  return { url, key };
}

async function databaseRequest(env, resource, init = {}) {
  const cfg = configuration(env);
  if (!cfg) return { response: null, data: null, error: 'Supabase admin access is not configured. Add SUPABASE_URL and SUPABASE_SECRET_KEY in Cloudflare Pages.' };
  let response;
  try {
    response = await fetch(`${cfg.url}/rest/v1/${resource}`, {
      ...init,
      headers: {
        apikey: cfg.key,
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init.headers || {})
      }
    });
  } catch {
    return { response: null, data: null, error: 'Could not connect to Supabase.' };
  }
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  return { response, data, error: response.ok ? null : (data && (data.message || data.hint || data.details)) || `Supabase request failed (${response.status}).` };
}

function publicError(result) {
  if (!result.response) return jsonResponse({ error: result.error || 'Supabase is not configured.' }, 503);
  if (result.response.status === 409 || (result.data && ['23505', '23P01'].includes(result.data.code))) {
    return jsonResponse({ error: 'This event conflicts with an event already saved. Refresh the list and check the time range.' }, 409);
  }
  const status = result.response.status >= 400 && result.response.status < 500 ? result.response.status : 502;
  return jsonResponse({ error: 'Supabase could not complete that request. Check the schema and Cloudflare environment settings.' }, status);
}

async function listEvents(env, roomId) {
  const query = new URLSearchParams({
    select: 'id,room_id,title,event_type,event_date,start_time,end_time,professor,description,created_at',
    room_id: `eq.${roomId}`,
    order: 'event_date.asc,start_time.asc'
  });
  return databaseRequest(env, `events?${query.toString()}`);
}

async function handlePost(request, env) {
  if (!sameOriginRequest(request)) return jsonResponse({ error: 'Request origin could not be verified.' }, 403);
  let body;
  try { body = await request.json(); }
  catch { return jsonResponse({ error: 'Invalid request body.' }, 400); }
  const roomId = String(body.roomId || '');
  const events = body.events;
  if (!ROOM_IDS.has(roomId)) return jsonResponse({ error: 'Choose a valid classroom.' }, 400);
  if (!Array.isArray(events) || events.length < 1 || events.length > 130) return jsonResponse({ error: 'Add between 1 and 130 event sessions at a time.' }, 400);

  const normalized = [];
  for (const item of events) {
    const title = String(item.title || '').trim();
    const type = String(item.type || 'other');
    const date = String(item.date || '');
    const start = String(item.start || '');
    const end = String(item.end || '');
    const professor = String(item.professor || '').trim();
    const note = String(item.note || '').trim();
    if (!title || title.length > 80 || !TYPES.has(type) || !validDate(date) || !validTime(start) || !validTime(end) || end <= start || professor.length > 80 || note.length > 200) {
      return jsonResponse({ error: 'One or more sessions have invalid event details. Review the title, type, date, times and note.' }, 400);
    }
    normalized.push({ room_id: roomId, title, event_type: type, event_date: date, start_time: start, end_time: end, professor: professor || null, description: note || null });
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

  const insert = await databaseRequest(env, 'events?select=id,room_id,title,event_type,event_date,start_time,end_time,professor,description,created_at', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(normalized)
  });
  if (insert.error) return publicError(insert);
  return jsonResponse({ events: insert.data || [] }, 201);
}

async function handleDelete(request, env, url) {
  if (!sameOriginRequest(request)) return jsonResponse({ error: 'Request origin could not be verified.' }, 403);
  const roomId = String(url.searchParams.get('roomId') || '');
  const eventId = String(url.searchParams.get('eventId') || '');
  if (!ROOM_IDS.has(roomId) || !UUID.test(eventId)) return jsonResponse({ error: 'Choose a valid event.' }, 400);
  const query = new URLSearchParams({ id: `eq.${eventId}`, room_id: `eq.${roomId}`, select: 'id' });
  const result = await databaseRequest(env, `events?${query.toString()}`, {
    method: 'DELETE',
    headers: { Prefer: 'return=representation' }
  });
  if (result.error) return publicError(result);
  if (!Array.isArray(result.data) || result.data.length === 0) return jsonResponse({ error: 'That event no longer exists. Refresh the event list.' }, 404);
  return jsonResponse({ ok: true, deleted: eventId });
}

export async function onRequest({ request, env }) {
  if (!await isAdmin(request, env)) return jsonResponse({ error: 'Admin sign-in required. Please sign in again.' }, 401);
  const url = new URL(request.url);
  if (request.method === 'GET') {
    const roomId = String(url.searchParams.get('roomId') || '');
    if (!ROOM_IDS.has(roomId)) return jsonResponse({ error: 'Choose a valid classroom.' }, 400);
    const result = await listEvents(env, roomId);
    if (result.error) return publicError(result);
    return jsonResponse({ events: Array.isArray(result.data) ? result.data : [] });
  }
  if (request.method === 'POST') return handlePost(request, env);
  if (request.method === 'DELETE') return handleDelete(request, env, url);
  return jsonResponse({ error: 'Method not allowed.' }, 405, { Allow: 'GET, POST, DELETE' });
}
