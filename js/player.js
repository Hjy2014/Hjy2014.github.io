/* ============================================================
   全局播放器 player.js —— 音乐板块的「发动机 + 播放窗」
   ------------------------------------------------------------
   为什么要单独抽出来：
   1) 播放器不再挂在某个页面里，而是挂在 #hjyRoot（站点壳预留的常驻容器）。
      站内无刷新跳转只替换 #pageRoot 的内容，播放器与 <audio> 永远不会被销毁
      —— 所以去别的页面，音乐是**完全连续**的，一个卡顿都没有。
   2) 状态实时写入 localStorage：就算整页刷新/直接打开新标签，也能接着上次的进度播。
   3) Media Session：最小化浏览器、切到别的软件、锁屏时，由系统媒体面板接管，
      Windows 音量键/媒体键也能控制，后台稳定直播不中断。
   4) 歌词推进改由「音频真实时间 + 定时器」双驱动：标签页被后台限速时
      timeupdate 会变稀，定时器读 audio.currentTime 补上，回来时不再错位。
   对外接口统一挂在 window.HJY 上，页面脚本只管渲染列表、调用播放。
   ============================================================ */
(function () {
  "use strict";
  if (window.HJY) return; /* 只初始化一次 */

  /* ================= 小工具 ================= */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmt(sec) {
    if (!isFinite(sec)) return "0:00";
    var m = Math.floor(sec / 60), s = Math.floor(sec % 60);
    return m + ":" + String(s).padStart(2, "0");
  }

  /* ================= 网易云接口（多代理并行竞速） ================= */
  var NE_BASE = "https://music.163.com/api";
  var PROXIES = [
    function (u) { return "https://api.allorigins.win/raw?url=" + encodeURIComponent(u); },
    function (u) { return "https://api.codetabs.com/v1/proxy?quest=" + encodeURIComponent(u); },
    function (u) { return "https://api.cors.lol/?url=" + encodeURIComponent(u); },
    function (u) { return "https://api.allorigins.win/get?url=" + encodeURIComponent(u); },
  ];
  var goodProxy = 0;

  function fetchTimeout(url, ms) {
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, ms);
    return fetch(url, { signal: ctrl.signal }).finally(function () { clearTimeout(timer); });
  }

  async function tryProxy(idx, target) {
    var res = await fetchTimeout(PROXIES[idx](target), 9000);
    if (!res.ok) throw new Error("proxy " + res.status);
    var text = await res.text();
    if (text.charAt(0) === "{" && text.indexOf('"contents"') === 1) {
      var wrapped = JSON.parse(text);
      if (typeof wrapped.contents !== "string") throw new Error("bad wrapper");
      text = wrapped.contents;
    }
    return JSON.parse(text);
  }

  async function neteaseGet(pathAndQuery) {
    var target = NE_BASE + pathAndQuery;
    var idxs = PROXIES.map(function (_, i) { return i; });
    var order = [goodProxy].concat(idxs.filter(function (i) { return i !== goodProxy; }));
    var lastErr = null;
    for (var pass = 0; pass < 2; pass++) {
      try {
        var racers = order.slice(0, 3).map(async function (idx) {
          return { idx: idx, data: await tryProxy(idx, target) };
        });
        var win = await Promise.any(racers);
        goodProxy = win.idx;
        return win.data;
      } catch (e) { lastErr = e; }
      for (var k = 2; k < order.length; k++) {
        try {
          var data = await tryProxy(order[k], target);
          goodProxy = order[k];
          return data;
        } catch (e2) { lastErr = e2; }
      }
      if (pass === 0) await new Promise(function (r) { setTimeout(r, 800); });
    }
    throw lastErr || new Error("所有网络通道都失败了");
  }

  function artOf(al) {
    var u = (al && al.picUrl) || "";
    return u.replace("http://", "https://") + (u && u.indexOf("?") < 0 ? "?param=240y240" : "");
  }
  function bigArt(u, size) {
    size = size || 500;
    u = String(u || "").replace("http://", "https://");
    if (!u) return u;
    var tag = "param=" + size + "y" + size;
    if (/param=\d+y\d+/.test(u)) return u.replace(/param=\d+y\d+/, tag); /* 已带小图参数 → 原地升级 */
    if (u.indexOf("?") < 0) return u + "?" + tag;
    return u; /* 带别的查询串（代理 URL 等）不敢乱动 */
  }

  /* 图片加载失败兜底（卡片内联 onerror 用到，必须是全局函数） */
  window.pfImgFallback = function (img) {
    var step = +(img.dataset.fb || 0);
    if (step === 0) {
      img.dataset.fb = "1";
      img.src = img.src.replace("p1.music.126.net", "p2.music.126.net")
        .replace("p3.music.126.net", "p2.music.126.net");
    } else if (step === 1) {
      img.dataset.fb = "2";
      img.src = PROXIES[0](img.src);
    } else {
      img.style.visibility = "hidden";
    }
  };

  /* 批量可播性检查：去掉无版权与 30 秒试听 */
  async function filterPlayable(list) {
    if (!list || !list.length) return { list: list || [], checked: false };
    try {
      var ids = "[" + list.map(function (t) { return t.id; }).join(",") + "]";
      var data = await neteaseGet("/song/enhance/player/url?ids=" + ids + "&br=320000");
      var ok = {};
      (data.data || []).forEach(function (d) {
        if (d && d.url && !d.freeTrialInfo) ok[d.id] = 1;
      });
      return { list: list.filter(function (t) { return ok[t.id]; }), checked: true };
    } catch (e) {
      return { list: list, checked: false };
    }
  }

  /* 播放地址会过期，每次播放前实时解析：GDStudio 直连 → 网易云接口 → Meting */
  async function resolveUrl(id) {
    try {
      var r = await fetchTimeout("https://music-api.gdstudio.xyz/api.php?types=url&source=netease&id=" + id + "&br=320000", 8000);
      if (r.ok) {
        var d = await r.json();
        if (d && d.url) return String(d.url).replace("http://", "https://");
        throw new Error("no url");
      }
    } catch (e) {
      if (e.message === "no url") throw e;
    }
    try {
      var data = await neteaseGet("/song/enhance/player/url?ids=[" + id + "]&br=320000");
      var u = data.data && data.data[0] && data.data[0].url;
      if (u) return u.replace("http://", "https://");
      throw new Error("no url");
    } catch (e) {
      if (e.message === "no url") throw e;
    }
    var r2 = await fetchTimeout("https://api.injahow.cn/meting/?type=song&id=" + id, 8000);
    if (!r2.ok) throw new Error("net");
    var arr = await r2.json();
    var u2 = Array.isArray(arr) && arr[0] && arr[0].url;
    if (u2) return String(u2).replace("http://", "https://");
    throw new Error("no url");
  }

  /* ================= 歌词 ================= */
  var lrcCache = {};        /* 歌曲id → [{t,text}]；null = 确认没有歌词 */
  var lrcLines = [];        /* 详情页当前歌词行 */
  var lrcIdx = -1;
  var userScrollAt = 0;
  var lrcReq = 0;
  var lrcLoadingId = null;

  function parseLrc(text) {
    var out = [];
    String(text).split("\n").forEach(function (line) {
      var times = [];
      var re = /\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g, m;
      while ((m = re.exec(line))) times.push([+m[1], +m[2], m[3]]);
      if (!times.length) return;
      var words = line.replace(/\[[^\]]*\]/g, "").trim();
      if (!words) return;
      times.forEach(function (t) {
        out.push({ t: t[0] * 60 + t[1] + (t[2] ? +("0." + t[2]) : 0), text: words });
      });
    });
    out.sort(function (a, b) { return a.t - b.t; });
    return out;
  }

  async function fetchLyrics(id) {
    try {
      var data = await neteaseGet("/song/lyric?id=" + id + "&lv=1&tv=-1");
      var raw = data && data.lrc && data.lrc.lyric;
      if (raw && raw.trim()) {
        var lines = parseLrc(raw);
        if (lines.length) return lines;
      }
    } catch (e) { /* 代理全挂 → Meting 兜底 */ }
    var r = await fetchTimeout("https://api.injahow.cn/meting/?type=lrc&id=" + id, 9000);
    if (!r.ok) throw new Error("lrc " + r.status);
    var lines2 = parseLrc(await r.text());
    if (!lines2.length) throw new Error("empty lrc");
    return lines2;
  }

  function renderLyrics(lines) {
    npLyrics.innerHTML = lines.length
      ? lines.map(function (l, i) { return '<p data-i="' + i + '">' + esc(l.text) + "</p>"; }).join("")
      : '<p class="np-hint">这首是纯音乐，没有歌词哦～</p>';
    lrcIdx = -1;
    npLyrics.scrollTop = 0;
  }

  async function loadLyricsInto(id) {
    if (lrcCache[id] !== undefined) {
      lrcLines = lrcCache[id] || [];
      renderLyrics(lrcLines);
      followLyric();
      return;
    }
    var seq = ++lrcReq;
    lrcLines = []; lrcIdx = -1;
    plLyric.textContent = "";
    npLyrics.innerHTML = '<p class="np-hint">歌词加载中…</p>';
    if (lrcLoadingId === id) return;
    lrcLoadingId = id;
    try {
      var lines = await fetchLyrics(id);
      if (seq !== lrcReq) return;
      lrcCache[id] = lines;
      lrcLines = lines;
      renderLyrics(lines);
      followLyric();
    } catch (e) {
      if (seq !== lrcReq) return;
      lrcCache[id] = null;
      lrcLines = [];
      npLyrics.innerHTML = '<p class="np-hint">暂时拿不到这首歌词～</p>';
    } finally {
      if (lrcLoadingId === id) lrcLoadingId = null;
    }
  }

  /* 歌词预取：当前歌一开播，后面 3 首的歌词悄悄拉好（串行，不抢播放带宽） */
  var lrcChain = Promise.resolve();
  function prefetchLrc(id) {
    if (lrcCache[id] !== undefined || lrcLoadingId === id) return Promise.resolve();
    lrcLoadingId = id;
    return fetchLyrics(id).then(function (lines) {
      lrcCache[id] = lines;
    }).catch(function (e) {
      if (e && e.message === "empty lrc") lrcCache[id] = null;
    }).then(function () {
      if (lrcLoadingId === id) lrcLoadingId = null;
      applyLrcIfCurrent(id);
    });
  }
  function queueLrcPrefetch(id) {
    if (!id) return;
    lrcChain = lrcChain.then(function () { return prefetchLrc(id); }).catch(function () {});
  }
  function prefetchQueueLyrics() {
    for (var k = 1; k <= 3; k++) {
      var t = queue[queueIdx + k];
      if (!t) break;
      queueLrcPrefetch(t.id);
    }
  }
  function applyLrcIfCurrent(id) {
    if (npMask.hidden || npArt.dataset.tid !== String(id)) return;
    var lines = lrcCache[id];
    if (lines === undefined) return;
    lrcLines = lines || [];
    renderLyrics(lrcLines);
    followLyric();
  }

  /* 高亮当前句：悬浮窗一行 + 详情页滚动跟随 */
  function followLyric() {
    var t = musicAudio.currentTime || 0;
    var idx = -1;
    for (var i = 0; i < lrcLines.length; i++) {
      if (lrcLines[i].t <= t + 0.25) idx = i; else break;
    }
    if (idx === lrcIdx) return;
    lrcIdx = idx;
    var text = idx >= 0 ? lrcLines[idx].text : "";
    if (plLyric.textContent !== text) plLyric.textContent = text;
    if (npMask.hidden) return;
    var ps = npLyrics.querySelectorAll("p[data-i]");
    ps.forEach(function (p) { p.classList.toggle("on", +p.dataset.i === idx); });
    if (idx >= 0 && ps[idx] && Date.now() - userScrollAt > 3000) {
      var el = ps[idx];
      npLyrics.scrollTo({ top: el.offsetTop - npLyrics.clientHeight / 2 + el.clientHeight / 2, behavior: "smooth" });
    }
  }

  /* ================= 播放器界面（常驻，随页面切换不重建） ================= */
  var root = document.createElement("div");
  root.id = "hjyRoot";
  root.setAttribute("data-persist", "1");
  root.innerHTML = [
    '<audio id="hjyAudio" preload="auto" playsinline></audio>',
    /* 悬浮播放窗 */
    '<div class="player-float" id="playerBar" hidden>',
    '  <div class="pf-head">',
    '    <img class="pf-art" id="plArt" alt="" referrerpolicy="no-referrer" onerror="pfImgFallback(this)" />',
    '    <div class="pl-info">',
    '      <p class="pl-name" id="plName"></p>',
    '      <p class="pl-artist" id="plArtist"></p>',
    '    </div>',
    '    <p class="pl-lyric" id="plLyric"></p>',
    '    <button class="pl-close" id="plMin" aria-label="最小化播放器" title="最小化到屏幕左侧">−</button>',
    '    <button class="pl-close" id="plMax" aria-label="打开播放详情页" title="播放详情页">',
    '      <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden="true"><rect x="1.5" y="1.5" width="8" height="8" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>',
    '    </button>',
    '    <button class="pl-close" id="plClose" aria-label="关闭播放器" title="关闭并停止播放">✕</button>',
    '  </div>',
    '  <div class="pl-progress">',
    '    <span class="pl-time" id="plCur">0:00</span>',
    '    <input type="range" id="plSeek" min="0" max="1000" value="0" aria-label="播放进度" />',
    '    <span class="pl-time" id="plDur">0:00</span>',
    '  </div>',
    '  <div class="pf-controls">',
    '    <button class="pl-btn" id="plPrev" aria-label="上一首">⏮</button>',
    '    <button class="pl-btn pl-toggle" id="plToggle" aria-label="播放/暂停">▶</button>',
    '    <button class="pl-btn" id="plNext" aria-label="下一首">⏭</button>',
    '    <button class="pl-fav" id="plFav" aria-label="收藏">🤍</button>',
    '  </div>',
    '  <div class="pf-resize" id="pfResize" aria-label="调整大小" title="拖动调整大小"></div>',
    "</div>",
    /* 最小化后的小球 */
    '<button class="player-mini" id="playerMini" hidden aria-label="展开播放器" title="点我展开播放器">🎵</button>',
    /* 播放详情页 */
    '<div class="np-mask" id="npMask" hidden>',
    '  <div class="np-card" role="dialog" aria-modal="true">',
    '    <button class="np-close" id="npClose" aria-label="关闭详情页" title="关闭">✕</button>',
    '    <div class="np-main">',
    '      <img class="np-art" id="npArt" alt="" referrerpolicy="no-referrer" onerror="pfImgFallback(this)" />',
    '      <div class="np-right">',
    '        <p class="np-name" id="npName"></p>',
    '        <p class="np-artist" id="npArtist"></p>',
    '        <div class="np-lyrics" id="npLyrics"><p class="np-hint">歌词加载中…</p></div>',
    '        <div class="np-time"><span id="npCur">0:00</span> / <span id="npDur">0:00</span></div>',
    '        <input type="range" id="npSeek" min="0" max="1000" value="0" aria-label="播放进度" />',
    '        <div class="np-controls">',
    '          <div class="np-ratewrap">',
    '            <button class="np-btn np-rate" id="npRate" aria-label="倍速播放" title="倍速播放">1x</button>',
    '            <div class="np-ratepop" id="npRatePop" hidden>',
    '              <button data-rate="0.5">0.5x</button><button data-rate="0.75">0.75x</button>',
    '              <button data-rate="1">1x</button><button data-rate="1.5">1.5x</button>',
    '              <button data-rate="2">2x</button><button data-rate="2.5">2.5x</button>',
    '              <button data-rate="3">3x</button>',
    "            </div>",
    "          </div>",
    '          <button class="np-btn" id="npPrev" aria-label="上一首">⏮</button>',
    '          <button class="np-btn np-toggle" id="npToggle" aria-label="播放/暂停">▶</button>',
    '          <button class="np-btn" id="npNext" aria-label="下一首">⏭</button>',
    '          <div class="np-volwrap">',
    '            <button class="np-btn" id="npVol" aria-label="音量" title="音量">🔊</button>',
    '            <div class="np-volpop" id="npVolPop" hidden>',
    '              <input type="range" id="npVolBar" min="0" max="100" value="100" aria-label="音量大小" />',
    "            </div>",
    "          </div>",
    "        </div>",
    "      </div>",
    "    </div>",
    "  </div>",
    "</div>",
    /* 歌手弹窗 */
    '<div class="artist-mask" id="arMask" hidden>',
    '  <div class="artist-card" role="dialog" aria-modal="true">',
    '    <button class="artist-close" id="arClose" aria-label="关闭歌手页" title="关闭">✕</button>',
    '    <div class="artist-head">',
    '      <img class="artist-avatar" id="arAvatar" alt="" referrerpolicy="no-referrer" onerror="pfImgFallback(this)" />',
    '      <div class="artist-headinfo">',
    '        <p class="artist-name" id="arName">歌手</p>',
    '        <p class="artist-metas" id="arMetas"></p>',
    '        <button class="artist-playall" id="arPlayAll">▶ 全部播放</button>',
    "      </div>",
    "    </div>",
    '    <p class="artist-stats" id="arStats"></p>',
    '    <div class="artist-intro" id="arIntro"></div>',
    '    <p class="artist-songtitle" id="arSongTitle"></p>',
    '    <div class="artist-songs" id="arSongs"></div>',
    "  </div>",
    "</div>",
  ].join("\n");

  var barMount = document.getElementById("pfRoot") || document.body;
  barMount.appendChild(root);

  var musicAudio = document.getElementById("hjyAudio");
  var playerBar = document.getElementById("playerBar");
  var plArt = document.getElementById("plArt");
  var plName = document.getElementById("plName");
  var plArtist = document.getElementById("plArtist");
  var plPrev = document.getElementById("plPrev");
  var plToggle = document.getElementById("plToggle");
  var plNext = document.getElementById("plNext");
  var plSeek = document.getElementById("plSeek");
  var plCur = document.getElementById("plCur");
  var plDur = document.getElementById("plDur");
  var plFav = document.getElementById("plFav");
  var plMin = document.getElementById("plMin");
  var plClose = document.getElementById("plClose");
  var plMax = document.getElementById("plMax");
  var plLyric = document.getElementById("plLyric");
  var playerMini = document.getElementById("playerMini");
  var pfResize = document.getElementById("pfResize");
  var npMask = document.getElementById("npMask");
  var npClose = document.getElementById("npClose");
  var npArt = document.getElementById("npArt");
  var npName = document.getElementById("npName");
  var npArtist = document.getElementById("npArtist");
  var npLyrics = document.getElementById("npLyrics");
  var npCur = document.getElementById("npCur");
  var npDur = document.getElementById("npDur");
  var npSeek = document.getElementById("npSeek");
  var npPrev = document.getElementById("npPrev");
  var npToggle = document.getElementById("npToggle");
  var npNext = document.getElementById("npNext");
  var npVol = document.getElementById("npVol");
  var npVolPop = document.getElementById("npVolPop");
  var npVolBar = document.getElementById("npVolBar");
  var npRate = document.getElementById("npRate");
  var npRatePop = document.getElementById("npRatePop");
  var arMask = document.getElementById("arMask");
  var arClose = document.getElementById("arClose");
  var arAvatar = document.getElementById("arAvatar");
  var arName = document.getElementById("arName");
  var arMetas = document.getElementById("arMetas");
  var arStats = document.getElementById("arStats");
  var arIntro = document.getElementById("arIntro");
  var arPlayAll = document.getElementById("arPlayAll");
  var arSongTitle = document.getElementById("arSongTitle");
  var arSongs = document.getElementById("arSongs");

  /* ================= 状态 ================= */
  var queue = [], queueIdx = -1, queueSource = "", playSeq = 0;
  var playerMinimized = false;
  var queueEndHandler = null;
  var stateListeners = [], favListeners = [], histListeners = [], startListeners = [];
  var FAV_KEY = "hjy_music_favs_v2";
  var HIST_KEY = "hjy_play_history_v1";
  var STATE_KEY = "hjy_player_state_v1";

  function emit(list, arg) {
    list.slice().forEach(function (fn) { try { fn(arg); } catch (e) { /* 页面回调出错不影响播放 */ } });
  }
  function current() { return queue[queueIdx] || null; }
  function isPlaying() { return !!current() && !musicAudio.paused; }
  function listening() { return window.HJY; }

  /* ---- 收藏（放播放器里，任何页面点 ❤️ 都一致） ---- */
  function getFavs() {
    try { return JSON.parse(localStorage.getItem(FAV_KEY)) || []; } catch (e) { return []; }
  }
  function setFavs(list) {
    localStorage.setItem(FAV_KEY, JSON.stringify(list));
    emit(favListeners, list);
  }
  function isFav(id) { return getFavs().some(function (t) { return t.id === id; }); }
  function toggleFav(t) {
    if (!t) return;
    var favs = getFavs();
    var i = -1;
    favs.forEach(function (x, k) { if (x.id === t.id) i = k; });
    if (i >= 0) favs.splice(i, 1); else favs.push(t);
    setFavs(favs);
    plFav.textContent = isFav(t.id) ? "❤️" : "🤍";
  }

  /* ---- 播放历史（任何页面开播都会记） ---- */
  function getHistory() {
    try { return JSON.parse(localStorage.getItem(HIST_KEY)) || []; } catch (e) { return []; }
  }
  function setHistory(list) {
    try { localStorage.setItem(HIST_KEY, JSON.stringify(list.slice(0, 100))); } catch (e) { /* 忽略 */ }
    emit(histListeners, list);
  }
  function pushHistory(t) {
    var h = getHistory().filter(function (x) { return x.id !== t.id; });
    h.unshift({
      id: t.id, name: t.name, artist: t.artist, album: t.album || "", art: t.art || "",
      arid: t.arid || "", aname: t.aname || "", arts: t.arts || null, t: Date.now(),
    });
    setHistory(h);
  }

  /* ================= 状态持久化：刷新/换页也能接着播 ================= */
  function packTrack(t) {
    return {
      id: t.id, name: t.name, artist: t.artist || "", album: t.album || "",
      art: t.art || "", arid: t.arid || "", aname: t.aname || "",
      arts: t.arts || null, dt: t.dt || 0,
    };
  }
  function saveState(force) {
    if (!queue.length) return;
    try {
      localStorage.setItem(STATE_KEY, JSON.stringify({
        v: 2,
        ts: Date.now(),
        playing: !musicAudio.paused && !musicAudio.ended,
        idx: queueIdx,
        time: musicAudio.currentTime || 0,
        source: queueSource,
        list: queue.slice(0, 80).map(packTrack),
      }));
    } catch (e) { /* 存储满了也不影响播放 */ }
  }
  function loadState() {
    try {
      var s = JSON.parse(localStorage.getItem(STATE_KEY));
      if (!s || s.v !== 2 || !s.list || !s.list.length) return null;
      if (Date.now() - (s.ts || 0) > 6 * 3600 * 1000) return null; /* 超过 6 小时不自动续播 */
      return s;
    } catch (e) { return null; }
  }
  setInterval(function () { if (isPlaying()) saveState(); }, 5000);
  window.addEventListener("pagehide", function () { saveState(); });
  document.addEventListener("visibilitychange", function () {
    saveState();
    if (!document.hidden) { syncProgress(); followLyric(); } /* 回到前台立刻校正进度与歌词 */
  });

  /* ================= 系统媒体控制（最小化/锁屏也不断） ================= */
  function pct(n) { return Math.round(n * 100) + "%"; }
  function setMediaSession(t) {
    if (!("mediaSession" in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: t.name || "",
        artist: t.artist || "",
        album: t.album || "",
        artwork: t.art ? [
          { src: t.art, sizes: "240x240", type: "image/jpeg" },
          { src: bigArt(t.art, 500), sizes: "500x500", type: "image/jpeg" },
        ] : [],
      });
    } catch (e) { /* 老浏览器忽略 */ }
  }
  function setMediaState(st) {
    if (!("mediaSession" in navigator)) return;
    try { navigator.mediaSession.playbackState = st; } catch (e) { /* 忽略 */ }
  }
  function setMediaPos() {
    if (!("mediaSession" in navigator) || !navigator.mediaSession.setPositionState) return;
    if (!isFinite(musicAudio.duration) || musicAudio.duration <= 0) return;
    try {
      navigator.mediaSession.setPositionState({
        duration: musicAudio.duration,
        playbackRate: musicAudio.playbackRate || 1,
        position: Math.min(musicAudio.currentTime || 0, musicAudio.duration),
      });
    } catch (e) { /* 忽略 */ }
  }
  if ("mediaSession" in navigator) {
    var acts = {
      play: function () { if (queue.length) musicAudio.play().catch(function () {}); },
      pause: function () { musicAudio.pause(); },
      previoustrack: function () { playPrev(); },
      nexttrack: function () { playNext(); },
      stop: function () { closePlayer(); },
      seekbackward: function (d) { musicAudio.currentTime = Math.max(0, (musicAudio.currentTime || 0) - ((d && d.seekOffset) || 10)); },
      seekforward: function (d) { musicAudio.currentTime = (musicAudio.currentTime || 0) + ((d && d.seekOffset) || 10); },
      seekto: function (d) { if (d && typeof d.seekTime === "number") musicAudio.currentTime = d.seekTime; },
    };
    Object.keys(acts).forEach(function (name) {
      try { navigator.mediaSession.setActionHandler(name, acts[name]); } catch (e) { /* 该动作不支持 */ }
    });
  }

  /* ================= 悬浮窗：拖动 / 缩放 / 位置记忆 ================= */
  var POS_KEY = "hjy_player_pos", SCALE_KEY = "hjy_player_scale";
  var playerPlaced = false, playerScale = 1;
  try {
    var s0 = parseFloat(localStorage.getItem(SCALE_KEY));
    if (s0 >= 0.7 && s0 <= 2.5) playerScale = s0;
  } catch (e) { /* 忽略 */ }
  function applyPlayerScale() { playerBar.style.transform = "scale(" + playerScale + ")"; }
  function clampPlayer() {
    var rect = playerBar.getBoundingClientRect();
    var x = parseFloat(playerBar.style.left); if (!isFinite(x)) x = 8;
    var y = parseFloat(playerBar.style.top); if (!isFinite(y)) y = 8;
    x = Math.max(8, Math.min(x, window.innerWidth - rect.width - 8));
    y = Math.max(8, Math.min(y, window.innerHeight - rect.height - 8));
    playerBar.style.left = x + "px";
    playerBar.style.top = y + "px";
  }
  function placePlayer() {
    var rect = playerBar.getBoundingClientRect();
    var x = window.innerWidth - rect.width - 20;
    var y = window.innerHeight - rect.height - 20;
    try {
      var saved = JSON.parse(localStorage.getItem(POS_KEY));
      if (saved && typeof saved.x === "number" && typeof saved.y === "number" &&
          saved.x < window.innerWidth - 40 && saved.y < window.innerHeight - 40) {
        x = saved.x; y = saved.y;
      }
    } catch (e) { /* 忽略 */ }
    playerBar.style.left = x + "px";
    playerBar.style.top = y + "px";
    clampPlayer();
    playerPlaced = true;
  }
  var dragState = null;
  playerBar.addEventListener("pointerdown", function (e) {
    if (e.target.closest("button, input, .pf-resize")) return;
    var rect = playerBar.getBoundingClientRect();
    dragState = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    playerBar.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  playerBar.addEventListener("pointermove", function (e) {
    if (!dragState) return;
    playerBar.style.left = (e.clientX - dragState.dx) + "px";
    playerBar.style.top = (e.clientY - dragState.dy) + "px";
    clampPlayer();
  });
  function endDrag() {
    if (!dragState) return;
    dragState = null;
    try {
      localStorage.setItem(POS_KEY, JSON.stringify({
        x: parseInt(playerBar.style.left, 10), y: parseInt(playerBar.style.top, 10),
      }));
    } catch (e) { /* 忽略 */ }
  }
  playerBar.addEventListener("pointerup", endDrag);
  playerBar.addEventListener("pointercancel", endDrag);
  playerBar.addEventListener("dblclick", function (e) {
    if (e.target.closest("button, input, .pf-resize")) return;
    openNowPlaying(); /* 双击空白处 = 打开播放详情页 */
  });

  var resizeState = null;
  pfResize.addEventListener("pointerdown", function (e) {
    e.stopPropagation();
    var rect = playerBar.getBoundingClientRect();
    resizeState = { x: e.clientX, y: e.clientY, scale: playerScale, w: rect.width, h: rect.height };
    pfResize.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  pfResize.addEventListener("pointermove", function (e) {
    if (!resizeState) return;
    var rx = (e.clientX - resizeState.x + resizeState.w) / resizeState.w;
    var ry = (e.clientY - resizeState.y + resizeState.h) / resizeState.h;
    playerScale = Math.min(2.5, Math.max(0.7, resizeState.scale * Math.max(rx, ry)));
    applyPlayerScale();
    clampPlayer();
  });
  function endResize() {
    if (!resizeState) return;
    resizeState = null;
    try { localStorage.setItem(SCALE_KEY, String(playerScale)); } catch (e) { /* 忽略 */ }
  }
  pfResize.addEventListener("pointerup", endResize);
  pfResize.addEventListener("pointercancel", endResize);

  /* ================= 音量 / 倍速 ================= */
  function applyVolume(v) {
    musicAudio.volume = Math.max(0, Math.min(1, v));
    npVolBar.value = Math.round(musicAudio.volume * 100);
    npVol.textContent = musicAudio.volume > 0 ? "🔊" : "🔇";
    try { localStorage.setItem("hjy_volume", String(musicAudio.volume)); } catch (e) { /* 忽略 */ }
  }
  try {
    var sv = parseFloat(localStorage.getItem("hjy_volume"));
    if (isFinite(sv)) musicAudio.volume = Math.max(0, Math.min(1, sv));
  } catch (e) { /* 默认 1 */ }
  npVolBar.value = Math.round(musicAudio.volume * 100);
  npVol.textContent = musicAudio.volume > 0 ? "🔊" : "🔇";

  var volTapT = 0, volMuteBefore = 0.8, volTapTimer = 0;
  npVol.addEventListener("pointerup", function (e) {
    e.stopPropagation();
    var now = Date.now();
    if (now - volTapT < 280) {
      volTapT = 0;
      clearTimeout(volTapTimer);
      if (musicAudio.volume > 0) { volMuteBefore = musicAudio.volume; applyVolume(0); }
      else applyVolume(volMuteBefore || 0.8);
      return;
    }
    volTapT = now;
    volTapTimer = setTimeout(function () { npVolPop.hidden = !npVolPop.hidden; }, 290);
  });
  npVolBar.addEventListener("input", function () { applyVolume(+npVolBar.value / 100); });
  document.addEventListener("click", function (e) {
    if (!npVolPop.hidden && !e.target.closest(".np-volwrap")) npVolPop.hidden = true;
  });

  function applyRate(r) {
    r = Math.max(0.5, Math.min(3, r));
    musicAudio.playbackRate = r;
    try { localStorage.setItem("hjy_rate", String(r)); } catch (e) { /* 忽略 */ }
    npRate.textContent = r + "x";
    npRate.classList.toggle("active", r !== 1);
    npRatePop.querySelectorAll("button").forEach(function (b) {
      b.classList.toggle("on", parseFloat(b.dataset.rate) === r);
    });
  }
  try {
    var sr = parseFloat(localStorage.getItem("hjy_rate"));
    if (isFinite(sr) && sr >= 0.5 && sr <= 3) musicAudio.playbackRate = sr;
  } catch (e) { /* 默认 1x */ }
  applyRate(musicAudio.playbackRate || 1);
  npRate.addEventListener("click", function (e) {
    e.stopPropagation();
    npRatePop.hidden = !npRatePop.hidden;
    npVolPop.hidden = true;
  });
  npRatePop.addEventListener("click", function (e) {
    var b = e.target.closest("button[data-rate]");
    if (!b) return;
    applyRate(parseFloat(b.dataset.rate));
    npRatePop.hidden = true;
  });
  document.addEventListener("click", function (e) {
    if (!npRatePop.hidden && !e.target.closest(".np-ratewrap")) npRatePop.hidden = true;
  });

  /* ================= 界面同步 ================= */
  function showPlayer(t) {
    if (!playerMinimized) playerBar.hidden = false;
    if (t.art) {
      plArt.dataset.fb = "";
      plArt.style.visibility = "visible";
      plArt.src = t.art;
    } else plArt.style.visibility = "hidden";
    plName.textContent = t.name;
    plName.title = t.name;
    plArtist.textContent = "加载中…";
    plArtist.dataset.arid = t.arid || "";
    plArtist.dataset.aname = t.aname || t.artist || "";
    plFav.textContent = isFav(t.id) ? "❤️" : "🤍";
    if (!playerPlaced) { applyPlayerScale(); placePlayer(); }
    if (lrcCache[t.id] === undefined && lrcLoadingId !== t.id) loadLyricsInto(t.id);
    if (!npMask.hidden && npArt.dataset.tid !== String(t.id)) { lrcLines = []; npFillTrack(t); }
  }
  function syncProgress() {
    if (!queue.length) return;
    plCur.textContent = fmt(musicAudio.currentTime || 0);
    plSeek.value = Math.floor(musicAudio.currentTime || 0);
    npSyncTime();
    setMediaPos();
  }
  function refreshPlaying() {
    var cur = current();
    plToggle.textContent = cur && !musicAudio.paused ? "⏸" : "▶";
    npToggle.textContent = plToggle.textContent;
    emit(stateListeners, { track: cur, playing: isPlaying() });
  }

  /* ================= 播放核心 ================= */
  async function playTrack(idx, keepPlaying) {
    if (!queue.length) return;
    queueIdx = (idx % queue.length + queue.length) % queue.length;
    var seq = ++playSeq;
    var t = queue[queueIdx];
    showPlayer(t);
    refreshPlaying();
    musicAudio.pause();
    try {
      var url = null, lastErr = null;
      for (var a = 0; a < 2; a++) {
        try { url = await resolveUrl(t.id); break; }
        catch (e) {
          lastErr = e;
          if (e.message === "no url") break;
          if (a === 0) await new Promise(function (r) { setTimeout(r, 900); });
        }
      }
      if (seq !== playSeq) return;
      if (!url) throw lastErr || new Error("net");
      musicAudio.src = url;
      plArtist.textContent = t.artist;
      setMediaSession(t);
      await musicAudio.play();
      setMediaState("playing");
      pushHistory(t);          /* 真实开播才算听过 */
      emit(startListeners, t);
      prefetchQueueLyrics();   /* 一边听，一边把后面 3 首的歌词备好 */
      saveState();
    } catch (e) {
      if (seq !== playSeq) return;
      plArtist.textContent = e.message === "no url"
        ? "这首歌暂时无法播放（版权限制），换一首试试吧～"
        : "网络开小差了，再点一次试试～";
      setMediaState("paused");
    }
    refreshPlaying();
  }
  function playList(list, idx, opts) {
    if (!list || !list.length) return;
    queue = list.slice();
    queueSource = (opts && opts.source) || "";
    audioRecover = 0;
    return playTrack(idx || 0);
  }
  function togglePlay() {
    if (!queue.length) return;
    if (musicAudio.paused) musicAudio.play().catch(function () {});
    else musicAudio.pause();
    refreshPlaying();
  }
  function playNext() {
    if (!queue.length) return Promise.resolve();
    if (queueIdx + 1 < queue.length) return playTrack(queueIdx + 1);
    /* 整批播完：交给页面的「下一批」处理器（每日推荐会继续换一批） */
    var res = queueEndHandler ? queueEndHandler(queueSource) : undefined;
    return Promise.resolve(res).then(function (nl) {
      if (Array.isArray(nl) && nl.length) return playList(nl, 0, { source: queueSource });
      if (nl === false) return;              /* 明确停止（例如后面几批都没版权） */
      return playTrack(0);                   /* 其他列表循环回第一首 */
    }).catch(function () { return playTrack(0); });
  }
  function playPrev() { if (queue.length) return playTrack(queueIdx - 1); }

  /* 最小化：悬浮窗收成左侧小球，音乐继续 */
  function minimizePlayer() {
    playerMinimized = true;
    playerBar.hidden = true;
    playerMini.hidden = false;
  }
  playerMini.addEventListener("click", function () {
    playerMinimized = false;
    playerMini.hidden = true;
    playerBar.hidden = false;
    if (!playerPlaced) placePlayer();
  });
  /* 关闭：停止播放、清空队列 */
  function closePlayer() {
    playerMinimized = false;
    playSeq++;
    musicAudio.pause();
    musicAudio.removeAttribute("src");
    musicAudio.load();
    queue = []; queueIdx = -1; queueSource = "";
    playerBar.hidden = true;
    playerMini.hidden = true;
    setMediaState("none");
    if ("mediaSession" in navigator) { try { navigator.mediaSession.metadata = null; } catch (e) { /* 忽略 */ } }
    refreshPlaying();
    try { localStorage.removeItem(STATE_KEY); } catch (e) { /* 忽略 */ }
  }

  plToggle.addEventListener("click", togglePlay);
  plNext.addEventListener("click", function () { playNext(); });
  plPrev.addEventListener("click", function () { playPrev(); });
  plMin.addEventListener("click", minimizePlayer);
  plClose.addEventListener("click", closePlayer);
  plMax.addEventListener("click", openNowPlaying);
  plSeek.addEventListener("input", function () { if (isFinite(musicAudio.duration)) musicAudio.currentTime = +plSeek.value; });
  plFav.addEventListener("click", function () { toggleFav(current()); });
  npPrev.addEventListener("click", function () { playPrev(); });
  npNext.addEventListener("click", function () { playNext(); });
  npToggle.addEventListener("click", togglePlay);
  npSeek.addEventListener("input", function () { if (isFinite(musicAudio.duration)) musicAudio.currentTime = +npSeek.value; });

  musicAudio.addEventListener("ended", function () { playNext(); });
  musicAudio.addEventListener("play", function () { refreshPlaying(); setMediaState("playing"); });
  musicAudio.addEventListener("pause", function () { refreshPlaying(); setMediaState("paused"); saveState(); });
  musicAudio.addEventListener("loadedmetadata", function () {
    plDur.textContent = fmt(musicAudio.duration);
    plSeek.max = Math.floor(musicAudio.duration) || 30;
    npDur.textContent = plDur.textContent;
    npSeek.max = plSeek.max;
    setMediaPos();
  });
  musicAudio.addEventListener("timeupdate", function () {
    syncProgress();
    followLyric();
  });
  /* 后台自动补帧：标签页被限速时 timeupdate 会变稀，靠定时器读真实进度补上 */
  setInterval(function () {
    if (musicAudio.paused) return;
    syncProgress();
    followLyric();
  }, 400);

  /* 播放中网络波动自愈：地址过期/断网时重新解析并从原进度继续，最多 3 次 */
  var audioRecover = 0;
  musicAudio.addEventListener("playing", function () { audioRecover = 0; });
  musicAudio.addEventListener("error", async function () {
    var cur = current();
    if (!cur || audioRecover >= 3) return;
    audioRecover++;
    var at = musicAudio.currentTime || 0;
    plArtist.textContent = "网络波动，正在重连…";
    try {
      var url = await resolveUrl(cur.id);
      if (current() !== cur) return;
      musicAudio.src = url;
      musicAudio.addEventListener("loadedmetadata", function () {
        try { musicAudio.currentTime = at; } catch (e) { /* 忽略 */ }
      }, { once: true });
      await musicAudio.play();
    } catch (e) {
      if (current() === cur && musicAudio.error) plArtist.textContent = "网络不稳定，点播放键再试一次～";
    }
  });

  /* ================= 播放详情页 ================= */
  function npSyncTime() {
    npCur.textContent = fmt(musicAudio.currentTime || 0);
    npDur.textContent = fmt(musicAudio.duration || 0);
    if (isFinite(musicAudio.duration) && musicAudio.duration > 0) {
      npSeek.max = Math.floor(musicAudio.duration);
      if (document.activeElement !== npSeek) npSeek.value = Math.floor(musicAudio.currentTime || 0);
    }
  }
  function npFillTrack(t) {
    npArt.dataset.tid = String(t.id);
    if (t.art) {
      npArt.dataset.fb = ""; npArt.style.visibility = "visible";
      npArt.src = t.art;                 /* 先显示卡片同款缩略图，别让用户盯着白框等 */
      var hi = bigArt(t.art, 500);       /* 250px 展示 + 高分屏 2x，500y500 点对点清晰 */
      if (npArt.dataset.hi !== hi) {
        npArt.dataset.hi = hi;
        var im = new Image();            /* 高清图在后台预载，载完再换，无闪烁 */
        im.onload = function () { if (npArt.dataset.hi === hi) npArt.src = hi; };
        im.src = hi;
      }
    }
    else npArt.style.visibility = "hidden";
    npName.textContent = t.name;
    npName.title = t.name;
    npArtist.textContent = t.artist || "";
    npArtist.dataset.arid = t.arid || "";
    npArtist.dataset.aname = t.aname || t.artist || "";
    loadLyricsInto(t.id);
  }
  function openNowPlaying() {
    var t = current();
    if (!t) return;
    npMask.hidden = false;
    npSyncTime();
    if (npArt.dataset.tid !== String(t.id)) { lrcLines = []; npFillTrack(t); }
    else followLyric();
  }
  function closeNowPlaying() {
    npMask.hidden = true;
    npVolPop.hidden = true;
    npRatePop.hidden = true;
  }
  npClose.addEventListener("click", closeNowPlaying);
  npLyrics.addEventListener("click", function (e) {
    var p = e.target.closest("p[data-i]");
    if (!p || !lrcLines.length) return;
    var line = lrcLines[+p.dataset.i];
    if (line && isFinite(musicAudio.duration)) {
      musicAudio.currentTime = Math.max(0, line.t - 0.2);
      followLyric();
    }
  });
  ["wheel", "touchmove"].forEach(function (ev) {
    npLyrics.addEventListener(ev, function () { userScrollAt = Date.now(); }, { passive: true });
  });

  /* ================= 歌手弹窗 ================= */
  var arCache = {};        /* arid → { artist, songs } */
  var arCur = null;        /* { arid, name, songs, playable } */

  function artistSongsOf(raw) {
    return (raw || []).map(function (s) {
      var ars = (s.ar || s.artists || []).map(function (a) { return { id: a.id, name: a.name }; });
      return {
        id: s.id,
        name: s.name,
        artist: ars.map(function (a) { return a.name; }).join(" / "),
        album: (s.al && s.al.name) || (s.album && s.album.name) || "",
        art: artOf(s.al || s.album),
        arts: ars,
        arid: ars[0] && ars[0].id,
        aname: ars[0] && ars[0].name,
        dt: (s.dt || s.duration || 0),
      };
    });
  }

  async function fetchArtist(arid) {
    if (arCache[arid]) return arCache[arid];
    /* 资料与歌曲并行请求（并发比串行快一倍以上） */
    var pProf = (async function () {
      try {
        var a = await neteaseGet("/artist/albums/" + arid + "?limit=1&offset=0");
        if (a && a.artist && a.artist.id) return a.artist;
      } catch (e) { /* 换下一个接口 */ }
      try {
        var b = await neteaseGet("/artist/" + arid);
        return (b && b.artist) || {};
      } catch (e) { return {}; }
    })();
    var pSongs = (async function () {
      try {
        var t = await neteaseGet("/artist/top/song?id=" + arid + "&limit=50");
        return artistSongsOf(t.songs);
      } catch (e) { return []; }
    })();
    var got = await Promise.all([pProf, pSongs]);
    var out = { artist: got[0] || {}, songs: got[1] || [] };
    if (out.songs.length || (out.artist && out.artist.id)) arCache[arid] = out;
    return out;
  }

  async function fetchArtistIntro(arid) {
    var d = await neteaseGet("/artist/introduction?id=" + arid);
    var blocks = (d && d.introduction) || [];
    var parts = [];
    blocks.forEach(function (b) {
      var txt = String((b && b.txt) || "").trim();
      if (!txt) return;
      var ti = String((b && b.ti) || "").trim();
      parts.push(ti ? "【" + ti + "】\n" + txt : txt);
    });
    return parts.join("\n\n");
  }

  /* 没有歌手 id 时（例如 GDStudio 通道的结果）按名字反查一次 */
  async function resolveArtistId(name) {
    if (!name) return null;
    var d = await neteaseGet("/cloudsearch/pc?s=" + encodeURIComponent(name) + "&type=100&limit=1&offset=0");
    var ars = (d.result && d.result.artists) || [];
    return ars.length ? ars[0].id : null;
  }

  function arShowLoading(name) {
    arMask.hidden = false;
    arName.textContent = name || "歌手";
    arMetas.textContent = "";
    arStats.textContent = "正在获取歌手信息…";
    arIntro.textContent = "";
    arSongTitle.textContent = "";
    arSongs.innerHTML = '<p class="artist-hint">加载中…</p>';
    arPlayAll.disabled = true;
    arPlayAll.textContent = "▶ 全部播放";
    arAvatar.style.visibility = "hidden";
  }

  async function openArtist(arid, aname) {
    arCur = null;
    arShowLoading(aname);
    try {
      if (!arid && aname) arid = await resolveArtistId(aname);
      if (!arid) throw new Error("找不着这位歌手的信息～");
      /* 简介和资料/歌曲一起要，谁先回来谁先显示 */
      var pIntro = fetchArtistIntro(arid).catch(function () { return null; });
      var data = await fetchArtist(arid);
      var prof = data.artist || {};
      var songs = data.songs || [];
      if (!songs.length && !prof.name) throw new Error("找不着这位歌手的信息～");

      arName.textContent = prof.name || aname || "歌手";
      var alias = (prof.alias || []).join(" / ");
      arAvatar.dataset.fb = "";
      if (prof.picUrl) { arAvatar.src = bigArt(prof.picUrl, 300); arAvatar.style.visibility = "visible"; }
      else arAvatar.style.visibility = "hidden";
      arMetas.textContent = alias ? ("别名：" + alias) : "";
      var stat = [];
      if (prof.musicSize) stat.push("单曲 " + prof.musicSize + " 首");
      if (prof.albumSize) stat.push("专辑 " + prof.albumSize + " 张");
      if (prof.mvSize) stat.push("MV " + prof.mvSize + " 个");
      arStats.textContent = stat.join(" · ");

      /* 歌曲列表先出来，播放地址过滤与简介在后台继续 */
      renderArtistSongs(arid, arName.textContent, songs);
      arCur = { arid: arid, name: arName.textContent, songs: songs, playable: [] };
      var pFiltered = filterPlayable(songs);

      var intro = await pIntro;
      arIntro.textContent = intro === null
        ? "简介获取失败，稍后再试～"
        : (intro || "这位歌手暂时没有公开简介～");

      var r = await pFiltered;
      if (arCur && arCur.arid === arid) {
        arCur.playable = r.list;
        arPlayAll.disabled = !r.list.length;
        arPlayAll.textContent = r.list.length ? ("▶ 全部播放（" + r.list.length + " 首可播放）") : "▶ 全部播放";
        if (!r.list.length && songs.length) arSongTitle.textContent = "热门 " + songs.length + " 首 · 暂无无版权限制的可播放曲目";
      }
    } catch (e) {
      arStats.textContent = "";
      arSongs.innerHTML = '<p class="artist-hint">' + esc(e.message || "获取失败，稍后再试～") + "</p>";
    }
  }

  function renderArtistSongs(arid, name, songs) {
    arSongTitle.textContent = songs.length ? ("热门 " + songs.length + " 首（点歌名直接播放）") : "歌曲列表为空";
    if (!songs.length) {
      arSongs.innerHTML = '<p class="artist-hint">暂时没拉到这位歌手的歌曲～</p>';
      return;
    }
    arSongs.innerHTML = songs.map(function (t, i) {
      var dur = t.dt ? fmt(t.dt / 1000) : "";
      return '<button class="artist-song" data-i="' + i + '" title="播放 ' + esc(t.name) + '">' +
        '<span class="artist-song-no">' + (i + 1) + "</span>" +
        '<span class="artist-song-main"><span class="artist-song-name">' + esc(t.name) + "</span>" +
        '<span class="artist-song-album">' + esc(t.album || "") + "</span></span>" +
        '<span class="artist-song-dur">' + dur + "</span></button>";
    }).join("");
    arSongs.dataset.arid = arid;
    arSongs.dataset.name = name;
  }

  arSongs.addEventListener("click", function (e) {
    var b = e.target.closest(".artist-song");
    if (!b || !arCur) return;
    var i = +b.dataset.i;
    var list = arCur.playable.length ? arCur.playable : arCur.songs;
    var idx = -1;
    list.forEach(function (t, k) { if (t.id === arCur.songs[i].id) idx = k; });
    if (idx < 0) { /* 这首不在可播放集合里，就从它开始按原列表播（失败会自己提示） */
      list = arCur.songs; idx = i;
    }
    arMask.hidden = true;
    playList(list, idx, { source: "artist" });
  });
  arPlayAll.addEventListener("click", function () {
    if (!arCur) return;
    var list = arCur.playable.length ? arCur.playable : arCur.songs;
    if (!list.length) return;
    arMask.hidden = true;
    playList(list, 0, { source: "artist" });
  });
  arClose.addEventListener("click", function () { arMask.hidden = true; });
  arMask.addEventListener("click", function (e) { if (e.target === arMask) arMask.hidden = true; });

  /* 悬浮窗 / 详情页的歌手名也可点开歌手页 */
  [plArtist, npArtist].forEach(function (el) {
    el.style.cursor = "pointer";
    el.title = "点我看看这位歌手的简介和音乐";
    el.addEventListener("click", function () {
      openArtist(el.dataset.arid || "", el.dataset.aname || "");
    });
  });

  /* Esc：先关歌手页，再关详情页 */
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (!arMask.hidden) { arMask.hidden = true; return; }
    if (!npMask.hidden) closeNowPlaying();
  });

  /* ================= 刷新/换页后续播 ================= */
  (function restore() {
    var st = loadState();
    if (!st) return;
    queue = st.list;
    queueIdx = Math.max(0, Math.min(st.idx || 0, queue.length - 1));
    queueSource = st.source || "";
    var t = queue[queueIdx];
    if (!t) return;
    if (!playerPlaced) { applyPlayerScale(); placePlayer(); }
    showPlayer(t);
    plArtist.textContent = t.artist || "";
    plDur.textContent = fmt((t.dt || 0) / 1000);
    refreshPlaying();
    if (!st.playing) return; /* 上次是暂停状态：只恢复现场，不自动播 */
    resolveUrl(t.id).then(function (url) {
      musicAudio.src = url;
      setMediaSession(t);
      musicAudio.addEventListener("loadedmetadata", function () {
        try { musicAudio.currentTime = st.time || 0; } catch (e) { /* 忽略 */ }
      }, { once: true });
      return musicAudio.play();
    }).then(function () {
      setMediaState("playing");
      prefetchQueueLyrics();
    }).catch(function () {
      /* 浏览器要求先交互：把窗口摆好、提示点一下继续（位置不丢） */
      setMediaState("paused");
      plArtist.textContent = "点 ▶ 继续播放（" + t.artist + "）";
    });
  })();

  /* ================= 对外接口 ================= */
  window.HJY = {
    /* 播放控制 */
    playList: playList,
    toggle: togglePlay,
    play: function () { if (musicAudio.paused) return musicAudio.play().catch(function () {}); },
    pause: function () { musicAudio.pause(); },
    next: playNext,
    prev: playPrev,
    stop: closePlayer,
    minimize: minimizePlayer,
    restorePlayer: function () { playerMinimized = false; playerMini.hidden = true; playerBar.hidden = false; },
    openNowPlaying: openNowPlaying,
    current: current,
    currentId: function () { var t = current(); return t ? t.id : null; },
    isPlaying: isPlaying,
    source: function () { return queueSource; },
    seek: function (sec) { musicAudio.currentTime = Math.max(0, sec || 0); },
    setQueueEndHandler: function (fn) { queueEndHandler = fn; },

    /* 通知订阅（返回取消订阅函数） */
    onStateChange: function (fn) { stateListeners.push(fn); return function () { var i = stateListeners.indexOf(fn); if (i >= 0) stateListeners.splice(i, 1); }; },
    onFavsChange: function (fn) { favListeners.push(fn); return function () { var i = favListeners.indexOf(fn); if (i >= 0) favListeners.splice(i, 1); }; },
    onHistoryChange: function (fn) { histListeners.push(fn); return function () { var i = histListeners.indexOf(fn); if (i >= 0) histListeners.splice(i, 1); }; },
    onTrackStart: function (fn) { startListeners.push(fn); return function () { var i = startListeners.indexOf(fn); if (i >= 0) startListeners.splice(i, 1); }; },

    /* 收藏 / 历史 */
    getFavs: getFavs,
    setFavs: setFavs,
    isFav: isFav,
    toggleFav: toggleFav,
    getHistory: getHistory,
    setHistory: setHistory,

    /* 歌手 */
    openArtist: openArtist,
    closeArtist: function () { arMask.hidden = true; },
    preloadArtist: function (arid) { if (arid) fetchArtist(arid).catch(function () {}); },

    /* 复用给页面 */
    filterPlayable: filterPlayable,
    resolveUrl: resolveUrl,
    neteaseGet: neteaseGet,
    fetchTimeout: fetchTimeout,
    fetchLyrics: fetchLyrics,
    prefetchLyrics: queueLrcPrefetch,
    artistSongsOf: artistSongsOf,
    artOf: artOf,
    esc: esc,
    fmt: fmt,
  };
})();
