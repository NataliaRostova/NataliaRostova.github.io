/* The build replaces both tokens; this file is never registered in development. */
const VERSION = "e00c91dcf74fab0d";
const FILES = ["archives/RHINE-LAB-X-001.txt","archives/RHINE-LAB-X-002.txt","archives/RHINE-LAB-X-003.txt","archives/RHINE-LAB-X-004.txt","archives/RHINE-LAB-X-005.txt","archives/RHINE-LAB-X-006.txt","archives/RHINE-LAB-X-007.txt","archives/RHINE-LAB-X-008.txt","archives/RHINE-LAB-X-009.txt","archives/RHINE-LAB-X-010.txt","archives/RHINE-LAB-X-011.txt","archives/RHINE-LAB-X-012.txt","archives/RHINE-LAB-X-013.txt","archives/RHINE-LAB-X-014.txt","archives/RHINE-LAB-X-015.txt","archives/RHINE-LAB-X-016.txt","archives/RHINE-LAB-X-017.txt","archives/RHINE-LAB-X-018.txt","archives/RHINE-LAB-X-019.txt","archives/RHINE-LAB-X-020.txt","archives/RHINE-LAB-X-021.txt","archives/RHINE-LAB-X-022.txt","archives/RHINE-LAB-X-023.txt","archives/RHINE-LAB-X-024.txt","archives/RHINE-LAB-X-025.txt","archives/RHINE-LAB-X-026.txt","archives/RHINE-LAB-X-027.txt","archives/RHINE-LAB-X-028.txt","archives/RHINE-LAB-X-029.txt","archives/RHINE-LAB-X-030.txt","archives/RHINE-LAB-X-031.txt","archives/RHINE-LAB-X-032.txt","archives/RHINE-LAB-X-033.txt","archives/RHINE-LAB-X-034.txt","archives/RHINE-LAB-X-035.txt","archives/RHINE-LAB-X-036.txt","archives/RHINE-LAB-X-037.txt","archives/RHINE-LAB-X-038.txt","archives/RHINE-LAB-X-039.txt","archives/RHINE-LAB-X-040.txt","assets/archive-assembly.d411170676f55a32.glb","assets/archive-cassette.dda42b9b3b471d11.glb","assets/main-CjLCG6ca.js","assets/main-D3_LpsWI.css","assets/modulepreload-polyfill-B5Qt9EMX.js","assets/portfolio-Buoudxqb.js","assets/portfolio-Dso5hCY4.css","audio/atmosphere.ogg","audio/motif.ogg","audio/pulse.ogg","charts/ad_spread_liquidity.png","charts/au2702_kline_signals.png","charts/dca_vs_dynamic_equity.png","charts/iv_feature_importance.png","charts/qdii_attribution_premium.png","charts/risk_return_frontier.png","charts/roc_ks_curve.png","charts/score_distribution_ecl.png","charts/strategy_equity_drawdown.png","charts/workflow_summary_chart.png","demo/optimizer.css","demo/optimizer.html","demo/optimizer.js","favicon.svg","fonts/MiSans-license.pdf","fonts/NOTICE.txt","icons/app-icon.svg","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon-maskable-512.png","index.html","licenses/rolling-number.txt","manifest.webmanifest","portfolio.html"];
const PREFIX = `rhine-lab:${new URL(self.registration.scope).pathname}:`;
const CACHE = PREFIX + VERSION;
const urls = FILES.map(path => new URL(path, self.registration.scope).href);
const allowed = new Set(urls);
const index = new URL("index.html", self.registration.scope).href;

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE);
      // Limit connections so a complete font family does not flood the page.
      // Keep successful files private until every resource is present; failure
      // still deletes this entire release and leaves the active release intact.
      let next = 0;
      const workers = Array.from({ length: 6 }, async () => {
        while (next < urls.length) {
          const url = urls[next++];
          const immutable = /\/fonts\/misans-webfont-4\.3\.1\//.test(url) || /\/assets\/archive-(cassette|assembly)\.[a-f0-9]{16}\.glb$/.test(url);
          await cache.add(new Request(url, { cache: immutable ? "default" : "no-cache" }));
        }
      });
      const results = await Promise.allSettled(workers);
      const failure = results.find(result => result.status === "rejected");
      if (failure) throw failure.reason;
    } catch (error) {
      await caches.delete(CACHE);
      throw error;
    }
  })());
});
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys())
      if (key.startsWith(PREFIX) && key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});
self.addEventListener("message", event => {
  if (event.data?.type === "RHINE_APPLY_UPDATE") event.waitUntil(self.skipWaiting());
});
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  url.search = "";
  url.hash = "";
  const navigation = event.request.mode === "navigate" &&
    (url.href === self.registration.scope || url.href === index);
  const key = navigation ? index : url.href;
  if (!allowed.has(key)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // HTML, hashed bundles and stable model URLs come from the same release.
    // A new release stays waiting until the user chooses to restart or exits.
    const cached = await cache.match(key);
    return cached ?? fetch(event.request);
  })());
});
