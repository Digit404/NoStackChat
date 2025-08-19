const CACHE_NAME = "nostack-pwa-v1";
const OFFLINE_ASSETS = [
    "/",
    "/nostack.js",
    "/style.css",
    "/known_models.json",
    "/darkmode.js",
    "/manifest.json",
    "/res/Claude-3.5.png",
    "/res/Claude-3.7.png",
    "/res/Claude-4.png",
    "/res/GPT_mini.png",
    "/res/GPT_nano.png",
    "/res/GPT_plus.png",
    "/res/GPT_search.png",
    "/res/GPT_standard.png",
    "/res/icon-192.png",
    "/res/icon-512.png",
    "/res/o3-mini.png",
    "/res/o3.png",
    "/res/o4-mini.png",
    "/res/o4.png",
    "/res/OpenAI.png",
    "https://www.rebitwise.com/tools/common.css",
    "https://www.rebitwise.com/default-modern.css",
    "https://cdn.jsdelivr.net/npm/markdown-it/dist/markdown-it.min.js",
    "https://cdn.jsdelivr.net/npm/dompurify/dist/purify.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/highlight.min.js",
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            for (const asset of OFFLINE_ASSETS) {
                cache.add(asset).catch((err) => console.error(`Failed to cache ${asset}:`, err));
            }
        })
    );
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))));
    self.clients.claim();
});

self.addEventListener("fetch", (event) => {
    const { request } = event;

    if (!OFFLINE_ASSETS.includes(request.url) && !OFFLINE_ASSETS.includes(new URL(request.url).pathname)) return;

    event.respondWith(
        caches.match(request).then((cachedResp) => {
            const networkFetch = fetch(request)
                .then((resp) => {
                    return caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, resp.clone());
                        return resp;
                    });
                })
                .catch(() => cachedResp);
            return cachedResp || networkFetch;
        })
    );
});
