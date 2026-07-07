const CACHE = "laudemir-BUILD_ID_PLACEHOLDER";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      const stale = keys.filter((k) => k !== CACHE);
      if (stale.length > 0) {
        await Promise.all(stale.map((k) => caches.delete(k)));
        const clientList = await self.clients.matchAll({ type: "window" });
        clientList.forEach((c) => c.navigate(c.url));
      }
    })(),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Cache estático do Next.js
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            const clone = response.clone();
            caches.open(CACHE).then((c) => c.put(request, clone));
            return response;
          }),
      ),
    );
    return;
  }

  // Imagens e fontes
  if (request.destination === "image" || request.destination === "font") {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            const clone = response.clone();
            caches.open(CACHE).then((c) => c.put(request, clone));
            return response;
          }),
      ),
    );
    return;
  }

  // Tudo mais: network-first, fallback para cache
  event.respondWith(
    fetch(request).catch(() => caches.match(request)),
  );
});
