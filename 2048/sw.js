// 2048 laboratuvarı: çok çekirdekli AI için sayfanın "cross-origin isolated" olması gerekir (SharedArrayBuffer).
// GitHub Pages COOP / COEP başlıklarını gönderemez; bu service worker sitenin kendi yanıtlarına ekler.
// Sadece /2048/ altındaki sayfaları kontrol eder, hiçbir şey saklamaz (önbellek yok), başka sitelere dokunmaz.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.cache === 'only-if-cached' && req.mode !== 'same-origin') return;
  if (new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(fetch(req).then((res) => {
    if (res.status === 0 || res.type === 'opaqueredirect') return res;
    const headers = new Headers(res.headers);
    headers.set('Cross-Origin-Opener-Policy', 'same-origin');
    headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
    headers.set('Cross-Origin-Resource-Policy', 'same-origin');
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
  }));
});
