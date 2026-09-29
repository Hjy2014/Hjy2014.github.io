/* ============================================================
   游戏页脚本 page-games.js（原来写在 games.html 里，为了无刷新换页而搬出来）
   - 清单与搜索在第一次进入时拉取，之后换页回来直接复用（秒出）
   - 提前缓冲：玩着这一个，悄悄把后面 3 个下载好
   ============================================================ */
(function () {
  "use strict";

  /* 清单缓存：挂在 window 上，因为无刷新换页时本脚本会重跑一遍，模块内的变量会重置 */
  var GAMES_CACHE = window.__hjyGamesCache || null;

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
    function esc(s) {
      return String(s).replace(/[&<>"']/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
      });
    }
    /* 兜底源：jsDelivr 全家桶（国内可达性好，四家镜像同一份数据）。
       注意 jsDelivr 不收 20MB 以上文件，超大的只能走本站 GitHub 源 */
    function cdnUrls(g) {
      if (g.s > 20480) return [];
      var repo = g.h === 2 ? "Hjy2014/hjy-games-2" : g.h === 3 ? "Hjy2014/hjy-games-3" : "Hjy2014/Hjy2014.github.io";
      var path = g.h === 2 || g.h === 3 ? "files/" : "games/files/";
      var hosts = ["cdn.jsdelivr.net", "fastly.jsdelivr.net", "gcore.jsdelivr.net", "testingcf.jsdelivr.net"];
      return hosts.map(function (h) { return "https://" + h + "/gh/" + repo + "@main/" + path + g.f; });
    }

    var loadSeq = 0;   /* 打开新游戏 / 关闭弹窗时作废在途加载 */
    var curPlayer = null;   /* 当前 forkphorus 播放器实例 */

    /* ---- 触屏虚拟键盘：手机 / 平板没有实体键盘，用它在屏幕上按键 ---- */
    var padWrap = null, padOn = false;
    var isTouchDevice = ("ontouchstart" in window) || (navigator.maxTouchPoints || 0) > 0;
    var PAD_BTNS = [
      { k: "ArrowUp", t: "▲", c: "vp-up" },
      { k: "ArrowLeft", t: "◀", c: "vp-left" },
      { k: "ArrowDown", t: "▼", c: "vp-down" },
      { k: "ArrowRight", t: "▶", c: "vp-right" },
      { k: "z", t: "Z", c: "vp-z" },
      { k: "x", t: "X", c: "vp-x" },
      { k: " ", t: "空格", c: "vp-space" }
    ];
    function vpSend(key, type) {
      /* 键盘事件必须以画布为 target，forkphorus 才会触发「当按下某键」积木 */
      var canvas = curPlayer && curPlayer.stage && curPlayer.stage.canvas;
      if (!canvas) return;
      try { canvas.dispatchEvent(new KeyboardEvent(type, { key: key, bubbles: true, cancelable: true })); } catch (e) {}
    }
    function ensurePad() {
      /* 节点可能被 stageMsg 的 innerHTML 重建顺手清掉，游离的要重建 */
      if (padWrap && padWrap.isConnected) return;
      if (padWrap) { try { padWrap.remove(); } catch (e) {} padWrap = null; }
      var st = document.createElement("style");
      st.textContent =
        ".hjy-vpad{position:absolute;left:0;right:0;bottom:0;display:none;justify-content:space-between;align-items:flex-end;padding:12px 16px;pointer-events:none;z-index:6}" +
        ".hjy-vpad button{pointer-events:auto;touch-action:none;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent;" +
        "border:1px solid rgba(255,255,255,.4);background:rgba(15,23,42,.55);color:#fff;font:600 15px/1 system-ui,sans-serif;border-radius:14px;" +
        "width:48px;height:48px;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);cursor:pointer;padding:0}" +
        ".hjy-vpad button.vp-press{background:rgba(79,70,229,.85);transform:scale(.93)}" +
        ".vp-grid-l{display:grid;grid-template-columns:repeat(3,48px);grid-template-rows:repeat(2,48px);gap:7px;pointer-events:none}" +
        ".vp-grid-l .vp-up{grid-column:2;grid-row:1}.vp-grid-l .vp-left{grid-column:1;grid-row:2}" +
        ".vp-grid-l .vp-down{grid-column:2;grid-row:2}.vp-grid-l .vp-right{grid-column:3;grid-row:2}" +
        ".vp-grid-r{display:grid;grid-template-columns:repeat(2,48px);grid-template-rows:repeat(2,48px);gap:7px;pointer-events:none}" +
        ".vp-grid-r .vp-space{grid-column:1/3;grid-row:2;width:auto}";
      document.head.appendChild(st);
      padWrap = document.createElement("div");
      padWrap.className = "hjy-vpad";
      var gl = document.createElement("div"), gr = document.createElement("div");
      gl.className = "vp-grid-l"; gr.className = "vp-grid-r";
      PAD_BTNS.forEach(function (d) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = d.c;
        b.textContent = d.t;
        b.dataset.key = d.k;
        b.addEventListener("pointerdown", function (e) {
          e.preventDefault();
          try { b.setPointerCapture(e.pointerId); } catch (err) {}
          b.classList.add("vp-press");
          vpSend(b.dataset.key, "keydown");
        });
        function up() { b.classList.remove("vp-press"); vpSend(b.dataset.key, "keyup"); }
        b.addEventListener("pointerup", up);
        b.addEventListener("pointercancel", up);
        b.addEventListener("contextmenu", function (e) { e.preventDefault(); });
        (d.c === "vp-space" || d.c === "vp-z" || d.c === "vp-x" ? gr : gl).appendChild(b);
      });
      padWrap.appendChild(gl);
      padWrap.appendChild(gr);
      modalStage.style.position = "relative";
      modalStage.appendChild(padWrap);
    }
    function setPad(on) {
      ensurePad();
      padOn = !!on && !!curPlayer;   /* 播放器不在（turbo 兜底 / 加载中）时不亮 */
      padWrap.style.display = padOn ? "flex" : "none";
      var pb = document.getElementById("gameModalPad");
      if (pb) pb.classList.toggle("on", padOn);
    }
    function autoPad() { setPad(isTouchDevice); }

    function stageMsg(html) {
      modalStage.innerHTML =
        '<div style="width:482px;height:412px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:#f6f7fb;border-radius:14px;text-align:center;padding:0 24px;box-sizing:border-box">' + html + "</div>";
    }

    function embedPlayer(url) {
      setPad(false);   /* 跨源 iframe 派发不了键盘事件，虚拟键盘只在同源播放器里可用 */
      modalStage.innerHTML =
        '<iframe src="https://turbowarp.org/embed?project_url=' + encodeURIComponent(url) +
        /* 不带全屏放行属性：TurboWarp 自带的方形全屏按钮就不会出现，只保留弹窗头部的圆形全屏键 */
        '&autoplay&settings-button" width="482" height="412" allowtransparency="true" frameborder="0" ' +
        'scrolling="no" style="color-scheme:auto" loading="lazy"></iframe>';
    }

    /* ---- 同源 forkphorus 播放器：文件在本页下载后直接喂给播放器，
            能吃到 Service Worker 的 Cache API 缓存（跨源 iframe 的 turbowarp
            因浏览器网络分区吃不到我们的缓存，每次都要完整重新下载）---- */
    var FP_BASE = "js/lib/forkphorus/";
    var fpCssDone = false, fpLoading = null;
    function loadScript(src) {
      return new Promise(function (res, rej) {
        var s = document.createElement("script");
        s.src = src;
        s.onload = function () { res(); };
        s.onerror = function () { rej(new Error("加载失败 " + src)); };
        document.head.appendChild(s);
      });
    }
    function ensurePhosphorus() {
      if (!fpCssDone) {
        fpCssDone = true;
        var link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = FP_BASE + "phosphorus.css";
        document.head.appendChild(link);
      }
      if (window.P && window.P.player && window.JSZip) return Promise.resolve();
      if (!fpLoading) {
        fpLoading = loadScript(FP_BASE + "jszip.min.js")
          .then(function () { return loadScript(FP_BASE + "canvg.min.js"); })
          .then(function () { return loadScript(FP_BASE + "purify.min.js"); })
          .then(function () { return loadScript(FP_BASE + "fontfaceobserver.standalone.js"); })
          .then(function () { return loadScript(FP_BASE + "phosphorus.dist.js"); })
          .then(function () {
            /* 字体与 sb2 音色库都放在本站，不请求外站 */
            window.P.io.config.localPath = "games/fp-assets/";
            /* sb2 的四款手写字体本机就有，src:local() 让 FontFaceObserver 秒过（否则每次白等 3 秒超时） */
            var style = document.createElement("style");
            style.textContent =
              '@font-face{font-family:"Donegal One";src:local("Georgia"),local("Times New Roman");}' +
              '@font-face{font-family:"Gloria Hallelujah";src:local("Segoe Print"),local("Comic Sans MS");}' +
              '@font-face{font-family:"Mystery Quest";src:local("Verdana");}' +
              '@font-face{font-family:"Permanent Marker";src:local("Segoe Print"),local("Comic Sans MS");}';
            document.head.appendChild(style);
            /* 音色库（sb2 鼓声）改为后台预热，不阻塞游戏启动；
               解码完成前敲鼓的那几声会静音（仅 console 记录，不影响游戏） */
            if (!window.__fpSoundbankStarted) {
              window.__fpSoundbankStarted = true;
              try {
                var origSB = window.P.audio.loadSoundbankSB2;
                window.P.audio.loadSoundbankSB2 = function () { return Promise.resolve(); };
                origSB(null).catch(function () {});
              } catch (e) {}
            }
          })
          .catch(function (err) { fpLoading = null; throw err; });
      }
      return fpLoading;
    }
    function embedPhosphorus(blob, ext, seq) {
      return new Promise(function (resolve, reject) {
        ensurePhosphorus().then(function () {
          if (seq !== loadSeq) return;
          var PlayerCtor = window.P && window.P.player && window.P.player.Player;
          if (!PlayerCtor) throw new Error("播放器不可用");
          var player = new PlayerCtor();
          window.__fp = player;   /* E2E 调试用 */
          var settled = false;
          player.onerror.subscribe(function (err) {
            if (!settled) { settled = true; try { player.cleanup(); } catch (e) {} reject(err); }
          });
          player.onload.subscribe(function () {
            if (!settled) { settled = true; curPlayer = player; resolve(player); autoPad(); }
          });
          modalStage.innerHTML = "";
          var host = document.createElement("div");
          host.style.cssText = "width:482px;height:412px;display:flex;align-items:center;justify-content:center;background:#fff;border-radius:14px;overflow:hidden";
          modalStage.appendChild(host);
          try { player.addControls(); } catch (e) {}
          host.appendChild(player.root);
          blob.arrayBuffer().then(function (buf) {
            if (seq !== loadSeq || settled) return;
            /* .sb 老格式本播放器不带转换器，会走 onerror 自动回退 TurboWarp */
            player.loadProjectFromBuffer(buf, ext === "sb3" ? "sb3" : "sb2");
          }).catch(function (err) {
            if (!settled) { settled = true; try { player.cleanup(); } catch (e) {} reject(err); }
          });
        }).catch(reject);
      });
    }

    function openGame(g) {
      var seq = ++loadSeq;
      modalTitle.textContent = g.n;
      modal.classList.remove("min");
      fullBtn.classList.remove("on");
      modal.hidden = false;
      document.body.style.overflow = "hidden";
      prefetchAhead(g);

      /* 先由本页面把游戏文件下载好（顺带预热缓存），哪条路通就用哪条，
         避免 turbowarp.org 的 iframe 里 fetch 失败只显示「页面已崩溃」 */
      var urls = [fileUrl(g)].concat(cdnUrls(g));
      var tryIdx = 0;

      stageMsg(
        '<div style="width:36px;height:36px;border:4px solid #c7d2fe;border-top-color:#4f46e5;border-radius:50%;animation:gmspin .8s linear infinite"></div>' +
        '<div style="color:#475569;font-size:.92rem">正在进入「' + esc(g.n) + "」…<br><span style=\"font-size:.78rem;color:#94a3b8\">第一次玩要下载游戏文件，稍等一下下</span></div>"
      );

      function attempt() {
        if (seq !== loadSeq) return;   /* 已经关掉 / 换了别的游戏 */
        if (tryIdx >= urls.length) {
          stageMsg(
            '<div style="font-size:2.2rem">📡</div>' +
            '<div style="color:#334155;font-size:.95rem;line-height:1.8">游戏加载失败啦，可能是当前网络连不上 GitHub / CDN。<br>点下面按钮多试几次，或换个网络（Wi-Fi ↔ 流量）再试；<br><span style="font-size:.8rem;color:#64748b">大文件游戏第一次下载可能要 1~3 分钟，别着急关～</span></div>' +
            '<button class="gm-retry" type="button" style="border:none;background:#4f46e5;color:#fff;padding:10px 26px;border-radius:999px;font-size:.92rem;cursor:pointer">🔄 重试</button>'
          );
          var rb = modalStage.querySelector(".gm-retry");
          if (rb) rb.addEventListener("click", function () { tryIdx = 0; stageMsg('<div style="color:#64748b">正在重试…</div>'); attempt(); });
          return;
        }
        var url = urls[tryIdx++];
        /* 超时按文件大小缩放：30 秒起步，大文件最多再等 150 秒（慢网下载几十 MB 不是秒完的） */
        var timeoutMs = 30000 + Math.min((g.s || 0) * 60, 150000);
        var ctrl = typeof AbortController === "function" ? new AbortController() : null;
        var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, timeoutMs) : null;
        fetch(url, { mode: "cors", credentials: "omit", cache: "force-cache", signal: ctrl ? ctrl.signal : undefined })
          .then(function (r) {
            if (!r.ok) throw new Error("HTTP " + r.status);
            return r.blob();
          })
          .then(function (blob) {
            if (seq !== loadSeq) return;
            clearTimeout(timer);
            /* 优先同源 forkphorus（走缓存、秒开）；失败自动回退 TurboWarp iframe */
            embedPhosphorus(blob, (g.f.split(".").pop() || "").toLowerCase(), seq)
              .catch(function () { if (seq === loadSeq) embedPlayer(url); });
          })
          .catch(function () {
            if (seq !== loadSeq) return;
            clearTimeout(timer);
            attempt();
          });
      }
      attempt();
    }
    function closeGame() {
      loadSeq++;   /* 作废在途的加载，防止关掉后还往弹窗里塞播放器 */
      if (document.fullscreenElement) document.exitFullscreen();
      if (curPlayer) { try { curPlayer.cleanup(); } catch (e) {} curPlayer = null; }
      setPad(false);
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
    var padBtn = document.getElementById("gameModalPad");
    if (padBtn) padBtn.addEventListener("click", function () { setPad(!padOn); });
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
        window.__hjyGamesCache = GAMES_CACHE = list;
        applyList(list);
      })
      .catch(function () {
        subEl.textContent = "游戏清单加载失败，请刷新重试～";
      });
  }

  window.HJYNav.register("games", init);
})();
