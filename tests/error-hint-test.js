'use strict';
// The admin page used to show one vague Supabase error for every problem. Each common cause now gets its own hint.
const path = require('path');
const assert = require('assert/strict');
const { pathToFileURL } = require('url');

(async () => {
  const events = await import(pathToFileURL(path.join(__dirname, '../functions/api/admin/events.js')).href);
  const env = { SUPABASE_URL: 'https://fake-project.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_test', ADMIN_PASSWORD: 'admin' };
  const realFetch = globalThis.fetch, realError = console.error;
  console.error = () => {};
  const ask = async (status, body) => {
    globalThis.fetch = async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
    const response = await events.onRequest({ request: new Request('https://site.dev/api/admin/events?roomId=lhc-jupiter'), env });
    return { status: response.status, error: (await response.json()).error };
  };
  try {
    assert.match((await ask(400, { code: '42703', message: 'column events.created_by does not exist' })).error, /run supabase\/schema\.sql again/i);
    assert.match((await ask(404, { code: 'PGRST205', message: 'Could not find the table public.events' })).error, /table is missing/i);
    assert.match((await ask(401, { message: 'Invalid API key' })).error, /rejected the key/i);
    assert.match((await ask(403, { code: '42501', message: 'permission denied for table events' })).error, /secret key/i);
    assert.match((await ask(500, { message: 'boom' })).error, /Check the schema and Cloudflare environment settings/);
    const text = JSON.stringify(await ask(401, { message: 'Invalid API key' }));
    assert.ok(!text.includes('sb_secret_test'), 'hints never include the key');
  } finally { globalThis.fetch = realFetch; console.error = realError; }
  console.log('PASS: Supabase failures give a specific, safe hint');
})().catch(error => { console.error(error); process.exit(1); });
