// Lets the site install as an app and open its pages without a connection.
// Pages and scripts always come from the network first, so updates show straight away; the saved copy is only a fallback.
// Live data (/api and the database) is never saved here.
const CACHE = 'lhc-shell-v3';
const SHELL = ['index.html', 'room.html', 'interactive-map.html', 'css/styles.css', 'js/format.js', 'js/data.js', 'js/store.js', 'js/home.js', 'js/room.js', 'js/map.js', 'js/cheer.js', 'js/pwa.js', 'supabase/config.js', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/cheer-cat.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => Promise.all(SHELL.map(url => cache.add(url).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  event.respondWith(
    fetch(request).then(response => {
      if (response.ok) { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(request, copy)); }
      return response;
    }).catch(() => caches.match(request, { ignoreSearch: true }).then(hit => hit || (request.mode === 'navigate' ? caches.match('index.html') : Response.error())))
  );
});
