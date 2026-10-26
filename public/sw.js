// Odysstay service worker: offline fallback only. Data always comes from the network so it is never stale.
const CACHE = "odysstay-shell-v1";
const OFFLINE = "/offline.html";
const PRECACHE = [OFFLINE, "/icon-192.png", "/icon-512.png", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  // Cache each file on its own so one missing file never blocks installation.
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => Promise.allSettled(PRECACHE.map((url) => c.add(url))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || req.mode !== "navigate") return;
  event.respondWith(fetch(req).catch(() => caches.match(OFFLINE)));
});
