const CACHE_NAME = "ev-hesap-shell-v2";
const APP_SHELL = ["/offline.html", "/icon.svg", "/icon-192.png", "/icon-512.png", "/icon-maskable.png", "/apple-icon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key.startsWith("ev-hesap-shell-") && key !== CACHE_NAME).map((key) => caches.delete(key)),
    )),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
  if (event.request.mode !== "navigate") return;

  event.respondWith(
    fetch(event.request).catch(async () => (await caches.match("/offline.html")) || Response.error()),
  );
});
