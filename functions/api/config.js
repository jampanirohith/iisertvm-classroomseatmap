export async function onRequestGet({ env }) {
  // Only public browser configuration is returned. Do not add ADMIN_PASSWORD or SUPABASE_SECRET_KEY here.
  return Response.json({
    supabaseUrl: String(env.SUPABASE_URL || '').trim(),
    supabasePublishableKey: String(env.SUPABASE_PUBLISHABLE_KEY || '').trim()
  }, {
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}
