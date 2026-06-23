/*
 * POWDER Web -- service worker (offline + installable PWA).
 *
 * Strategy:
 *   - navigations (index.html): network-first, fall back to cached shell offline
 *   - everything else (versioned app.js/style.css/powder.js/powder.wasm/icons):
 *     cache-first, with runtime caching of anything fetched but not precached
 *
 * Bump CACHE_VERSION (and the ?v= in index.html / ASSET_VERSION in app.js) on
 * each release to invalidate the old cache. The activate handler prunes stale
 * caches. The save data lives in IndexedDB (IDBFS), not here, so updating the
 * app never touches the player's saves.
 */
var CACHE_VERSION = "v6";
var CACHE = "powder-" + CACHE_VERSION;

var SHELL = [
  "./",
  "./index.html",
  "./app.js?v=6",
  "./style.css?v=6",
  "./powder.js?v=6",
  "./powder.wasm?v=6",
  "./manifest.webmanifest",
  "./assets/icon.svg",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/icon-180.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(SHELL); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.filter(function (k) { return k !== CACHE; })
                               .map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  if (new URL(req.url).origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).catch(function () {
        return caches.match("./index.html").then(function (r) { return r || caches.match("./"); });
      })
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(function (hit) {
      return hit || fetch(req).then(function (resp) {
        if (resp && resp.ok && resp.type === "basic") {
          var copy = resp.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return resp;
      });
    })
  );
});
