// Shared helpers for the admin API: signed session cookies, roles (admin / co-admin),
// password hashing for co-admins, and a small Supabase REST client that uses the secret key.
const COOKIE_NAME = 'lhc_admin_session';
const SESSION_SECONDS = 8 * 60 * 60;
// Cloudflare Workers allow at most 100,000 PBKDF2 iterations. Co-admin passwords are assigned by the admin,
// and this runs only at sign-in and when a password is set, so a moderate count keeps CPU time low.
const PBKDF2_ITERATIONS = 30000;
const encoder = new TextEncoder();

export const MODES = ['admin', 'coadmin', 'anyone'];
export const DEFAULT_MODE = 'admin';

export function jsonResponse(body, status = 200, headers = {}) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
      ...headers
    }
  });
}

export function sameOriginRequest(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return false;
  try { return origin === new URL(request.url).origin; }
  catch { return false; }
}

export function constantTimeEqual(left, right) {
  const a = String(left || '');
  const b = String(right || '');
  let mismatch = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i++) mismatch |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return mismatch === 0;
}

export function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  return email.length <= 254 && /^[^\s@,]{1,64}@[^\s@,]{1,190}\.[^\s@,]{2,}$/.test(email) ? email : '';
}

// ---------- base64url ----------
function toB64url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function fromB64url(text) {
  const padded = String(text).replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

// ---------- password hashing (co-admins) ----------
async function derive(password, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
  return toB64url(new Uint8Array(bits));
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toB64url(salt)}$${await derive(password, salt, PBKDF2_ITERATIONS)}`;
}

export async function verifyPassword(password, stored) {
  const [scheme, rounds, salt, hash] = String(stored || '').split('$');
  const iterations = Number(rounds);
  if (scheme !== 'pbkdf2' || !Number.isInteger(iterations) || iterations < 1000 || iterations > 100000 || !salt || !hash) return false;
  try { return constantTimeEqual(await derive(password, fromB64url(salt), iterations), hash); }
  catch { return false; }
}

// A short fingerprint of the stored password: changing a co-admin's password signs their old sessions out.
export const sessionFingerprint = stored => String(stored || '').split('$')[3]?.slice(0, 12) || '';

// ---------- sessions ----------
async function hmac(secret, text) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return toB64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(`lhc-session:${text}`))));
}

// session: { role: 'admin' } or { role: 'coadmin', email, pv }. Pass null to build the sign-out cookie.
export async function sessionCookie(env, requestUrl, session) {
  const secure = new URL(requestUrl).protocol === 'https:' ? '; Secure' : '';
  const base = 'Path=/api/admin; HttpOnly; SameSite=Strict';
  if (!session) return `${COOKIE_NAME}=; ${base}; Max-Age=0${secure}`;
  const payload = toB64url(encoder.encode(JSON.stringify({
    r: session.role, e: session.email || '', pv: session.pv || '', x: Math.floor(Date.now() / 1000) + SESSION_SECONDS
  })));
  return `${COOKIE_NAME}=${payload}.${await hmac(String(env.ADMIN_PASSWORD || ''), payload)}; ${base}; Max-Age=${SESSION_SECONDS}${secure}`;
}

function readCookie(request, name) {
  const cookie = request.headers.get('Cookie') || '';
  for (const section of cookie.split(';')) {
    const index = section.indexOf('=');
    if (index < 0) continue;
    if (section.slice(0, index).trim() === name) return section.slice(index + 1).trim();
  }
  return '';
}

async function readSession(request, env) {
  const secret = String(env.ADMIN_PASSWORD || '');
  if (!secret) return null;
  const token = readCookie(request, COOKIE_NAME);
  const dot = token.indexOf('.');
  if (dot < 1) return null;
  const payload = token.slice(0, dot);
  try {
    if (!constantTimeEqual(token.slice(dot + 1), await hmac(secret, payload))) return null;
    const data = JSON.parse(new TextDecoder().decode(fromB64url(payload)));
    const now = Math.floor(Date.now() / 1000);
    if (!Number.isSafeInteger(data.x) || data.x <= now || data.x > now + SESSION_SECONDS + 60) return null;
    return data;
  } catch { return null; }
}

// Returns { role: 'admin' | 'coadmin', email } or null when nobody is signed in.
export async function getActor(request, env) {
  const session = await readSession(request, env);
  if (!session) return null;
  if (session.r === 'admin') return { role: 'admin', email: null };
  if (session.r === 'coadmin' && session.e) {
    const { record } = await findCoadmin(env, session.e);
    if (record && sessionFingerprint(record.password_hash) === session.pv) return { role: 'coadmin', email: record.email };
  }
  return null;
}

// ---------- Supabase (server side only, secret key) ----------
export async function databaseRequest(env, resource, init = {}) {
  const url = String(env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const key = String(env.SUPABASE_SECRET_KEY || '').trim();
  if (!url || !key) return { response: null, data: null, error: 'Supabase admin access is not configured. Add SUPABASE_URL and SUPABASE_SECRET_KEY in Cloudflare Pages.' };
  let response;
  try {
    response = await fetch(`${url}/rest/v1/${resource}`, {
      ...init,
      headers: {
        apikey: key,
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

export async function findCoadmin(env, email) {
  const query = new URLSearchParams({ email: `eq.${email}`, select: 'email,password_hash', limit: '1' });
  const result = await databaseRequest(env, `coadmins?${query}`);
  if (result.error) return { record: null, error: result.error };
  return { record: Array.isArray(result.data) && result.data[0] ? result.data[0] : null, error: null };
}

// Who may add events: 'admin' (admin only), 'coadmin' (admin and co-admins) or 'anyone'.
export async function getMode(env) {
  const query = new URLSearchParams({ key: 'eq.who_can_add', select: 'value', limit: '1' });
  const result = await databaseRequest(env, `app_settings?${query}`);
  const value = !result.error && Array.isArray(result.data) && result.data[0] ? result.data[0].value : '';
  return MODES.includes(value) ? value : DEFAULT_MODE;
}

export function canAddEvents(actor, mode) {
  if (actor && actor.role === 'admin') return true;
  if (actor && actor.role === 'coadmin') return mode !== 'admin';
  return mode === 'anyone';
}
