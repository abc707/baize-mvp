const CACHE_NAME = "baize-mvp-v1";
const BASE = self.location.pathname.replace(/sw\.js$/, "");

const SHELL = [
  "",
  "index.html",
  "css/styles.css",
  "js/db.js",
  "js/recorder.js",
  "js/locations.js",
  "js/app.js",
  "data/locations.json",
  "manifest.webmanifest",
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png",
  "assets/icons/icon-192-maskable.png",
  "assets/icons/icon-512-maskable.png",
  "assets/icons/apple-touch-icon.png",
  "assets/audio/shanmen.wav",
  "assets/audio/hubian.wav",
  "assets/audio/miaoyu.wav",
  "assets/audio/gucheng.wav",
  "assets/audio/shanlu.wav",
];

function toUrl(path) {
  return new URL(BASE + path, self.location.origin).href;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL.map(toUrl)))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isAudio = url.pathname.includes("/assets/audio/");
  const isShell =
    url.pathname.endsWith("/") ||
    url.pathname.endsWith("/index.html") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".webmanifest") ||
    url.pathname.endsWith("locations.json");

  if (isAudio) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (isShell) {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(cacheFirst(request));
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  const cache = await caches.open(CACHE_NAME);
  cache.put(request, response.clone());
  return response;
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    cache.put(request, response.clone());
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (request.mode === "navigate") {
      const fallback = await caches.match(toUrl("index.html"));
      if (fallback) return fallback;
    }
    throw err;
  }
}
