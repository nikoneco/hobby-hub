const CACHE_NAME = "hobby-hub-pwa-1783467074204";
const APP_SHELL = [
  "/hobby-hub/",
  "/hobby-hub/index.html",
  "/hobby-hub/offline.html",
  "/hobby-hub/manifest.webmanifest",
  "/hobby-hub/assets/css/app.css",
  "/hobby-hub/assets/css/pwa.css",
  "/hobby-hub/assets/js/gas-run-shim.js",
  "/hobby-hub/assets/js/app.js",
  "/hobby-hub/assets/js/pwa-client.js",
  "/hobby-hub/737-study-finder/index.html",
  "/hobby-hub/737-study-finder/assets/css/app.css",
  "/hobby-hub/737-study-finder/assets/css/pwa.css",
  "/hobby-hub/737-study-finder/assets/js/gas-run-shim.js",
  "/hobby-hub/737-study-finder/assets/js/app.js",
  "/hobby-hub/737-study-finder/assets/js/pwa-client.js",
  "/hobby-hub/izakaya-scout/index.html",
  "/hobby-hub/izakaya-scout/assets/css/app.css",
  "/hobby-hub/izakaya-scout/assets/css/pwa.css",
  "/hobby-hub/izakaya-scout/assets/js/gas-run-shim.js",
  "/hobby-hub/izakaya-scout/assets/js/app.js",
  "/hobby-hub/izakaya-scout/assets/js/pwa-client.js",
  "/hobby-hub/lifeboard/index.html",
  "/hobby-hub/lifeboard/assets/css/app.css",
  "/hobby-hub/lifeboard/assets/css/pwa.css",
  "/hobby-hub/lifeboard/assets/js/gas-run-shim.js",
  "/hobby-hub/lifeboard/assets/js/app.js",
  "/hobby-hub/lifeboard/assets/js/pwa-client.js"
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).catch(() => {
      if (event.request.mode === 'navigate') {
        return caches.match("/hobby-hub/offline.html");
      }
      return cached;
    }))
  );
});