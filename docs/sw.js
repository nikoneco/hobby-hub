const CACHE_NAME = "hobby-hub-pwa-20260708-startup-fix";
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
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match("/hobby-hub/offline.html")));
    return;
  }
  event.respondWith(
    fetch(event.request).then((response) => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
      return response;
    }).catch(() => caches.match(event.request))
  );
});