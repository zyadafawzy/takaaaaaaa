/* تِكّة service worker — سياسة caching محسوبة. */
const VERSION = "tikka-v1";
const SHELL_CACHE = `${VERSION}-shell`;
const IMAGE_CACHE = `${VERSION}-images`;
const DATA_CACHE = `${VERSION}-data`;

const SHELL_ASSETS = ["/", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];
const MAX_IMAGE_ENTRIES = 120;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS).catch(() => undefined))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  await Promise.all(keys.slice(0, keys.length - maxEntries).map((key) => cache.delete(key)));
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // الطلب النهائي وأي مسار تشغيلي: شبكة فقط.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/checkout")) {
    return;
  }

  // صور المنتجات والأصول: cache-first بحد أقصى للعدد.
  if (request.destination === "image") {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(IMAGE_CACHE).then((cache) => {
              cache.put(request, copy);
              trimCache(IMAGE_CACHE, MAX_IMAGE_ENTRIES);
            });
            return response;
          }),
      ),
    );
    return;
  }

  // الملاحة وبيانات الكتالوج: stale-while-revalidate.
  if (request.mode === "navigate" || request.destination === "document") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(DATA_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match("/"))),
    );
    return;
  }

  if (["style", "script", "font"].includes(request.destination)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((response) => {
            const copy = response.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
            return response;
          })
          .catch(() => cached);
        return cached || network;
      }),
    );
  }
});
