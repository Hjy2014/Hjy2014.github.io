/* ============================================================
   HJY 站点 Service Worker —— Scratch 游戏文件永久缓存
   ------------------------------------------------------------
   为什么需要它：
   游戏播放器若用跨源 iframe，浏览器会把它的
   请求按「网络分区」隔离，我们页面预热的 HTTP 缓存它完全吃不到，
   结果是每打开一次游戏都完整重新下载。
   现在播放器跑在我们自己的页面里（同源），这里用 Cache API 把
   游戏文件永久缓存（文件名即版本，内容不变），第二次打开秒进，
   断网也能玩已缓存的游戏。
   ============================================================ */
var CACHE = "hjy-games-v1";

self.addEventListener("install", function () {
  self.skipWaiting();
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url;
  try { url = new URL(req.url); } catch (err) { return; }
  /* 命中游戏文件（本站 / 或线上站的三个文件库）才接管 */
  var path = url.pathname;
  var isLocal = url.origin === self.location.origin &&
    (/^\/games\/files\//.test(path) || /^\/hjy-games-[23]\/files\//.test(path));
  var isLive = url.hostname === "hjy2014.github.io" &&
    /^\/(games|hjy-games-2|hjy-games-3)\/files\//.test(path);
  if (!isLocal && !isLive) return;
  e.respondWith(
    caches.open(CACHE).then(function (cache) {
      return cache.match(req).then(function (hit) {
        if (hit) return hit;
        return fetch(req).then(function (resp) {
          if (resp && (resp.ok || resp.type === "opaque")) {
            try { cache.put(req, resp.clone()); } catch (err) {}
          }
          return resp;
        });
      });
    })
  );
});
