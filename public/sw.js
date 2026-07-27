const CACHE = "laudemir-6PK-II9agsRGnofP17dCr";

const PRECACHE_PAGES = [
  "/dashboard",
  "/modulos",
  "/painel",
  "/relatorio",
  "/equipe",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.allSettled(PRECACHE_PAGES.map((url) => cache.add(url))),
    ),
  );
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

  // Navegação (GET de página): network-first, depois atualiza cache, fallback para versão anterior
  if (request.method === "GET" && request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE).then((c) => c.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached ?? Response.error())),
    );
    return;
  }

  // Tudo mais (server actions, API): network-first, fallback para cache quando disponível
  event.respondWith(
    fetch(request).catch(() => caches.match(request)),
  );
});

self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? "Sistema Laudemir", {
      body: data.body ?? "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: data.url ?? "/dashboard" },
      tag: "alertas",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/dashboard";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      const found = wins.find((w) => w.url.includes(url));
      if (found) return found.focus();
      return self.clients.openWindow(url);
    }),
  );
});
