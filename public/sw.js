// Coffee Deck service worker.
// Bump CACHE_NAME on any change to this file's caching logic so old
// clients pick up the new behavior instead of running stale code forever.
const CACHE_NAME = "coffee-deck-v1";

self.addEventListener("install", () => {
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            )
        ).then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Never touch the Stripe/checkout API — always hit the network live.
    if (url.pathname.startsWith("/api/")) {
        return;
    }

    if (request.method !== "GET") {
        return;
    }

    // Card/content data: network-first so updates (new cards, price
    // changes) show up immediately when online, falling back to the
    // last-known copy when offline.
    if (url.pathname.startsWith("/data/")) {
        event.respondWith(networkFirst(request));
        return;
    }

    // Page navigations: network-first with a cached-shell fallback so the
    // app still opens offline.
    if (request.mode === "navigate") {
        event.respondWith(networkFirst(request));
        return;
    }

    // Everything else (hashed JS/CSS bundles, fonts, card images, icons):
    // cache-first, since Vite's output filenames change on content change.
    event.respondWith(cacheFirst(request));
});

async function networkFirst(request) {
    const cache = await caches.open(CACHE_NAME);
    try {
        const response = await fetch(request);
        if (response.ok) {
            cache.put(request, response.clone());
        }
        return response;
    } catch (err) {
        const cached = await cache.match(request);
        if (cached) return cached;
        throw err;
    }
}

async function cacheFirst(request) {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;

    const response = await fetch(request);
    if (response.ok) {
        cache.put(request, response.clone());
    }
    return response;
}
