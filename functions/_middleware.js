// Keeps files that are not part of the website (tests, SQL, notes) from being served on the public site.
// The website itself, supabase/config.js and the /api functions are unaffected.
const PRIVATE = [/^\/tests\//i, /^\/supabase\/.*\.sql$/i, /\.md$/i, /^\/(\.git|\.env|\.dev\.vars|\.wrangler)/i, /^\/(package(-lock)?\.json|STATUS\.txt|ideas\.txt)$/i];

export async function onRequest({ request, next }) {
  const { pathname } = new URL(request.url);
  if (PRIVATE.some(pattern => pattern.test(pathname))) return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  return next();
}
