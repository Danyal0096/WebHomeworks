const CACHE = "sonora-shell-v1";
const SHELL = ["/", "/manifest.webmanifest", "/icons/sonora.svg"];
self.addEventListener("install", (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL))));
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || event.request.url.includes("/media/audio/")) return;
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request).then((r) => r || caches.match("/"))));
});
