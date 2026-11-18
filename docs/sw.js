const CACHE_NAME = "hobby-hub-pwa-content-671d8f426658";
const APP_SHELL = [
  "/hobby-hub/",
  "/hobby-hub/index.html",
  "/hobby-hub/offline.html",
  "/hobby-hub/manifest.webmanifest",
  "/hobby-hub/assets/icons/icon-192.png",
  "/hobby-hub/assets/icons/icon-512.png",
  "/hobby-hub/assets/hobby-hub-night-librarian.webp",
  "/hobby-hub/assets/css/app.css?v=content-671d8f426658",
  "/hobby-hub/assets/css/pwa.css?v=content-671d8f426658",
  "/hobby-hub/assets/js/flavor-messages.js?v=content-671d8f426658",
  "/hobby-hub/assets/js/app.js?v=content-671d8f426658",
  "/hobby-hub/assets/js/pwa-client.js?v=content-671d8f426658",
  "/hobby-hub/assets/night-study/aviation-arrival.webp",
  "/hobby-hub/assets/night-study/bookshelf-arrival.webp",
  "/hobby-hub/assets/night-study/bookshelf-before.webp",
  "/hobby-hub/assets/night-study/foreground-lamp.webp",
  "/hobby-hub/assets/night-study/games-arrival.webp",
  "/hobby-hub/assets/night-study/games-closed.webp",
  "/hobby-hub/assets/night-study/night-study.webp",
  "/hobby-hub/assets/night-study/terminal-arrival.webp",
  "/hobby-hub/assets/night-study/terminal-open.webp",
  "/hobby-hub/assets/night-study/window-look-up.webp",
  "/hobby-hub/room-library/index.html",
  "/hobby-hub/celestiframe/index.html",
  "/hobby-hub/jack-load/index.html",
  "/hobby-hub/sudoku/index.html",
  "/hobby-hub/737-study-finder/index.html",
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
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('hobby-hub-pwa-') && key !== CACHE_NAME).map((key) => caches.delete(key)))));
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