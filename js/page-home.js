/* ============================================================
   主页脚本 page-home.js
   - 前半段：作品集相关（打字机、导航、入场动画、登录、联系方式、访问计数）
   - 后半段：音乐板块（搜索 / 每日推荐 / 收藏 / 历史 / 歌手入口）
     播放、歌词、音量倍速、悬浮窗全部交给全局播放器 window.HJY，
     所以本文件在无刷新换页时可以被安全地销毁重建，音乐不受影响。
   ============================================================ */
(function () {
  "use strict";

  function init(signal) {
    var HJY = window.HJY;

    /* ================= 作品集部分 ================= */
    /* 打字机效果 */
    var roles = ["在校学生", "编程爱好者", "创意编程玩家"];
    var typedEl = document.getElementById("typed");
    var roleIndex = 0, charIndex = 0, deleting = false;

    function type() {
      if (!typedEl || !typedEl.isConnected) return; /* 换页后旧元素已移除，停掉 */
      var current = roles[roleIndex];
      typedEl.textContent = current.slice(0, charIndex);
      if (!deleting) {
        if (charIndex < current.length) { charIndex++; setTimeout(type, 120); }
        else { deleting = true; setTimeout(type, 1600); }
      } else {
        if (charIndex > 0) { charIndex--; setTimeout(type, 60); }
        else { deleting = false; roleIndex = (roleIndex + 1) % roles.length; setTimeout(type, 400); }
      }
    }
    type();

    /* 导航栏滚动阴影 */
    var navbar = document.getElementById("navbar");
    if (navbar) {
      var onScroll = function () { navbar.classList.toggle("scrolled", window.scrollY > 10); };
      window.addEventListener("scroll", onScroll, signal ? { signal: signal } : false);
      onScroll();
    }

    /* 移动端菜单 */
    var navToggle = document.getElementById("navToggle");
    var navLinks = document.getElementById("navLinks");
    if (navToggle && navLinks) {
      navToggle.addEventListener("click", function () { navLinks.classList.toggle("open"); });
      navLinks.querySelectorAll("a").forEach(function (a) {
        a.addEventListener("click", function () { navLinks.classList.remove("open"); });
      });
    }

    /* 滚动入场动画 */
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) e.target.classList.add("visible"); });
    }, { threshold: 0.15 });
    document.querySelectorAll(".reveal").forEach(function (el) { observer.observe(el); });

    /* 数字滚动 */
    var statObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting || e.target.dataset.done) return;
        e.target.dataset.done = "1";
        var target = +e.target.dataset.count;
        var start = performance.now();
        var step = function (now) {
          var p = Math.min((now - start) / 1200, 1);
          e.target.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
          if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
    }, { threshold: 0.5 });
    document.querySelectorAll(".stat b").forEach(function (el) { statObserver.observe(el); });

    /* 平滑滚动到锚点 */
    var NAV_OFFSET = 84;
    function smoothScrollTo(target) {
      var startY = window.scrollY;
      var targetTop = Math.max(target.getBoundingClientRect().top + startY - NAV_OFFSET, 0);
      var dist = Math.abs(targetTop - startY);
      if (dist < 1) return;
      var duration = Math.min(Math.max(dist / 3.2, 380), 800);
      var start = performance.now();
      var cancelled = false;
      var cancel = function () { cancelled = true; };
      window.addEventListener("wheel", cancel, { once: true, passive: true });
      window.addEventListener("touchstart", cancel, { once: true, passive: true });
      function frame(now) {
        if (cancelled) return;
        var p = Math.min((now - start) / duration, 1);
        var ease = 1 - Math.pow(1 - p, 3);
        window.scrollTo({ top: startY + (targetTop - startY) * ease, behavior: "instant" });
        if (p < 1) requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    }
    document.querySelectorAll('a[href^="#"]').forEach(function (a) {
      a.addEventListener("click", function (e) {
        var id = a.getAttribute("href").slice(1);
        var target = document.getElementById(id);
        if (!target) return;
        e.preventDefault();
        requestAnimationFrame(function () {
          smoothScrollTo(target);
          history.replaceState(null, "", "#" + id);
        });
      });
    });

    /* 登录系统（前端演示版） */
    var USER_KEY = "hjy_login_user";
    var OWNER = { user: "hjy2014", pass: "hjy2026" };
    var userArea = document.getElementById("userArea");

    function getLoginUser() { return localStorage.getItem(USER_KEY) || ""; }

    function renderUser() {
      if (!userArea) return;
      var u = getLoginUser();
      if (u) {
        var isOwner = u === OWNER.user;
        userArea.innerHTML =
          '<div class="user-chip logged-in" id="userChip">' +
            '<span class="uname">' + u + (isOwner ? ' <em class="owner-badge">站长</em>' : "") + "</span>" +
            '<span class="avatar logged" aria-label="用户头像">👤</span>' +
          "</div>" +
          '<div class="user-menu" id="userMenu">' +
            (isOwner ? '<a class="menu-admin" href="https://github.com/Hjy2014/Hjy2014.github.io" target="_blank" rel="noopener">🛠 管理网页</a>' : "") +
            '<a class="menu-log" href="changelog.html">📝 网站更新日志</a>' +
            '<button class="menu-logout" id="logoutBtn">退出登录</button>' +
          "</div>";
        var chip = document.getElementById("userChip");
        var menu = document.getElementById("userMenu");
        chip.addEventListener("click", function (e) { e.stopPropagation(); menu.classList.toggle("open"); });
        document.addEventListener("click", function () { menu.classList.remove("open"); }, signal ? { signal: signal } : false);
        document.getElementById("logoutBtn").addEventListener("click", function () {
          localStorage.removeItem(USER_KEY);
          renderUser();
        });
      } else {
        userArea.innerHTML =
          '<button class="user-chip logged-out" id="loginOpen">' +
            '<span class="uname">未登录</span>' +
            '<span class="avatar blank" aria-label="未登录"></span>' +
          "</button>";
        document.getElementById("loginOpen").addEventListener("click", openLoginModal);
      }
    }

    function openLoginModal() {
      if (document.getElementById("loginModal")) return;
      var mask = document.createElement("div");
      mask.id = "loginModal";
      mask.innerHTML =
        '<div class="login-card">' +
          '<button class="login-close" id="loginClose" aria-label="关闭">✕</button>' +
          "<h3>登录</h3>" +
          '<label>用户名<input type="text" id="loginUser" autocomplete="username" placeholder="请输入用户名" /></label>' +
          '<label>密码<input type="password" id="loginPass" autocomplete="current-password" placeholder="请输入密码" /></label>' +
          '<p class="login-err" id="loginErr"></p>' +
          '<button class="login-go" id="loginGo">登 录</button>' +
        "</div>";
      document.body.appendChild(mask);
      var close = function () { mask.remove(); };
      mask.addEventListener("click", function (e) { if (e.target === mask) close(); });
      mask.querySelector("#loginClose").addEventListener("click", close);
      var submit = function () {
        var u = mask.querySelector("#loginUser").value.trim();
        var p = mask.querySelector("#loginPass").value;
        var err = mask.querySelector("#loginErr");
        if (!u || !p) { err.textContent = "用户名和密码不能为空"; return; }
        if (u === OWNER.user && p !== OWNER.pass) { err.textContent = "用户名或密码错误"; return; }
        localStorage.setItem(USER_KEY, u);
        close();
        renderUser();
      };
      mask.querySelector("#loginGo").addEventListener("click", submit);
      mask.querySelectorAll("input").forEach(function (el) {
        el.addEventListener("keydown", function (e) { if (e.key === "Enter") submit(); });
      });
      mask.querySelector("#loginUser").focus();
    }

    renderUser();

    /* 联系方式弹窗 */
    var CONTACTS = [
      { icon: "💬", name: "微信", value: "（稍后补充）" },
      { icon: "🎵", name: "抖音", value: "（稍后补充）" },
    ];
    var contactBtn = document.getElementById("contactInfoOpen");
    if (contactBtn) contactBtn.addEventListener("click", openContactModal);

    function openContactModal() {
      if (document.getElementById("contactModal")) return;
      var mask = document.createElement("div");
      mask.id = "contactModal";
      mask.innerHTML =
        '<div class="contact-card">' +
          '<button class="login-close" id="contactClose" aria-label="关闭">✕</button>' +
          "<h3>📇 我的联系方式</h3>" +
          '<ul class="contact-list">' +
            CONTACTS.map(function (c) {
              return '<li class="contact-item">' +
                '<span class="ci-icon">' + c.icon + "</span>" +
                '<span class="ci-name">' + c.name + "</span>" +
                '<span class="ci-value">' + c.value + "</span></li>";
            }).join("") +
          "</ul>" +
          '<p class="contact-tip">加好友时请备注来自网站哦～</p>' +
        "</div>";
      document.body.appendChild(mask);
      var close = function () { mask.remove(); };
      mask.addEventListener("click", function (e) { if (e.target === mask) close(); });
      mask.querySelector("#contactClose").addEventListener("click", close);
    }

    /* 访问设备数（防刷版：爬虫/无头不计；新设备要等真人首次交互才算） */
    var VISIT_KEY = "hjy_visited_v2";
    var COUNTER_BASE = "https://abacus.jasoncameron.dev";
    var COUNTER_NS = "hjy2014io";
    var COUNTER_KEY = "devices-v2";
    (function renderVisitCount() {
      var el = document.getElementById("visitCount");
      if (!el) return;
      /* 无头浏览器 / 自动化工具 / E2E 测试直接不计（爬虫、扫描器、咱们自己的测试都走这条） */
      if (navigator.webdriver || /Headless/i.test(navigator.userAgent) || /(^|[?&])e2e=1/.test(location.search)) { el.remove(); return; }
      /* 页面脚本会随 pjax 重跑：同一份文档只初始化一次 */
      if (window.__hjyVisitInit) return;
      window.__hjyVisitInit = true;
      var isNewDevice = !localStorage.getItem(VISIT_KEY);
      var doCount = async function () {
        try {
          var action = isNewDevice ? "hit" : "get";
          var res = await fetch(COUNTER_BASE + "/" + action + "/" + COUNTER_NS + "/" + COUNTER_KEY);
          var data = await res.json();
          if (typeof data.value === "number") {
            el.innerHTML = "👀 本站已被 <b>" + data.value + "</b> 台不同设备浏览过";
            if (isNewDevice) localStorage.setItem(VISIT_KEY, "1");
          } else el.remove();
        } catch (e) { el.remove(); }
      };
      if (isNewDevice) {
        /* 新设备：等首次真实手势（点击/按键/触摸）再 +1，
           只加载页面不交互的爬虫、预取、预览请求统统不算 */
        var counted = false;
        var mark = function () {
          if (counted) return;
          counted = true;
          window.removeEventListener("pointerdown", mark);
          window.removeEventListener("keydown", mark);
          window.removeEventListener("touchstart", mark);
          doCount();
        };
        window.addEventListener("pointerdown", mark);
        window.addEventListener("keydown", mark);
        window.addEventListener("touchstart", mark);
      } else {
        doCount();
      }
    })();

    /* ================= 音乐板块 ================= */
    var esc = HJY.esc, fmt = HJY.fmt, neteaseGet = HJY.neteaseGet, fetchTimeout = HJY.fetchTimeout;
    var filterPlayable = HJY.filterPlayable, artOf = HJY.artOf;

    var SEARCH_DISK_KEY = "hjy_search_cache_v1";
    var DAILY_CACHE_KEY = "hjy_daily_cache";

    /* 搜索结果磁盘缓存：网络波动时兜底 */
    function loadSearchDisk() {
      try { return JSON.parse(localStorage.getItem(SEARCH_DISK_KEY)) || {}; }
      catch (e) { return {}; }
    }
    function saveSearchDisk(kw, page, entry) {
      try {
        var d = loadSearchDisk();
        d[kw + "\u0001" + page] = { t: Date.now(), list: entry.list, more: entry.more };
        var keys = Object.keys(d);
        if (keys.length > 40) {
          keys.sort(function (a, b) { return d[a].t - d[b].t; }).slice(0, keys.length - 40)
            .forEach(function (k) { delete d[k]; });
        }
        localStorage.setItem(SEARCH_DISK_KEY, JSON.stringify(d));
      } catch (e) { /* 存储失败不影响主流程 */ }
    }

    var PAGE_SIZE = 12;
    var musicGrid = document.getElementById("musicGrid");
    var musicStatus = document.getElementById("musicStatus");
    var musicCaption = document.getElementById("musicCaption");
    var musicInput = document.getElementById("musicInput");
    var musicSearchBtn = document.getElementById("musicSearchBtn");
    var favCountEl = document.getElementById("favCount");
    var favTab = document.getElementById("favTab");
    var histTab = document.getElementById("histTab");
    var histTools = document.getElementById("histTools");
    var histSelect = document.getElementById("histSelect");
    var histClear = document.getElementById("histClear");
    var musicPager = document.getElementById("musicPager");
    var pagePrev = document.getElementById("pagePrev");
    var pageNext = document.getElementById("pageNext");
    var pageInfo = document.getElementById("pageInfo");
    var dailyRefresh = document.getElementById("dailyRefresh");
    var loadHint = document.getElementById("loadHint");

    /* 状态 */
    var musicView = "home";          /* home=搜索+每日推荐 | search=搜索结果 | fav=收藏 | hist=历史 */
    var lastView = "home";
    var histSelMode = false;
    var histSel = new Set();
    var favPlayable = [];
    var favChecked = false;
    var searchCache = {};
    var searchKw = "", searchPage = 1;
    var dailyList = [];
    var dailyOffset = 0;
    var DAILY_CHARTS = [
      { id: 19723756, name: "飙升榜" },
      { id: 2250011882, name: "抖音热歌" },
      { id: 3778678, name: "热歌榜" },
    ];
    var dailyChart = DAILY_CHARTS[0];
    var dailyChartLen = PAGE_SIZE * 3;
    var chartCache = {};

    function dayKey() {
      var now = new Date();
      var start = new Date(now.getFullYear(), 0, 0);
      return now.getFullYear() * 366 + Math.floor((now - start) / 86400000);
    }

    /* ---- 卡片渲染：歌手名可点，点开歌手简介与音乐 ---- */
    function artistLine(t) {
      var arts = (t.arts && t.arts.length) ? t.arts : [{ id: t.arid || "", name: t.artist || "" }];
      return arts.map(function (a) {
        return '<button class="music-artist-name" data-act="artist" data-arid="' + (a.id || "") +
          '" data-aname="' + esc(a.name) + '" title="查看歌手：' + esc(a.name) + '">' + esc(a.name) + "</button>";
      }).join('<span class="music-artist-sep"> / </span>');
    }

    function trackCard(t) {
      var fav = HJY.isFav(t.id);
      var isCur = HJY.currentId() === t.id;
      return '<div class="music-card' + (isCur ? " playing" : "") + '" data-id="' + t.id + '">' +
        '<div class="music-art-wrap">' +
          '<img class="music-art" src="' + esc(t.art) + '" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="pfImgFallback(this)" />' +
          '<button class="music-fav" data-act="fav" aria-label="收藏">' + (fav ? "❤️" : "🤍") + "</button>" +
          '<button class="music-play" data-act="play" aria-label="播放">' + (isCur && HJY.isPlaying() ? "⏸" : "▶") + "</button>" +
        "</div>" +
        '<p class="music-name" title="' + esc(t.name) + '">' + esc(t.name) + "</p>" +
        '<p class="music-artist">' + artistLine(t) + "</p>" +
      "</div>";
    }

    function currentList() {
      if (musicView === "fav") return favChecked ? favPlayable : HJY.getFavs();
      if (musicView === "hist") return HJY.getHistory();
      if (musicView === "home") return dailyList;
      var entry = searchCache[searchKw] && searchCache[searchKw][searchPage];
      return (entry && entry.list) || [];
    }

    /* 卡片上的播放键高亮：跟随播放器状态 */
    function syncCards() {
      var cid = HJY.currentId();
      var playing = HJY.isPlaying();
      musicGrid.querySelectorAll(".music-card").forEach(function (card) {
        var on = cid != null && String(cid) === card.dataset.id && playing;
        card.classList.toggle("playing", on);
        var b = card.querySelector(".music-play");
        if (b) b.textContent = on ? "⏸" : "▶";
      });
    }

    function renderMusic() {
      var favs = HJY.getFavs();
      if (favCountEl) favCountEl.textContent = favs.length ? "（" + favs.length + "）" : "";
      favTab.classList.toggle("active", musicView === "fav");
      favTab.innerHTML = musicView === "fav"
        ? "← 返回"
        : '❤️ 我的收藏<span id="favCount">' + (favs.length ? "（" + favs.length + "）" : "") + "</span>";
      histTab.classList.toggle("active", musicView === "hist");
      histTab.textContent = musicView === "hist" ? "← 返回" : "🕐 历史";

      if (musicView !== "hist" && histSelMode) { histSelMode = false; histSel.clear(); }
      histTools.hidden = musicView !== "hist";
      histSelect.textContent = histSelMode ? (histSel.size ? "🗑 清理（" + histSel.size + "）" : "取消选择") : "选择";
      histSelect.classList.toggle("danger", histSelMode && histSel.size > 0);
      histSelect.classList.toggle("circle", !histSelMode); /* 手机端空闲时是圆形，进选择模式文字变长则恢复胶囊 */
      musicGrid.classList.toggle("selecting", musicView === "hist" && histSelMode);

      dailyRefresh.hidden = musicView !== "home";
      if (musicView !== "home") loadHint.hidden = true;
      musicPager.hidden = musicView !== "search";
      if (musicView === "home") {
        musicCaption.textContent = "🔥 今日推荐";
      } else if (musicView === "search") {
        musicCaption.textContent = '🔍 “' + searchKw + "” 的搜索结果";
        var entry = searchCache[searchKw] && searchCache[searchKw][searchPage];
        pagePrev.disabled = searchPage <= 1;
        pageNext.disabled = !(entry && entry.more);
        pageInfo.textContent = "第 " + searchPage + " 页";
      } else if (musicView === "hist") {
        musicCaption.textContent = "🕐 历史记录";
      } else {
        musicCaption.textContent = "❤️ 我的收藏";
      }

      var list = currentList();
      if (musicView === "fav" && !list.length) {
        var total = HJY.getFavs().length;
        musicStatus.textContent = (favChecked && total) ? "收藏里的无版权歌曲已自动隐藏～" : "还没有收藏，搜索一首喜欢的歌吧～";
      } else if (musicView === "hist" && !list.length) {
        musicStatus.textContent = "还没有播放记录，去听首歌吧～";
      } else if (musicView === "home" && !list.length) musicStatus.textContent = "今日推荐生成中…";
      else musicStatus.textContent = "";
      musicGrid.innerHTML = list.map(trackCard).join("");
      if (musicView === "hist" && histSelMode) {
        musicGrid.querySelectorAll(".music-card").forEach(function (card) {
          if (histSel.has(Number(card.dataset.id))) card.classList.add("hist-sel");
        });
      }
      saveMemo();
    }

    /* 记住「现在这一屏长什么样」：无刷新换页会重跑本脚本，模块变量会重置，
       所以挂到 window 上，换页回来直接还原，不必再等网络。 */
    function saveMemo() {
      try {
        window.__hjyHomeMemo = {
          day: dayKey(),
          chart: chartCache,
          pf: dailyPrefetch,
          daily: { list: dailyList, off: dailyOffset, len: dailyChartLen },
          view: musicView, lastView: lastView,
          kw: searchKw, page: searchPage, cache: searchCache,
          favPlayable: favChecked ? favPlayable : null,
        };
      } catch (e) { /* 备忘失败不影响使用 */ }
    }

    /* ---- 每日推荐：榜单曲目 ---- */
    async function fetchChart(pid) {
      if (chartCache[pid]) return chartCache[pid];
      var list = null;
      try {
        var data = await neteaseGet("/playlist/detail?id=" + pid);
        var p = data.playlist || data.result || {};
        list = (p.tracks || []).map(function (s) {
          var ars = ((s.ar || s.artists) || []).map(function (a) { return { id: a.id, name: a.name }; });
          return {
            id: s.id,
            name: s.name,
            artist: ars.map(function (a) { return a.name; }).join(" / "),
            album: (s.al && s.al.name) || (s.album && s.album.name) || "",
            art: artOf(s.al || s.album),
            arts: ars, arid: ars[0] && ars[0].id, aname: ars[0] && ars[0].name,
            dt: s.dt || s.duration || 0,
          };
        });
      } catch (e) { /* 代理全挂 → Meting 兜底 */ }
      if (!list || !list.length) {
        var r = await fetchTimeout("https://api.injahow.cn/meting/?type=playlist&id=" + pid, 9000);
        if (!r.ok) throw new Error("meting " + r.status);
        var arr = await r.json();
        list = (Array.isArray(arr) ? arr : []).map(function (s) {
          var m = /[?&]id=(\d+)/.exec(s.url || "");
          return {
            id: m ? +m[1] : 0,
            name: s.name || "未知歌曲",
            artist: String(s.artist || ""),
            album: "", art: String(s.pic || "").replace("http://", "https://"),
            arts: String(s.artist || "").split(" / ").map(function (n) { return { id: "", name: n }; }),
            arid: "", aname: String(s.artist || ""), dt: 0,
          };
        }).filter(function (t) { return t.id; });
      }
      if (!list.length) throw new Error("榜单为空");
      chartCache[pid] = list;
      return list;
    }

    /* 后台预取：当前批还在看/听时，提前把后面两批拉好并过滤好 */
    var dailyPrefetch = {};
    var prefetchChain = Promise.resolve();
    function schedulePrefetch(offset) {
      var total = Math.ceil(dailyChartLen / PAGE_SIZE) * PAGE_SIZE;
      if (!total) return;
      for (var k = 1; k <= 2; k++) {
        (function (off) {
          if (dailyPrefetch[off] !== undefined) return;
          dailyPrefetch[off] = null;
          prefetchChain = prefetchChain.then(async function () {
            try {
              var chart = await fetchChart(dailyChart.id);
              dailyChartLen = chart.length;
              var raw = chart.slice(off, off + PAGE_SIZE);
              if (!raw.length) { delete dailyPrefetch[off]; return; }
              var r = await filterPlayable(raw);
              dailyPrefetch[off] = r.list;
              r.list.forEach(function (t) { HJY.prefetchLyrics(t.id); });
            } catch (e) { delete dailyPrefetch[off]; }
          });
        })((offset + k * PAGE_SIZE) % total);
      }
    }

    async function loadDaily(offset) {
      dailyOffset = offset;
      var instant = Array.isArray(dailyPrefetch[offset]);
      if (musicView === "home" && !instant) {
        musicStatus.textContent = "正在获取网易云" + dailyChart.name + "…";
        musicGrid.innerHTML = "";
      }
      try {
        var chart = await fetchChart(dailyChart.id);
        dailyChartLen = chart.length;
        var raw = chart.slice(offset, offset + PAGE_SIZE);
        var r;
        if (instant) {
          r = { list: dailyPrefetch[offset], checked: true };
        } else {
          dailyList = raw;
          if (musicView === "home") { renderMusic(); loadHint.hidden = true; musicStatus.textContent = "正在过滤无版权歌曲…"; }
          r = await filterPlayable(raw);
        }
        dailyList = r.list;
        if (musicView === "home") {
          renderMusic();
          loadHint.hidden = true;
          if (!r.list.length) musicStatus.textContent = "这一批没有可播放的歌曲，点「换一批」试试吧～";
        }
        if (r.checked && r.list.length) { /* 只缓存确认过滤过、且确实有可播歌曲的列表，别让网络波动把今日缓存写空 */
          try {
            localStorage.setItem(DAILY_CACHE_KEY, JSON.stringify({ v: 4, day: dayKey(), off: offset, list: dailyList }));
          } catch (e) { /* 忽略 */ }
        }
        schedulePrefetch(offset);
        return true;
      } catch (e) {
        if (musicView === "home") {
          renderMusic();
          loadHint.hidden = true;
          musicStatus.textContent = "推荐获取失败，点「换一批」再试试～";
        }
        return false;
      }
    }

    /* ---- 搜索（翻页） ---- */
    async function searchViaGd(term, offset) {
      var page = Math.floor(offset / PAGE_SIZE) + 1;
      var r = await fetchTimeout(
        "https://music-api.gdstudio.xyz/api.php?types=search&source=netease&name=" + encodeURIComponent(term) +
        "&count=" + PAGE_SIZE + "&pages=" + page, 9000);
      if (!r.ok) throw new Error("gd " + r.status);
      var arr = await r.json();
      return (Array.isArray(arr) ? arr : []).map(function (s) {
        var names = [].concat(s.artist || []);
        return {
          id: s.id,
          name: s.name,
          artist: names.join(" / "),
          album: s.album || "",
          art: String(s.pic || s.picUrl || "").replace("http://", "https://"),
          arts: names.map(function (n) { return { id: "", name: n }; }),
          arid: "", aname: names[0] || "", dt: s.duration || 0,
        };
      });
    }

    async function neSearchRaw(term, offset) {
      var data = await neteaseGet(
        "/cloudsearch/pc?s=" + encodeURIComponent(term) +
        "&type=1&limit=" + PAGE_SIZE + "&offset=" + offset
      );
      return ((data.result && data.result.songs) || []).map(function (s) {
        var ars = ((s.ar || s.artists) || []).map(function (a) { return { id: a.id, name: a.name }; });
        return {
          id: s.id,
          name: s.name,
          artist: ars.map(function (a) { return a.name; }).join(" / "),
          album: (s.al && s.al.name) || (s.album && s.album.name) || "",
          art: artOf(s.al || s.album),
          arts: ars, arid: ars[0] && ars[0].id, aname: ars[0] && ars[0].name,
          dt: (s.dt || s.duration || 0),
        };
      });
    }

    function raceSearch(pairs) {
      return new Promise(function (resolve, reject) {
        var pending = pairs.length, settled = false, lastEmpty = null;
        pairs.forEach(function (p) {
          p.then(function (res) {
            if (settled) return;
            if (res.raw && res.raw.length) { settled = true; resolve(res); }
            else { lastEmpty = res; if (--pending === 0) { settled = true; resolve(lastEmpty); } }
          }, function (e) {
            if (settled) return;
            if (--pending === 0) { settled = true; if (lastEmpty) resolve(lastEmpty); else reject(e); }
          });
        });
      });
    }

    var searchChannel = {};
    async function fetchTracks(term, offset, onRaw) {
      var order = searchChannel[term] === "gd" ? ["gd", "ne"] : ["ne", "gd"];
      var raw;
      try {
        var win = await raceSearch(order.map(function (ch) {
          return {
            ch: ch,
            raw: ch === "ne" ? neSearchRaw(term, offset) : searchViaGd(term, offset),
          };
        }));
        searchChannel[term] = win.ch;
        raw = win.raw;
      } catch (e) {
        throw new Error("所有搜索通道都失败了");
      }
      if (onRaw) onRaw(raw);
      var r = await filterPlayable(raw);
      return { list: r.list, more: raw.length >= PAGE_SIZE, checked: r.checked };
    }

    async function searchMusic() {
      var kw = musicInput.value.trim();
      if (!kw) { musicStatus.textContent = "先输入想听的歌名或歌手吧～"; return; }
      if (musicView !== "fav") lastView = musicView;
      searchKw = kw; searchPage = 1;
      musicView = "search";
      await gotoSearchPage(1, true);
    }

    async function gotoSearchPage(page, force) {
      searchCache[searchKw] = searchCache[searchKw] || {};
      if (!force && searchCache[searchKw][page]) {
        searchPage = page; renderMusic(); return;
      }
      musicStatus.textContent = "正在搜索…";
      musicGrid.innerHTML = "";
      try {
        var res = await fetchTracks(searchKw, (page - 1) * PAGE_SIZE, function (raw) {
          searchCache[searchKw][page] = { list: raw, more: raw.length >= PAGE_SIZE };
          searchPage = page;
          musicStatus.textContent = "正在过滤无版权歌曲…";
          renderMusic();
        });
        searchCache[searchKw][page] = { list: res.list, more: res.more };
        searchPage = page;
        if (!res.list.length && page === 1) musicStatus.textContent = "没找到相关音乐（无版权的已自动过滤），换个关键词试试？";
        else musicStatus.textContent = "";
        renderMusic();
        if (res.more && !searchCache[searchKw][page + 1]) {
          fetchTracks(searchKw, page * PAGE_SIZE).then(function (r2) {
            searchCache[searchKw][page + 1] = { list: r2.list, more: r2.more };
            if (musicView === "search" && searchPage === page) renderMusic();
          }).catch(function () { /* 预取失败无所谓 */ });
        }
        if (res.checked && res.list.length) saveSearchDisk(searchKw, page, res);
      } catch (e) {
        var hit = loadSearchDisk()[searchKw + "\u0001" + page];
        if (hit && Array.isArray(hit.list) && hit.list.length) {
          searchCache[searchKw][page] = { list: hit.list, more: hit.more };
          searchPage = page;
          musicStatus.textContent = "网络波动，先显示之前搜过的结果～";
          renderMusic();
        } else {
          musicStatus.textContent = "搜索失败，可能是网络波动，稍后再试～";
        }
      }
    }

    /* ---- 每日推荐连播：一批播完自动换下一批（由播放器回调触发） ---- */
    var dailyAutoTries = 0;
    async function nextDailyBatch() {
      if (dailyAutoTries >= 4) {
        dailyAutoTries = 0;
        if (musicView === "home") musicStatus.textContent = "后面几批暂时没有能播的歌，点「换一批」试试吧～";
        return false;   /* 告诉播放器：这一轮就此停下 */
      }
      var nextOff = (dailyOffset + PAGE_SIZE) % (Math.ceil(dailyChartLen / PAGE_SIZE) * PAGE_SIZE);
      if (musicView === "home") musicStatus.textContent = "本批播完，自动换下一批…";
      var ok = await loadDaily(nextOff);
      if (!ok) {
        if (musicView === "home") musicStatus.textContent = "网络开小差了，连播暂停，点「换一批」继续～";
        return false;
      }
      if (dailyList.length) { dailyAutoTries = 0; return dailyList; }
      dailyAutoTries++;
      return nextDailyBatch();
    }
    HJY.setQueueEndHandler(function (source) {
      if (source !== "daily") return undefined;   /* 其他列表：循环回第一首 */
      return nextDailyBatch();
    });

    /* ---- 卡片交互（事件委托） ---- */
    musicGrid.addEventListener("click", function (e) {
      if (musicView === "hist" && histSelMode) {
        var selCard = e.target.closest(".music-card");
        if (!selCard) return;
        var sid = Number(selCard.dataset.id);
        if (histSel.has(sid)) { histSel.delete(sid); selCard.classList.remove("hist-sel"); }
        else { histSel.add(sid); selCard.classList.add("hist-sel"); }
        histSelect.textContent = histSel.size ? "🗑 清理（" + histSel.size + "）" : "取消选择";
        histSelect.classList.toggle("danger", histSel.size > 0);
        histSelect.classList.remove("circle");
        return;
      }
      var btn = e.target.closest("[data-act]");
      if (!btn) return;
      var card = btn.closest(".music-card");
      var id = Number(card.dataset.id);
      var list = currentList();
      var idx = -1;
      list.forEach(function (t, k) { if (t.id === id) idx = k; });
      if (idx < 0) return;
      if (btn.dataset.act === "artist") {
        HJY.openArtist(btn.dataset.arid || "", btn.dataset.aname || "");
      } else if (btn.dataset.act === "play") {
        if (HJY.currentId() === id) HJY.toggle();
        else HJY.playList(list, idx, { source: musicView === "home" ? "daily" : "page" });
      } else if (btn.dataset.act === "fav") {
        HJY.toggleFav(list[idx]);
      }
    });

    /* 鼠标划过歌手名 → 提前把歌手资料拉好，点开就是秒出 */
    var artistPreloaded = {};
    musicGrid.addEventListener("mouseover", function (e) {
      var b = e.target.closest && e.target.closest(".music-artist-name");
      if (!b) return;
      var arid = b.dataset.arid;
      if (!arid || artistPreloaded[arid]) return;
      artistPreloaded[arid] = 1;
      HJY.preloadArtist(+arid);
    });

    /* ---- 搜索控件 / 翻页 / 换一批 ---- */
    musicSearchBtn.addEventListener("click", searchMusic);
    musicInput.addEventListener("keydown", function (e) { if (e.key === "Enter") searchMusic(); });
    pagePrev.addEventListener("click", function () { if (searchPage > 1) gotoSearchPage(searchPage - 1); });
    pageNext.addEventListener("click", function () { gotoSearchPage(searchPage + 1); });
    dailyRefresh.addEventListener("click", function () {
      loadHint.hidden = false;
      loadDaily((dailyOffset + PAGE_SIZE) % (Math.ceil(dailyChartLen / PAGE_SIZE) * PAGE_SIZE));
    });

    /* ---- 视图切换 ---- */
    favTab.addEventListener("click", async function () {
      if (musicView === "fav") {
        musicView = lastView || "home";
        renderMusic();
      } else {
        lastView = musicView;
        musicView = "fav";
        favChecked = false;
        renderMusic();
        var r = await filterPlayable(HJY.getFavs());
        favPlayable = r.list;
        favChecked = true;
        if (musicView === "fav") renderMusic();
      }
    });
    histTab.addEventListener("click", function () {
      if (musicView === "hist") musicView = lastView || "home";
      else { lastView = musicView; musicView = "hist"; }
      renderMusic();
    });

    /* ---- 通用确认弹窗 ---- */
    var askMask = document.getElementById("askMask");
    var askText = document.getElementById("askText");
    var askOk = document.getElementById("askOk");
    var askCancel = document.getElementById("askCancel");
    var askCb = null;
    function askConfirm(text, onOk) {
      askText.textContent = text;
      askCb = onOk || null;
      askMask.hidden = false;
    }
    function closeAsk() { askMask.hidden = true; askCb = null; }
    askOk.addEventListener("click", function () { var cb = askCb; closeAsk(); if (cb) cb(); });
    askCancel.addEventListener("click", closeAsk);
    askMask.addEventListener("click", function (e) { if (e.target === askMask) closeAsk(); });

    /* ---- 历史记录：多选删除 / 清空 ---- */
    histSelect.addEventListener("click", function () {
      if (!histSelMode) { histSelMode = true; histSel.clear(); renderMusic(); return; }
      if (histSel.size) {
        var ids = Array.from(histSel);
        askConfirm("是否清理所选的 " + ids.length + " 首歌曲？", function () {
          HJY.setHistory(HJY.getHistory().filter(function (t) { return ids.indexOf(t.id) < 0; }));
          histSelMode = false;
          histSel.clear();
          renderMusic();
        });
        return;
      }
      histSelMode = false;
      histSel.clear();
      renderMusic();
    });
    histClear.addEventListener("click", function () {
      if (!HJY.getHistory().length) return;
      askConfirm("是否清空历史记录？", function () {
        HJY.setHistory([]);
        histSelMode = false;
        histSel.clear();
        renderMusic();
      });
    });

    /* ---- 跟随播放器状态刷新卡片（换页回来也自动对齐） ---- */
    var offState = HJY.onStateChange(function () { syncCards(); });
    var offFavs = HJY.onFavsChange(function () {
      favPlayable = favPlayable.filter(function (t) { return HJY.isFav(t.id); });
      renderMusic();
    });
    var offHist = HJY.onHistoryChange(function () { if (musicView === "hist") renderMusic(); });
    if (signal) {
      signal.addEventListener("abort", function () {
        offState(); offFavs(); offHist();
        HJY.setQueueEndHandler(null);
      });
    }

    /* ---- 换页回来：先看上次的备忘（秒回画面），再退回磁盘缓存，最后才走网络 ---- */
    var memo = (window.__hjyHomeMemo && window.__hjyHomeMemo.day === dayKey()) ? window.__hjyHomeMemo : null;

    /* ---- 初始化：按日期轮换榜单；有今日缓存就直接用 ---- */
    (function initDaily() {
      dailyChart = DAILY_CHARTS[dayKey() % DAILY_CHARTS.length];
      if (memo) {
        chartCache = memo.chart || {};
        dailyPrefetch = memo.pf || {};
        if (memo.daily) {
          dailyList = memo.daily.list || [];
          dailyOffset = memo.daily.off || 0;
          if (memo.daily.len) dailyChartLen = memo.daily.len;
        }
        searchCache = memo.cache || {};
        searchKw = memo.kw || "";
        searchPage = memo.page || 1;
        lastView = memo.lastView || "home";
        if (memo.view) musicView = memo.view;
        if (memo.favPlayable) { favPlayable = memo.favPlayable; favChecked = true; }
        if (dailyList.length || musicView !== "home") {
          renderMusic();
          if (musicView === "home") { loadHint.hidden = true; schedulePrefetch(dailyOffset); }
          return;                       /* 回主页是「回到刚才」，不重新拉资料 */
        }
      }
      try {
        var c = JSON.parse(localStorage.getItem(DAILY_CACHE_KEY));
        if (c && c.v === 4 && c.day === dayKey() && Array.isArray(c.list) && c.list.length) {
          dailyList = c.list;
          dailyOffset = c.off || 0;
          renderMusic();
          syncCards();
          schedulePrefetch(dailyOffset);
          return;
        }
      } catch (e) { /* 缓存坏了就走网络 */ }
      loadDaily(0);
    })();
  }

  window.HJYNav.register("home", init);
})();
