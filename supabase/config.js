// Public browser config is delivered by a Cloudflare Pages Function. Do not add secrets here.
window.SUPABASE_CONFIG = { url: '', publishableKey: '', anonKey: '' };
window.SUPABASE_CONFIG_ENDPOINT_AVAILABLE = false;
window.SUPABASE_CONFIG_READY = fetch('/api/config', { cache: 'no-store', headers: { Accept: 'application/json' } })
  .then(response => { if (!response.ok) throw new Error('Public Supabase config is not available.'); return response.json(); })
  .then(config => {
    window.SUPABASE_CONFIG_ENDPOINT_AVAILABLE = true;
    window.SUPABASE_CONFIG = {
      url: String(config.supabaseUrl || '').trim(),
      publishableKey: String(config.supabasePublishableKey || '').trim(),
      anonKey: String(config.supabasePublishableKey || '').trim()
    };
  })
  .catch(() => { /* local development without Pages Functions remains local-only */ });
