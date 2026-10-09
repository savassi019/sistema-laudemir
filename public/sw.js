const BUILD_ID = "BUILD_ID_PLACEHOLDER";
const STATIC_CACHE = `infinity-static-${BUILD_ID}`;
const PRIVATE_CACHE_PREFIX = "infinity-operations-";
const PRIVATE_CACHE_BUILD_PREFIX = `${PRIVATE_CACHE_PREFIX}${BUILD_ID}-`;
const OFFLINE_META_URL = "/__infinity_offline_meta__";
let preparationEpoch = 0;

const PUBLIC_ASSETS = [
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/app-icon.svg",
  "/infinity-emblema.png",
];

function privateCacheName(scope) {
  return `${PRIVATE_CACHE_BUILD_PREFIX}${encodeURIComponent(scope)}`;
}

async function privateCacheNames() {
  const names = await caches.keys();
  return names.filter((name) => name.startsWith(PRIVATE_CACHE_PREFIX)).reverse();
}

async function activePrivateCacheName() {
  const names = await privateCacheNames();
  return names.find((name) => name.startsWith(PRIVATE_CACHE_BUILD_PREFIX)) ?? names[0] ?? null;
}

async function clearPrivateCaches(except) {
  const names = await privateCacheNames();
  await Promise.all(names.filter((name) => name !== except).map((name) => caches.delete(name)));
}

function navigationKey(request) {
  const url = new URL(request.url);
  return new Request(`${url.origin}${url.pathname}`, { method: "GET" });
}

function rscKey(request) {
  const url = new URL(request.url);
  url.searchParams.delete("_rsc");
  url.searchParams.set("__infinity_offline_rsc", "1");
  return new Request(url.toString(), { method: "GET" });
}

function isRscRequest(request, url) {
  return request.headers.get("RSC") === "1" || url.searchParams.has("_rsc");
}

function isCacheableAuthenticatedResponse(response) {
  if (!response.ok || response.type === "opaqueredirect") return false;
  const responseUrl = new URL(response.url);
  return responseUrl.origin === self.location.origin && responseUrl.pathname !== "/login";
}

async function readAllowedRoutes(cacheName) {
  if (!cacheName) return [];
  const cache = await caches.open(cacheName);
  const response = await cache.match(OFFLINE_META_URL);
  if (!response) return [];
  try {
    const data = await response.json();
    return Array.isArray(data.routes) ? data.routes : [];
  } catch {
    return [];
  }
}

async function cacheDocumentResources(cache, response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) return;
  const html = await response.clone().text();
  const urls = new Set();
  for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
    const value = match[1];
    if (value?.startsWith("/_next/static/") || PUBLIC_ASSETS.includes(value)) urls.add(value);
  }
  await Promise.allSettled(
    [...urls].map(async (url) => {
      const asset = await fetch(url, { credentials: "include", cache: "no-store" });
      if (asset.ok) await cache.put(url, asset);
    }),
  );
}

async function prepareOfflineOperations(scope, routes) {
  if (!scope || !Array.isArray(routes) || routes.length === 0) return;
  const epoch = preparationEpoch;
  const cacheName = privateCacheName(scope);
  const cache = await caches.open(cacheName);
  const cachedRoutes = [];
  const requestedRoutes = [...new Set(routes)].filter(
    (route) => typeof route === "string" && route.startsWith("/"),
  );

  for (const route of requestedRoutes) {
    if (epoch !== preparationEpoch) {
      await caches.delete(cacheName);
      return;
    }
    try {
      const response = await fetch(route, { credentials: "include", cache: "no-store" });
      if (epoch !== preparationEpoch) {
        await caches.delete(cacheName);
        return;
      }
      if (!isCacheableAuthenticatedResponse(response)) continue;
      await cache.put(route, response.clone());
      await cacheDocumentResources(cache, response);
      cachedRoutes.push(route);
    } catch {
      // Mantem a versao anterior. A preparacao tenta novamente na proxima abertura.
    }
  }

  if (cachedRoutes.length === 0) return;
  await cache.put(
    OFFLINE_META_URL,
    new Response(JSON.stringify({ scope, routes: cachedRoutes, buildId: BUILD_ID }), {
      headers: { "Content-Type": "application/json" },
    }),
  );
  // Uma falha isolada nao pode apagar a versao anterior que ainda funciona
  // offline. O cache antigo so sai quando todas as rotas foram renovadas.
  if (cachedRoutes.length === requestedRoutes.length) await clearPrivateCaches(cacheName);
  const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  windows.forEach((client) => client.postMessage({ type: "OFFLINE_OPERATIONS_READY", routes: cachedRoutes }));
}

