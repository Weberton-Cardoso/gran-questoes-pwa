/**
 * Service Worker - Trilha de Aprovação
 * Faz cache dos arquivos estáticos para o app funcionar 100% offline
 * (dados ficam no IndexedDB, não no cache).
 */

const CACHE_NAME = 'trilha-aprovacao-v2';

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './database.js',
  './charts.js',
  './manifest.json',
  './assets/icon-192.png',
  './assets/icon-512.png'
];

// Instala o SW e guarda os arquivos essenciais em cache
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

// Remove caches antigos quando uma nova versão do SW assume
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Estratégia: cache-first para os arquivos do app, com fallback de rede.
// Bibliotecas externas (Chart.js, fontes) usam network-first para não travar
// caso o CDN atualize, mas caem para cache se estiver offline.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  const isSameOrigin = url.origin === self.location.origin;

  if (isSameOrigin) {
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req))
    );
  } else {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          return res;
        })
        .catch(() => caches.match(req))
    );
  }
});
