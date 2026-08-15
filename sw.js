const CACHE_NAME = "mirand-audio-v1";

const CORE_ASSETS = [
    "./",
    "./index.html",
    "./style.css",
    "./script.js",
    "./manifest.json",
    "./icon.svg"
];

self.addEventListener("install", (event) => {

    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
    );

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
        )
    );

    self.clients.claim();
});

// Estrategia: cache-first para los recursos base de la app.
// Los archivos de audio del usuario nunca pasan por aquí (se
// procesan en memoria, no se solicitan por red).
self.addEventListener("fetch", (event) => {

    if (event.request.method !== "GET") return;

    event.respondWith(
        caches.match(event.request).then((cached) => {

            return (
                cached ||
                fetch(event.request).catch(() => cached)
            );
        })
    );
});
