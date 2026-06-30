/* SüdEnergie PV Rechner – Service Worker
   Strategie: network-first (online = immer frische Dateien), Cache-Fallback offline.
   Bei jedem Deploy mit geänderten Dateien CACHE-Version hochzählen. */
const CACHE = 'se-rechner-v4';
const CORE = [
  './',
  './index.html',
  './pdf-preview.html',
  './pdf-preview-data.js',
  './pdf-preview.css',
  './manifest.json',
  './assets/suedenergie-logo.png',
  './assets/cover-house-p1-new.png',
  './assets/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(CORE); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== location.origin) return; // Fremd-Origins normal durchreichen

  e.respondWith(
    fetch(req, { cache: 'no-cache' }).then(function (res) {
      if (res && res.ok) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); }).catch(function () {});
      }
      return res;
    }).catch(function () {
      // Offline: aus Cache bedienen (ignoreSearch, damit ?t=… der PDF-Daten matcht)
      return caches.match(req, { ignoreSearch: true }).then(function (cached) {
        return cached || (req.mode === 'navigate' ? caches.match('./index.html') : undefined);
      });
    })
  );
});
