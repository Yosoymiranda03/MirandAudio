const CACHE_NAME = "mirand-audio-v2";

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

// Estrategia: network-first para los recursos base de la app.
// Siempre intenta traer la versión más nueva del servidor primero;
// solo usa el caché como respaldo si no hay conexión. Así, cuando
// subes cambios a GitHub, se reflejan de inmediato en vez de quedar
// atascados con una versión vieja guardada en el navegador.
// Los archivos de audio del usuario nunca pasan por aquí (se
// procesan en memoria, no se solicitan por red).
self.addEventListener("fetch", (event) => {

    if (event.request.method !== "GET") return;

    event.respondWith(
        fetch(event.request)
            .then((response) => {

                const responseClone = response.clone();

                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseClone);
                });

                return response;
            })
            .catch(() => caches.match(event.request))
    );
});