async function matchPrivate(request, keyFactory) {
  for (const cacheName of await privateCacheNames()) {
    const cached = await caches.match(keyFactory(request), { cacheName });
    if (cached) return cached;
  }
  return null;
}

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      Promise.allSettled(PUBLIC_ASSETS.map((url) => cache.add(url))),
    ),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith("infinity-static-") && name !== STATIC_CACHE)
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "PREPARE_OFFLINE_OPERATIONS") {
    event.waitUntil(prepareOfflineOperations(event.data.scope, event.data.routes));
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.method === "POST" && url.pathname === "/api/auth/logout") {
    event.respondWith(
      fetch(request).then(async (response) => {
        if (response.status >= 200 && response.status < 400) {
          preparationEpoch += 1;
          await clearPrivateCaches();
        }
        return response;
      }),
    );
    return;
  }

  if (request.method !== "GET") return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then(async (cached) => {
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(STATIC_CACHE);
          await cache.put(request, response.clone());
        }
        return response;
      }),
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          if (isCacheableAuthenticatedResponse(response)) {
            const cacheName = await activePrivateCacheName();
            const allowedRoutes = await readAllowedRoutes(cacheName);
            if (cacheName && allowedRoutes.includes(url.pathname)) {
              const cache = await caches.open(cacheName);
              await cache.put(navigationKey(request), response.clone());
              await cacheDocumentResources(cache, response);
            }
          }
          return response;
        } catch {
          const cached = await matchPrivate(request, navigationKey);
          if (cached) return cached;
          return new Response(
            "<!doctype html><html lang=\"pt-BR\"><meta name=\"viewport\" content=\"width=device-width\"><meta name=\"theme-color\" content=\"#0b0f0e\"><title>Infinity ERP offline</title><body style=\"margin:0;background:#0b0f0e;color:#f5f1e8;font:16px system-ui;display:grid;min-height:100vh;place-items:center;padding:24px;box-sizing:border-box\"><main style=\"max-width:420px;border:1px solid #4b3b20;border-radius:20px;padding:24px;background:#141711\"><h1 style=\"font-size:20px;margin-top:0\">Sem conexao</h1><p>Abra uma operacao ao menos uma vez com internet para deixa-la disponivel neste aparelho.</p><button onclick=\"location.reload()\" style=\"min-height:44px;border:0;border-radius:12px;padding:0 18px;background:#d1a04f;color:#0b0f0e;font-weight:700\">Tentar novamente</button></main></body></html>",
            { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } },
          );
        }
      })(),
    );
    return;
  }

  if (isRscRequest(request, url)) {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          if (isCacheableAuthenticatedResponse(response)) {
            const cacheName = await activePrivateCacheName();
            const allowedRoutes = await readAllowedRoutes(cacheName);
            if (cacheName && allowedRoutes.includes(url.pathname)) {
              const cache = await caches.open(cacheName);
              await cache.put(rscKey(request), response.clone());
            }
          }
          return response;
        } catch {
          return (await matchPrivate(request, rscKey)) ?? Response.error();
        }
      })(),
    );
  }
});

self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? "Sistema Laudemir", {
      body: data.body ?? "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: data.url ?? "/modulos" },
      tag: "alertas",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/modulos";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const found = windows.find((windowClient) => windowClient.url.includes(url));
      if (found) return found.focus();
      return self.clients.openWindow(url);
    }),
  );
});
