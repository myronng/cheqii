/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

const sw = /** @type {ServiceWorkerGlobalScope} */ (/** @type {unknown} */ (self));
import { build, files, version } from "$service-worker";

// Deploy-versioned cache so a new build invalidates the old one.
const CACHE = `cache-${version}`;

// Hashed, immutable build output + static files — safe to cache-first forever.
const ASSETS = new Set([...build, ...files]);

sw.addEventListener("install", (event) => {
  // Precache the app shell; activate immediately so the new SW can take over.
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll([...build, ...files]))
      .then(() => sw.skipWaiting()),
  );
});

sw.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key !== CACHE) await caches.delete(key);
      }
      await sw.clients.claim();
    })(),
  );
});

// Let the page trigger an update (the "new version available" prompt → reload).
sw.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") sw.skipWaiting();
});

sw.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return; // writes go through the outbox, never cached

  const url = new URL(request.url);

  // NEVER cache authoritative/dynamic responses (sync spec §3.6b):
  //  - our own API surface (/api/*) — staleness would corrupt sync
  //  - cross-origin requests (Supabase REST/Auth/Realtime) — staleness + leaking
  //    authed data into the cache
  if (url.origin !== sw.location.origin || url.pathname.startsWith("/api/")) {
    return; // fall through to the network, untouched
  }

  // Immutable build assets → cache-first.
  if (ASSETS.has(url.pathname)) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => (await cache.match(url.pathname)) ?? fetch(request)),
    );
    return;
  }

  // Everything else (navigations/pages) → network-first, fall back to cache so
  // offline deep links still resolve via the app shell.
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      try {
        const response = await fetch(request);
        if (response instanceof Response && response.status === 200) {
          cache.put(request, response.clone());
        }
        return response;
      } catch (err) {
        const cached = (await cache.match(request)) ?? (await cache.match("/"));
        if (cached) return cached;
        throw err;
      }
    })(),
  );
});
