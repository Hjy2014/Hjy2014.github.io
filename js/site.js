/* ============================================================
   站点壳 site.js —— 无刷新跳转（站内换页不断歌）
   ------------------------------------------------------------
   原理：
   1) 页面内容整体装进 #pageRoot，#hjyRoot（播放器）搬进常驻的 #pfRoot。
   2) 点击站内 *.html 链接时，用 fetch 取回目标页面，只把 #pageRoot 的内容换掉，
      再重跑目标页自带的脚本 —— 整个文档从未销毁，所以 <audio> 一直活着，
      音乐是完全连续的，没有重新加载、没有断点。
   3) 浏览器前进/后退走 pushState/popstate，同样只换内容，并恢复原来的滚动位置。
   4) 任何异常都自动退回普通跳转，站点永远可用。
   5) 页面脚本用 HJYNav.register("页面名", 初始化函数) 注册自己，
      初始化函数可以接收一个 signal（切页时自动注销 document/window 上的监听）。
   ============================================================ */
(function () {
  "use strict";
  if (window.HJYNav) return;

  var pages = {};           /* 页面名 → 初始化函数 */
  var booted = false;       /* 壳是否已完成首次装配 */
  var pendingKey = null;    /* 正在等待注册的页面名（换页时用） */
  var loading = false;
  var cleanup = null;       /* 当前页面初始化函数注册的清理器 */
  var pageRoot = null;
  var pfRoot = null;

  function currentKey() {
    return (document.body && document.body.dataset && document.body.dataset.page) || "";
  }

  /* ---------- 首次装配：内容区 / 常驻区 分区 ---------- */
  function boot() {
    if (booted) return;
    booted = true;
    pageRoot = document.createElement("div");
    pageRoot.id = "pageRoot";
    pfRoot = document.createElement("div");
    pfRoot.id = "pfRoot";
    /* 先把现有节点快照下来（移动过程中 childNodes 会变），再逐个归位 */
    var nodes = Array.prototype.slice.call(document.body.childNodes);
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (n.nodeType === 1 && n.hasAttribute && n.hasAttribute("data-persist")) pfRoot.appendChild(n);
      else pageRoot.appendChild(n);
    }
    document.body.appendChild(pageRoot);
    document.body.appendChild(pfRoot);
    runInit(currentKey());
  }

  function runInit(key) {
    var fn = pages[key];
    if (!fn) return;
    if (cleanup) { try { cleanup(); } catch (e) { /* 忽略 */ } cleanup = null; }
    var ctrl = window.AbortController ? new AbortController() : null;
    cleanup = function () { if (ctrl) ctrl.abort(); };
    try {
      fn(ctrl ? ctrl.signal : null);
    } catch (e) {
      /* 页面初始化出错不影响播放器，但要在控制台留个线索 */
      if (window.console) console.error("[page:" + key + "] 初始化出错", e);
      cleanup = null;
    }
  }

  function register(name, fn) {
    pages[name] = fn;
    if (pendingKey === name) {       /* 换页刚插进来的脚本 */
      pendingKey = null;
      runInit(name);
    } else if (booted && !pendingKey && name === currentKey()) {
      runInit(name);                 /* 首屏（脚本比壳晚注册） */
    }
  }

  /* ---------- 换页 ---------- */
  function swap(html, url, opts) {
    var doc = new DOMParser().parseFromString(html, "text/html");
    if (!doc || !doc.body) throw new Error("parse failed");
    var nb = doc.body;
    var key = (nb.dataset && nb.dataset.page) || "";

    /* head 里的差异化信息同步过来（标题/图标/描述） */
    if (doc.title) document.title = doc.title;
    ["icon", "shortcut icon", "apple-touch-icon"].forEach(function (rel) {
      var fresh = doc.querySelector('link[rel="' + rel + '"]');
      if (!fresh) return;
      var old = document.querySelector('link[rel="' + rel + '"]');
      if (old) old.setAttribute("href", fresh.getAttribute("href"));
    });
    var desc = doc.querySelector('meta[name="description"]');
    var curDesc = document.querySelector('meta[name="description"]');
    if (desc && curDesc) curDesc.setAttribute("content", desc.getAttribute("content") || "");

    /* 换内容（播放器在 #pfRoot 里，不参与替换） */
    pageRoot.innerHTML = nb.innerHTML;
    document.body.dataset.page = key;
    /* 万一播放器被包进了内容区（脚本顺序差异），搬回常驻区 */
    Array.prototype.slice.call(pageRoot.querySelectorAll("[data-persist]")).forEach(function (n) {
      pfRoot.appendChild(n);
    });

    /* 重跑目标页脚本：innerHTML 塞进去的 <script> 不会执行，得重建 */
    pendingKey = key;
    Array.prototype.slice.call(pageRoot.querySelectorAll("script")).forEach(function (old) {
      var s = document.createElement("script");
      Array.prototype.slice.call(old.attributes).forEach(function (a) { s.setAttribute(a.name, a.value); });
      if (!old.src) s.textContent = old.textContent;
      old.parentNode.replaceChild(s, old);
    });
    if (pendingKey) {          /* 该页没有脚本注册，用已注册的直接跑 */
      var k = pendingKey;
      pendingKey = null;
      runInit(k);
    }
    if (window.HJYNav.onSwap) { try { window.HJYNav.onSwap(key); } catch (e) { /* 忽略 */ } }
    if (!(opts && opts.keepScroll)) window.scrollTo(0, 0);
  }

  function navigate(url, opts) {
    opts = opts || {};
    if (loading) return;
    if (!pageRoot) { try { boot(); } catch (e) { /* 交给下面的兜底 */ } }
    /* 装配异常时不要冒险，直接普通跳转，页面照样能开 */
    if (!pageRoot || !pageRoot.parentNode) { location.href = url; return; }
    loading = true;
    if (!opts.pop) {
      try {
        history.replaceState({ y: window.scrollY }, "");
      } catch (e) { /* 忽略 */ }
    }
    fetch(url, { credentials: "same-origin" })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.text();
      })
      .then(function (html) {
        swap(html, url, opts);
        if (!opts.pop) {
          history.pushState({ y: 0, key: (document.body.dataset.page || "") }, "", url);
        }
        loading = false;
      })
      .catch(function () {
        loading = false;
        location.href = url;      /* 兜底：老老实实跳一次，页面照样能开 */
      });
  }

  /* ---------- 链接拦截 ---------- */
  function onDocClick(e) {
    if (e.defaultPrevented || e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
    if (!a) return;
    if (a.target && a.target !== "_self") return;
    if (a.hasAttribute("download") || a.hasAttribute("data-no-pjax")) return;
    var href = a.getAttribute("href");
    if (!href || href.charAt(0) === "#") return;
    if (/^[a-z]+:/i.test(href) && !/^https?:/i.test(href)) return;
    var url;
    try { url = new URL(a.href, location.href); } catch (err) { return; }
    if (url.origin !== location.origin) return;
    if (!/\.html?$/i.test(url.pathname)) return;
    if (url.pathname === location.pathname) return;   /* 同一页：交给浏览器默认行为 */
    e.preventDefault();
    navigate(url.pathname + url.search + url.hash);
  }

  window.addEventListener("popstate", function (e) {
    var url = location.pathname + location.search + location.hash;
    navigate(url, { pop: true, keepScroll: true });
    var y = (e.state && e.state.y) || 0;
    setTimeout(function () { window.scrollTo(0, y); }, 60);
  });

  window.HJYNav = {
    register: register,
    go: function (url) { navigate(url); },
    reload: function () { navigate(location.pathname + location.search); },
    currentPage: currentKey,
    ready: function () { return booted; },
    containers: function () { return { page: pageRoot, persist: pfRoot }; },
  };

  /* ---------- 启动 ---------- */
  function start() {
    try { boot(); } catch (e) {
      if (window.console) console.error("[site] 装配失败", e);
    }
    document.addEventListener("click", onDocClick, true); /* 装配失败也要能正常跳转 */
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();

  /* 页脚年份：所有页面统一填（以前只有主页有） */
  function fillYear() {
    var y = document.getElementById("year");
    if (y) y.textContent = new Date().getFullYear();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fillYear);
  else fillYear();
  window.HJYNav.onSwap = fillYear;
})();
