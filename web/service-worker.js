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
var CACHE_VERSION = "v35";
var CACHE = "powder-" + CACHE_VERSION;
var CACHE_PREFIX = "powder-";

var SHELL = [
  "./",
  "./index.html",
  "./app.js?v=35",
  "./style.css?v=35",
  "./powder.js?v=35",
  "./powder.wasm?v=35",
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
        // GitHub project sites share an origin. Never delete caches belonging
        // to another application hosted under the same github.io account.
        return Promise.all(keys.filter(function (k) {
                                 return k.indexOf(CACHE_PREFIX) === 0 && k !== CACHE;
                               })
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
      fetch(req).then(function (resp) {
        if (!resp || !resp.ok) {
          return cachedShell().then(function (cached) { return cached || resp; });
        }
        var copy = resp.clone();
        return caches.open(CACHE)
          .then(function (c) { return c.put("./index.html", copy); })
          .catch(function () {})
          .then(function () { return resp; });
      }).catch(cachedShell)
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

function cachedShell() {
  return caches.match("./index.html").then(function (r) {
    return r || caches.match("./");
  });
}
