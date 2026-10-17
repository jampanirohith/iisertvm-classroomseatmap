const COOKIE_NAME = 'lhc_admin_session';
const SESSION_SECONDS = 8 * 60 * 60;
const encoder = new TextEncoder();

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

async function sign(expiry, password) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(`lhc-admin:${expiry}`));
  let binary = '';
  for (const byte of new Uint8Array(signature)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export async function sessionCookie(password, requestUrl, logout = false) {
  const secure = new URL(requestUrl).protocol === 'https:' ? '; Secure' : '';
  if (logout) return `${COOKIE_NAME}=; Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age=0${secure}`;
  const expiry = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const signature = await sign(expiry, password);
  return `${COOKIE_NAME}=${expiry}.${signature}; Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age=${SESSION_SECONDS}${secure}`;
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

export async function isAdmin(request, env) {
  const password = String(env.ADMIN_PASSWORD || '');
  if (!password) return false;
  const token = readCookie(request, COOKIE_NAME);
  const dot = token.indexOf('.');
  if (dot < 1) return false;
  const expiry = token.slice(0, dot);
  const supplied = token.slice(dot + 1);
  if (!/^\d{10,}$/.test(expiry) || !supplied) return false;
  const exp = Number(expiry);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(exp) || exp <= now || exp > now + SESSION_SECONDS + 60) return false;
  try { return constantTimeEqual(supplied, await sign(expiry, password)); }
  catch { return false; }
}
