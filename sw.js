const CACHE_NAME = "nostack-pwa-v2";
const OFFLINE_ASSETS = [
    "/",
    "/nostack.js",
    "/style.css",
    "/common.css",
    "/darkmode.js",
    "/manifest.json",
    "/default-modern.css",
    "/api/known_models.json",
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
    "/res/fonts/Bitter.woff2",
    "/res/fonts/Bitter-Italic.woff2",
    "/res/fonts/DMSans.woff2",
    "/res/fonts/DMSans-Italic.woff2",
    "/res/fonts/FiraCode.woff2",
    "/res/fonts/RobotoSlab.woff2",
    "/libs/markdown-it.min.js",
    "/libs/purify.min.js",
    "/libs/highlight.min.js",
    "/libs/powershell.min.js",
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        (async () => {
            const cache = await caches.open(CACHE_NAME);
            const results = await Promise.allSettled(OFFLINE_ASSETS.map((u) => cache.add(u)));
            // Log any failures to pre-cache assets
            console.log("Pre-caching completed:", results);
            if (results.every((r) => r.status === "fulfilled")) {
                console.log("All assets pre-cached successfully.");
            }
            const fails = results.filter((r) => r.status === "rejected");
            if (fails.length) console.warn("Precaching failures:", fails);
        })()
    );
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        (async () => {
            const keys = await caches.keys();
            await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
            await self.clients.claim();
        })()
    );
});

function isPrecached(req) {
    const url = new URL(req.url);
    return OFFLINE_ASSETS.includes(req.url) || (url.origin === self.location.origin && OFFLINE_ASSETS.includes(url.pathname));
}

self.addEventListener("fetch", (event) => {
    const { request } = event;
    if (request.method !== "GET") return;

    if (request.mode === "navigate") {
        event.respondWith(
            (async () => {
                try {
                    const resp = await fetch(request);
                    const cache = await caches.open(CACHE_NAME);
                    try {
                        cache.put("/", resp.clone());
                    } catch (_) {}
                    return resp;
                } catch (_) {
                    const cache = await caches.open(CACHE_NAME);
                    return (await cache.match(request)) || (await cache.match("/")) || new Response("Offline", { status: 503 });
                }
            })()
        );
        return;
    }

    if (isPrecached(request)) {
        event.respondWith(
            (async () => {
                const cache = await caches.open(CACHE_NAME);
                const cached = await cache.match(request, { ignoreSearch: true });
                const network = fetch(request)
                    .then(async (resp) => {
                        try {
                            await cache.put(request, resp.clone());
                        } catch (_) {}
                        return resp;
                    })
                    .catch(() => undefined);
                return cached || (await network) || new Response("Offline", { status: 503 });
            })()
        );
        return;
    }
});
