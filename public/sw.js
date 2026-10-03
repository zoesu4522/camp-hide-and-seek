/*
 * Camp Hide & Seek — 簡易 service worker
 * - 靜態素材（/_next/static、/camp、/icons、字型）：cache-first，營區網路不穩時不會一直重抓
 * - 頁面導覽：network-first，失敗時退回快取的首頁
 * - Supabase / API 請求：一律不攔截（realtime 仍需要網路，不做 offline sync）
 */
const VERSION = "v2";
const STATIC_CACHE = `camp-static-${VERSION}`;
const PAGE_CACHE = `camp-pages-${VERSION}`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(PAGE_CACHE).then((cache) => cache.add("/")).catch(() => undefined),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("camp-") && k !== STATIC_CACHE && k !== PAGE_CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/camp/") ||
    url.pathname.startsWith("/icons/") ||
    /\.(?:woff2?|webp|avif|png|svg)$/.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Supabase 等外部請求不攔截

  if (isStaticAsset(url)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const res = await fetch(request);
        if (res.ok) cache.put(request, res.clone());
        return res;
      }),
    );
    return;
  }

  // 後台不快取
  if (request.mode === "navigate" && !url.pathname.startsWith("/admin")) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(PAGE_CACHE).then((c) => c.put(url.pathname, copy));
          }
          return res;
        })
        .catch(async () => (await caches.match(url.pathname)) || (await caches.match("/")) || Response.error()),
    );
  }
});
