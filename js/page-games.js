/* ============================================================
   游戏页脚本 page-games.js（原来写在 games.html 里，为了无刷新换页而搬出来）
   - 清单与搜索在第一次进入时拉取，之后换页回来直接复用（秒出）
   - 提前缓冲：玩着这一个，悄悄把后面 3 个下载好
   ============================================================ */
(function () {
  "use strict";

  var GAMES_CACHE = null;      /* 清单缓存：换页回来不用再下一次 */

  function init(signal) {
    var GAMES = [];
    var curList = [];
    var shown = 0;
    var CHUNK = 48;
    var grid = document.getElementById("gamesGrid");
    if (!grid) return;
    var searchInput = document.getElementById("gameSearch");
    var searchClear = document.getElementById("gameSearchClear");
    var moreBtn = document.getElementById("gamesMore");
    var emptyBox = document.getElementById("gamesEmpty");
    var countEl = document.getElementById("gameCount");
    var subEl = document.getElementById("gamesSubtitle");
    var modal = document.getElementById("gameModal");
    var modalTitle = document.getElementById("gameModalTitle");
    var modalStage = document.getElementById("gameModalStage");
    var fullBtn = document.getElementById("gameModalFull");
    var EMOJI = ["🐱", "🚀", "⚽", "🕹️", "🏰", "🐍", "🐟", "🎲", "👾", "🏎️", "🧩", "⚡"];

    /* 游戏文件分三个仓库存放（单站 1GB 上限）：h=2/3 走扩展仓库 */
    function fileUrl(g) {
      var base = g.h === 2 ? "https://hjy2014.github.io/hjy-games-2/files/"
               : g.h === 3 ? "https://hjy2014.github.io/hjy-games-3/files/"
               : "https://hjy2014.github.io/games/files/";
      return base + g.f;
    }

    /* ---- 提前缓冲：玩着这一个，悄悄把后面 3 个下载好 ---- */
    var AHEAD = 3;
    var pfQueue = [], pfSeen = {}, pfBusy = false, pfTimer = null;
    function prefetch(url) {
      if (!url || pfSeen[url]) return;
      pfSeen[url] = 1;
      pfQueue.push(url);
      pfPump();
    }
    function pfPump() {
      if (pfBusy || !pfQueue.length) return;
      pfBusy = true;
      fetch(pfQueue.shift(), { mode: "cors", credentials: "omit", cache: "force-cache" })
        .catch(function () {})
        .then(function () { pfBusy = false; pfPump(); });
    }
    function prefetchAhead(g) {
      var i = curList.indexOf(g);
      if (i < 0) return;
      var urls = [], k;
      for (k = 1; k <= AHEAD && i + k < curList.length; k++) urls.push(fileUrl(curList[i + k]));
      if (!urls.length) return;
      clearTimeout(pfTimer);
      pfTimer = setTimeout(function () { urls.forEach(prefetch); }, 1200);
    }
    function filtered() {
      var kw = searchInput.value.trim().toLowerCase();
      if (!kw) return GAMES;
      return GAMES.filter(function (g) { return g.n.toLowerCase().indexOf(kw) >= 0; });
    }
    function makeCard(g, idx) {
      var card = document.createElement("button");
      card.className = "game-card2";
      card.type = "button";
      card.innerHTML =
        '<span class="game-card2-icon">' + EMOJI[(g.i || idx) % EMOJI.length] + "</span>" +
        '<span class="game-card2-name"></span>' +
        '<span class="game-card2-play">▶ 开始游戏</span>';
      card.querySelector(".game-card2-name").textContent = g.n;
      card.addEventListener("click", function () { openGame(g); });
      var hoverTimer = null;
      card.addEventListener("mouseenter", function () {
        hoverTimer = setTimeout(function () { prefetch(fileUrl(g)); }, 300);
      });
      card.addEventListener("mouseleave", function () { clearTimeout(hoverTimer); });
      return card;
    }
    function render(reset) {
      if (reset) { grid.innerHTML = ""; shown = 0; }
      var list = filtered();
      curList = list;
      var end = Math.min(shown + CHUNK, list.length);
      for (var i = shown; i < end; i++) {
        var c = makeCard(list[i], i);
        c.style.animationDelay = Math.min((i - shown) * 30, 300) + "ms";
        grid.appendChild(c);
      }
      shown = end;
      moreBtn.hidden = shown >= list.length;
      emptyBox.hidden = list.length !== 0;
      countEl.textContent = kwText(list.length);
    }
    function kwText(n) {
      var kw = searchInput.value.trim();
      return (kw ? "搜索「" + kw + "」：" : "全部游戏：") + n + " 个";
    }

    /* ---- 弹窗播放 ---- */
    function openGame(g) {
      var url = fileUrl(g);
      modalTitle.textContent = g.n;
      modal.classList.remove("min");
      fullBtn.classList.remove("on");
      modalStage.innerHTML =
        '<iframe src="https://turbowarp.org/embed?project_url=' + encodeURIComponent(url) +
        '&autoplay&settings-button" width="482" height="412" allowtransparency="true" frameborder="0" ' +
        'scrolling="no" allowfullscreen="" style="color-scheme:auto" loading="lazy"></iframe>';
      modal.hidden = false;
      document.body.style.overflow = "hidden";
      prefetchAhead(g);
    }
    function closeGame() {
      if (document.fullscreenElement) document.exitFullscreen();
      modal.hidden = true;
      modal.classList.remove("min");
      fullBtn.classList.remove("on");
      modalStage.innerHTML = "";
      document.body.style.overflow = "";
    }
    function minimizeGame() {
      if (document.fullscreenElement) document.exitFullscreen();
      modal.classList.add("min");
      document.body.style.overflow = "";
    }
    function restoreGame() {
      modal.classList.remove("min");
      document.body.style.overflow = "hidden";
    }
    document.getElementById("gameModalClose").addEventListener("click", closeGame);
    document.getElementById("gameModalMin").addEventListener("click", minimizeGame);
    fullBtn.addEventListener("click", function () {
      if (document.fullscreenElement) { document.exitFullscreen(); return; }
      if (modal.classList.contains("min")) restoreGame();
      if (modalStage.requestFullscreen) {
        var p = modalStage.requestFullscreen();
        if (p && p.catch) p.catch(function () {});
      }
    });
    document.addEventListener("fullscreenchange", function () {
      fullBtn.classList.toggle("on", !!document.fullscreenElement);
      fullBtn.title = document.fullscreenElement ? "退出全屏" : "全屏";
    }, signal ? { signal: signal } : false);
    modal.addEventListener("click", function (e) {
      if (modal.classList.contains("min")) {
        if (!e.target.closest("button")) restoreGame();
        return;
      }
      if (e.target === modal) closeGame();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !modal.hidden && !modal.classList.contains("min")) closeGame();
    }, signal ? { signal: signal } : false);

    /* ---- 搜索 ---- */
    var timer = null;
    searchInput.addEventListener("input", function () {
      searchClear.hidden = !searchInput.value;
      clearTimeout(timer);
      timer = setTimeout(function () { render(true); window.scrollTo(0, 0); }, 180);
    });
    searchClear.addEventListener("click", function () {
      searchInput.value = ""; searchClear.hidden = true; render(true); searchInput.focus();
    });
    searchInput.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && searchInput.value) {
        searchInput.value = ""; searchClear.hidden = true; render(true);
      }
    });
    document.getElementById("gameRandom").addEventListener("click", function () {
      if (!GAMES.length) return;
      openGame(GAMES[Math.floor(Math.random() * GAMES.length)]);
    });
    moreBtn.addEventListener("click", function () { render(false); });

    /* ---- 载入清单（首次拉取，之后复用缓存） ---- */
    function applyList(list) {
      var pinned = [], rest = [];
      list.forEach(function (g) { (g.t ? pinned : rest).push(g); });
      rest.sort(function (a, b) { return b.s - a.s; });
      GAMES = pinned.concat(rest);
      GAMES.forEach(function (g, i) {
        g.i = i;
        g.e = (g.f.split(".").pop() || "").toUpperCase();
      });
      subEl.textContent = GAMES.length + " 个游戏在线玩 · 点卡片即开 · 支持搜索";
      render(true);
    }
    if (GAMES_CACHE) {
      applyList(GAMES_CACHE);
      return;
    }
    subEl.textContent = "游戏加载中…";
    fetch("games/games.json", { cache: "no-cache" })
      .then(function (r) { return r.json(); })
      .then(function (list) {
        GAMES_CACHE = list;
        applyList(list);
      })
      .catch(function () {
        subEl.textContent = "游戏清单加载失败，请刷新重试～";
      });
  }

  window.HJYNav.register("games", init);
})();
