/* 打字机效果 */
const roles = ["在校学生", "编程爱好者", "创意编程玩家"];
const typedEl = document.getElementById("typed");
let roleIndex = 0, charIndex = 0, deleting = false;

function type() {
  const current = roles[roleIndex];
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
const navbar = document.getElementById("navbar");
window.addEventListener("scroll", () => {
  navbar.classList.toggle("scrolled", window.scrollY > 10);
});

/* 移动端菜单 */
const navToggle = document.getElementById("navToggle");
const navLinks = document.getElementById("navLinks");
navToggle.addEventListener("click", () => navLinks.classList.toggle("open"));
navLinks.querySelectorAll("a").forEach((a) =>
  a.addEventListener("click", () => navLinks.classList.remove("open"))
);

/* 滚动入场动画 */
const observer = new IntersectionObserver(
  (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add("visible"); }),
  { threshold: 0.15 }
);
document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));

/* 数字滚动 */
const statObserver = new IntersectionObserver(
  (entries) => entries.forEach((e) => {
    if (!e.isIntersecting || e.target.dataset.done) return;
    e.target.dataset.done = "1";
    const target = +e.target.dataset.count;
    const start = performance.now();
    const step = (now) => {
      const p = Math.min((now - start) / 1200, 1);
      e.target.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }),
  { threshold: 0.5 }
);
document.querySelectorAll(".stat b").forEach((el) => statObserver.observe(el));

/* 平滑滚动到锚点：起止点一次测好，纯缓动插值，长距离也顺滑；
   用户滚轮/触摸可随时打断 */
const NAV_OFFSET = 84;
function smoothScrollTo(target) {
  const startY = window.scrollY;
  const targetTop = Math.max(target.getBoundingClientRect().top + startY - NAV_OFFSET, 0);
  const dist = Math.abs(targetTop - startY);
  if (dist < 1) return;
  const duration = Math.min(Math.max(dist / 3.2, 380), 800);
  const start = performance.now();
  let cancelled = false;
  const cancel = () => { cancelled = true; };
  window.addEventListener("wheel", cancel, { once: true, passive: true });
  window.addEventListener("touchstart", cancel, { once: true, passive: true });
  function frame(now) {
    if (cancelled) return;
    const p = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - p, 3); /* 先快后慢，落点柔和 */
    window.scrollTo({ top: startY + (targetTop - startY) * ease, behavior: "instant" });
    if (p < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener("click", (e) => {
    const id = a.getAttribute("href").slice(1);
    const target = document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    requestAnimationFrame(() => {
      smoothScrollTo(target);
      history.replaceState(null, "", "#" + id);
    });
  });
});

/* 年份 */
document.getElementById("year").textContent = new Date().getFullYear();

/* ============ 登录系统（前端演示版） ============ */
const USER_KEY = "hjy_login_user";
const OWNER = { user: "hjy2014", pass: "hjy2026" }; // 管理员账号（注意：静态页面密码对看源码者可见）
const userArea = document.getElementById("userArea");

function getLoginUser() {
  return localStorage.getItem(USER_KEY) || "";
}

function renderUser() {
  const u = getLoginUser();
  if (u) {
    const isOwner = u === OWNER.user;
    userArea.innerHTML = `
      <div class="user-chip logged-in" id="userChip">
        <span class="uname">${u}${isOwner ? ' <em class="owner-badge">站长</em>' : ""}</span>
        <span class="avatar logged" aria-label="用户头像">👤</span>
      </div>
      <div class="user-menu" id="userMenu">
        ${isOwner ? '<a class="menu-admin" href="https://github.com/Hjy2014/Hjy2014.github.io" target="_blank" rel="noopener">🛠 管理网页</a>' : ""}
        <button class="menu-logout" id="logoutBtn">退出登录</button>
      </div>`;
    const chip = document.getElementById("userChip");
    const menu = document.getElementById("userMenu");
    chip.addEventListener("click", (e) => { e.stopPropagation(); menu.classList.toggle("open"); });
    document.addEventListener("click", () => menu.classList.remove("open"));
    document.getElementById("logoutBtn").addEventListener("click", () => {
      localStorage.removeItem(USER_KEY);
      renderUser();
    });
  } else {
    userArea.innerHTML = `
      <button class="user-chip logged-out" id="loginOpen">
        <span class="uname">未登录</span>
        <span class="avatar blank" aria-label="未登录"></span>
      </button>`;
    document.getElementById("loginOpen").addEventListener("click", openLoginModal);
  }
}

function openLoginModal() {
  if (document.getElementById("loginModal")) return;
  const mask = document.createElement("div");
  mask.id = "loginModal";
  mask.innerHTML = `
    <div class="login-card">
      <button class="login-close" id="loginClose" aria-label="关闭">✕</button>
      <h3>登录</h3>
      <label>用户名
        <input type="text" id="loginUser" autocomplete="username" placeholder="请输入用户名" />
      </label>
      <label>密码
        <input type="password" id="loginPass" autocomplete="current-password" placeholder="请输入密码" />
      </label>
      <p class="login-err" id="loginErr"></p>
      <button class="login-go" id="loginGo">登 录</button>
    </div>`;
  document.body.appendChild(mask);
  const close = () => mask.remove();
  mask.addEventListener("click", (e) => { if (e.target === mask) close(); });
  mask.querySelector("#loginClose").addEventListener("click", close);
  const submit = () => {
    const u = mask.querySelector("#loginUser").value.trim();
    const p = mask.querySelector("#loginPass").value;
    const err = mask.querySelector("#loginErr");
    if (!u || !p) { err.textContent = "用户名和密码不能为空"; return; }
    if (u === OWNER.user && p !== OWNER.pass) { err.textContent = "用户名或密码错误"; return; }
    localStorage.setItem(USER_KEY, u);
    close();
    renderUser();
  };
  mask.querySelector("#loginGo").addEventListener("click", submit);
  mask.querySelectorAll("input").forEach((el) =>
    el.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); })
  );
  mask.querySelector("#loginUser").focus();
}

renderUser();

/* ============ 联系方式弹窗 ============ */
/* 以后想改联系方式，直接改下面这个数组即可 */
const CONTACTS = [
  { icon: "💬", name: "微信", value: "（稍后补充）" },
  { icon: "🎵", name: "抖音", value: "（稍后补充）" },
];

const contactBtn = document.getElementById("contactInfoOpen");
if (contactBtn) {
  contactBtn.addEventListener("click", openContactModal);
}

function openContactModal() {
  if (document.getElementById("contactModal")) return;
  const mask = document.createElement("div");
  mask.id = "contactModal";
  mask.innerHTML = `
    <div class="contact-card">
      <button class="login-close" id="contactClose" aria-label="关闭">✕</button>
      <h3>📇 我的联系方式</h3>
      <ul class="contact-list">
        ${CONTACTS.map(
          (c) => `
        <li class="contact-item">
          <span class="ci-icon">${c.icon}</span>
          <span class="ci-name">${c.name}</span>
          <span class="ci-value">${c.value}</span>
        </li>`
        ).join("")}
      </ul>
      <p class="contact-tip">加好友时请备注来自网站哦～</p>
    </div>`;
  document.body.appendChild(mask);
  const close = () => mask.remove();
  mask.addEventListener("click", (e) => { if (e.target === mask) close(); });
  mask.querySelector("#contactClose").addEventListener("click", close);
}

/* ============ 浏览设备数统计 ============ */
/* Abacus 公共计数器：/hit 加一并返回总数，/get 只读。
   每台设备用 localStorage 标记，只统计一次 → 即「不同设备数」 */
const VISIT_KEY = "hjy_visited";
const COUNTER_BASE = "https://abacus.jasoncameron.dev";
const COUNTER_NS = "hjy2014io";
const COUNTER_KEY = "visitors";

(async function renderVisitCount() {
  const el = document.getElementById("visitCount");
  if (!el) return;
  const isNewDevice = !localStorage.getItem(VISIT_KEY);
  try {
    const action = isNewDevice ? "hit" : "get";
    const res = await fetch(`${COUNTER_BASE}/${action}/${COUNTER_NS}/${COUNTER_KEY}`);
    const data = await res.json();
    if (typeof data.value === "number") {
      el.innerHTML = `👀 本站已被 <b>${data.value}</b> 台不同设备浏览过`;
      localStorage.setItem(VISIT_KEY, "1");
    } else {
      el.remove();
    }
  } catch (e) {
    el.remove(); /* 计数服务不可用时静默隐藏 */
  }
})();

/* ============ 音乐板块（网易云完整版播放器） ============ */
/* 数据来源：网易云音乐公开接口（经 allorigins CORS 代理），完整版播放。
   搜索框在上、下方直接展示每日推荐；收藏只存歌曲信息（key: hjy_music_favs_v2），
   播放时再实时解析播放地址（地址会过期）。播放窗为可拖动悬浮窗。 */
const MUSIC_FAV_KEY = "hjy_music_favs_v2";
const PLAYER_POS_KEY = "hjy_player_pos";
const PAGE_SIZE = 30; /* 每页歌曲数 */

const NE_BASE = "https://music.163.com/api";
const PROXY = "https://api.allorigins.win/raw?url=";

const musicGrid = document.getElementById("musicGrid");
const musicStatus = document.getElementById("musicStatus");
const musicCaption = document.getElementById("musicCaption");
const musicInput = document.getElementById("musicInput");
const musicSearchBtn = document.getElementById("musicSearchBtn");
const favCountEl = document.getElementById("favCount");
const favTab = document.getElementById("favTab");
const musicPager = document.getElementById("musicPager");
const pagePrev = document.getElementById("pagePrev");
const pageNext = document.getElementById("pageNext");
const pageInfo = document.getElementById("pageInfo");
const dailyRefresh = document.getElementById("dailyRefresh");

const playerBar = document.getElementById("playerBar");
const plArt = document.getElementById("plArt");
const plName = document.getElementById("plName");
const plArtist = document.getElementById("plArtist");
const plPrev = document.getElementById("plPrev");
const plToggle = document.getElementById("plToggle");
const plNext = document.getElementById("plNext");
const plSeek = document.getElementById("plSeek");
const plCur = document.getElementById("plCur");
const plDur = document.getElementById("plDur");
const plFav = document.getElementById("plFav");
const plClose = document.getElementById("plClose");

/* ---- 状态 ---- */
let musicView = "home";          /* home=搜索+每日推荐 | search=搜索结果 | fav=我的收藏 */
let lastView = "home";           /* 从收藏页返回时用 */
const searchCache = {};          /* { 关键词: { 页码: 歌曲列表 } } */
let searchKw = "", searchPage = 1;
let dailyList = [];              /* 今日推荐列表 */
let dailyOffset = 0;             /* 换一批偏移：0/30/60 三批轮换 */
const DAILY_KEYWORDS = [
  "周杰伦", "林俊杰", "薛之谦", "邓紫棋", "陈奕迅", "五月天",
  "Taylor Swift", "Ed Sheeran", "许嵩", "毛不易", "王菲", "张学友",
  "Bruno Mars", "张杰", "李荣浩", "Billie Eilish",
  "陶喆", "王心凌", "告五人", "房东的猫", "Adele", "Coldplay",
  "朴树", "郁可唯", "周深", "单依纯", "汪苏泷", "徐佳莹",
];
let dailyKeyword = "";

/* ---- 播放器状态 ---- */
const musicAudio = new Audio();
let queue = [], queueIdx = -1;   /* 当前播放队列与位置 */
let playSeq = 0;                 /* 播放请求序号，防止快速切换时旧响应覆盖 */

function getFavs() {
  try { return JSON.parse(localStorage.getItem(MUSIC_FAV_KEY)) || []; }
  catch (e) { return []; }
}
function setFavs(list) { localStorage.setItem(MUSIC_FAV_KEY, JSON.stringify(list)); }
function isFav(id) { return getFavs().some((t) => t.id === id); }

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

function fmt(sec) {
  if (!isFinite(sec)) return "0:00";
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return m + ":" + String(s).padStart(2, "0");
}

/* ---- 网易云接口（经 CORS 代理） ---- */
async function neteaseGet(pathAndQuery) {
  const res = await fetch(PROXY + encodeURIComponent(NE_BASE + pathAndQuery));
  if (!res.ok) throw new Error("proxy " + res.status);
  return res.json();
}

async function fetchTracks(term, offset) {
  const data = await neteaseGet(
    "/search/get?s=" + encodeURIComponent(term) +
    "&type=1&limit=" + PAGE_SIZE + "&offset=" + offset
  );
  return ((data.result && data.result.songs) || []).map((s) => ({
    id: s.id,
    name: s.name,
    artist: (s.artists || []).map((a) => a.name).join(" / "),
    album: (s.album && s.album.name) || "",
    art: ((s.album && s.album.picUrl) || "").replace("http://", "https://"),
  }));
}

/* 播放地址会过期，所以每次播放前实时解析 */
async function resolveUrl(id) {
  const data = await neteaseGet("/song/enhance/player/url?ids=[" + id + "]&br=320000");
  const u = data.data && data.data[0] && data.data[0].url;
  return u ? u.replace("http://", "https://") : null;
}

/* ---- 渲染 ---- */
function trackCard(t) {
  const fav = isFav(t.id);
  const current = queue[queueIdx];
  const isCur = current && current.id === t.id;
  return `
  <div class="music-card ${isCur ? "playing" : ""}" data-id="${t.id}">
    <div class="music-art-wrap">
      <img class="music-art" src="${esc(t.art)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'" />
      <button class="music-fav" data-act="fav" aria-label="收藏">${fav ? "❤️" : "🤍"}</button>
      <button class="music-play" data-act="play" aria-label="播放">${isCur && !musicAudio.paused ? "⏸" : "▶"}</button>
    </div>
    <p class="music-name" title="${esc(t.name)}">${esc(t.name)}</p>
    <p class="music-artist" title="${esc(t.artist)}">${esc(t.artist)}</p>
  </div>`;
}

function currentList() {
  if (musicView === "fav") return getFavs();
  if (musicView === "home") return dailyList;
  return (searchCache[searchKw] && searchCache[searchKw][searchPage]) || [];
}

function renderMusic() {
  const favs = getFavs();
  favCountEl.textContent = favs.length ? `（${favs.length}）` : "";
  favTab.classList.toggle("active", musicView === "fav");
  favTab.innerHTML = musicView === "fav"
    ? "← 返回"
    : `❤️ 我的收藏<span id="favCount">${favs.length ? `（${favs.length}）` : ""}</span>`;

  dailyRefresh.hidden = musicView !== "home";
  musicPager.hidden = musicView !== "search";
  if (musicView === "home") {
    musicCaption.textContent = `✨ 今日推荐 · ${dailyKeyword}`;
  } else if (musicView === "search") {
    musicCaption.textContent = `🔍 “${searchKw}” 的搜索结果`;
    const pageList = (searchCache[searchKw] && searchCache[searchKw][searchPage]) || [];
    pagePrev.disabled = searchPage <= 1;
    pageNext.disabled = pageList.length < PAGE_SIZE;
    pageInfo.textContent = `第 ${searchPage} 页`;
  } else {
    musicCaption.textContent = "❤️ 我的收藏";
  }

  const list = currentList();
  if (musicView === "fav" && !list.length) musicStatus.textContent = "还没有收藏，搜索一首喜欢的歌吧～";
  else if (musicView === "home" && !list.length) musicStatus.textContent = "今日推荐生成中…";
  else musicStatus.textContent = "";
  musicGrid.innerHTML = list.map(trackCard).join("");
}

/* ---- 每日推荐 ---- */
async function loadDaily(offset) {
  dailyOffset = offset;
  musicStatus.textContent = "正在生成今日推荐…";
  musicGrid.innerHTML = "";
  try {
    dailyList = await fetchTracks(dailyKeyword, offset);
    if (musicView === "home") renderMusic();
  } catch (e) {
    musicStatus.textContent = "推荐获取失败，点「换一批」再试试～";
  }
}

/* ---- 搜索（翻页） ---- */
async function searchMusic() {
  const kw = musicInput.value.trim();
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
    const list = await fetchTracks(searchKw, (page - 1) * PAGE_SIZE);
    searchCache[searchKw][page] = list;
    searchPage = page;
    if (!list.length && page === 1) musicStatus.textContent = "没找到相关音乐，换个关键词试试？";
    renderMusic();
  } catch (e) {
    musicStatus.textContent = "搜索失败，可能是网络波动，稍后再试～";
  }
}

/* ---- 悬浮播放窗 ---- */
let playerPlaced = false;

function showPlayer(t) {
  playerBar.hidden = false;
  if (t.art) { plArt.src = t.art; plArt.style.visibility = "visible"; }
  else plArt.style.visibility = "hidden";
  plName.textContent = t.name;
  plName.title = t.name;
  plArtist.textContent = "加载中…";
  plFav.textContent = isFav(t.id) ? "❤️" : "🤍";
  if (!playerPlaced) placePlayer();
}

function placePlayer() {
  const w = playerBar.offsetWidth, h = playerBar.offsetHeight;
  let x = window.innerWidth - w - 20;   /* 默认右下角 */
  let y = window.innerHeight - h - 20;
  try {
    const saved = JSON.parse(localStorage.getItem(PLAYER_POS_KEY));
    if (saved && typeof saved.x === "number" && typeof saved.y === "number" &&
        saved.x < window.innerWidth - 40 && saved.y < window.innerHeight - 40) {
      x = saved.x; y = saved.y;
    }
  } catch (e) { /* 忽略坏数据 */ }
  x = Math.max(8, Math.min(x, window.innerWidth - w - 8));
  y = Math.max(8, Math.min(y, window.innerHeight - h - 8));
  playerBar.style.left = x + "px";
  playerBar.style.top = y + "px";
  playerPlaced = true;
}

/* 拖动：在窗口上按住即可拖（按钮/进度条除外），位置记忆 */
let dragState = null;
playerBar.addEventListener("pointerdown", (e) => {
  if (e.target.closest("button, input")) return;
  const rect = playerBar.getBoundingClientRect();
  dragState = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
  playerBar.setPointerCapture(e.pointerId);
  e.preventDefault();
});
playerBar.addEventListener("pointermove", (e) => {
  if (!dragState) return;
  const w = playerBar.offsetWidth, h = playerBar.offsetHeight;
  let x = e.clientX - dragState.dx, y = e.clientY - dragState.dy;
  x = Math.max(8, Math.min(x, window.innerWidth - w - 8));
  y = Math.max(8, Math.min(y, window.innerHeight - h - 8));
  playerBar.style.left = x + "px";
  playerBar.style.top = y + "px";
});
function endDrag() {
  if (!dragState) return;
  dragState = null;
  localStorage.setItem(PLAYER_POS_KEY, JSON.stringify({
    x: parseInt(playerBar.style.left, 10),
    y: parseInt(playerBar.style.top, 10),
  }));
}
playerBar.addEventListener("pointerup", endDrag);
playerBar.addEventListener("pointercancel", endDrag);

function refreshPlaying() {
  const cur = queue[queueIdx];
  plToggle.textContent = cur && !musicAudio.paused ? "⏸" : "▶";
  document.querySelectorAll(".music-card").forEach((card) => {
    const on = cur && String(cur.id) === card.dataset.id && !musicAudio.paused;
    card.classList.toggle("playing", on);
    card.querySelector(".music-play").textContent = on ? "⏸" : "▶";
  });
}

async function playTrack(list, idx) {
  if (!list.length) return;
  queue = list;
  queueIdx = (idx + list.length) % list.length;
  const seq = ++playSeq;
  const t = queue[queueIdx];
  showPlayer(t);
  refreshPlaying();
  musicAudio.pause();
  try {
    const url = await resolveUrl(t.id);
    if (seq !== playSeq) return; /* 用户已切到别的歌，丢弃旧结果 */
    if (!url) throw new Error("no url");
    musicAudio.src = url;
    plArtist.textContent = t.artist;
    await musicAudio.play();
  } catch (e) {
    if (seq !== playSeq) return;
    plArtist.textContent = "暂时无法播放（版权限制），试试其他歌曲吧～";
  }
  refreshPlaying();
}

function playNext() { if (queue.length) playTrack(queue, queueIdx + 1); }
function playPrev() { if (queue.length) playTrack(queue, queueIdx - 1); }

function closePlayer() {
  playSeq++;
  musicAudio.pause();
  musicAudio.removeAttribute("src");
  queue = []; queueIdx = -1;
  playerBar.hidden = true;
  refreshPlaying();
}

/* 播放器事件 */
plToggle.addEventListener("click", () => {
  if (!queue.length) return;
  if (musicAudio.paused) musicAudio.play().catch(() => {});
  else musicAudio.pause();
  refreshPlaying();
});
plNext.addEventListener("click", playNext);
plPrev.addEventListener("click", playPrev);
plClose.addEventListener("click", closePlayer);

musicAudio.addEventListener("ended", playNext);
musicAudio.addEventListener("play", refreshPlaying);
musicAudio.addEventListener("pause", refreshPlaying);
musicAudio.addEventListener("loadedmetadata", () => {
  plDur.textContent = fmt(musicAudio.duration);
  plSeek.max = Math.floor(musicAudio.duration) || 30;
});
musicAudio.addEventListener("timeupdate", () => {
  plCur.textContent = fmt(musicAudio.currentTime);
  plSeek.value = Math.floor(musicAudio.currentTime);
});
plSeek.addEventListener("input", () => {
  if (isFinite(musicAudio.duration)) musicAudio.currentTime = +plSeek.value;
});

plFav.addEventListener("click", () => {
  const t = queue[queueIdx];
  if (!t) return;
  const favs = getFavs();
  const i = favs.findIndex((x) => x.id === t.id);
  if (i >= 0) favs.splice(i, 1); else favs.push(t);
  setFavs(favs);
  plFav.textContent = isFav(t.id) ? "❤️" : "🤍";
  renderMusic();
});

/* ---- 视图切换 ---- */
favTab.addEventListener("click", () => {
  if (musicView === "fav") {
    musicView = lastView || "home";
  } else {
    lastView = musicView;
    musicView = "fav";
  }
  renderMusic();
});

/* ---- 搜索控件 ---- */
musicSearchBtn.addEventListener("click", searchMusic);
musicInput.addEventListener("keydown", (e) => { if (e.key === "Enter") searchMusic(); });

/* ---- 翻页 / 换一批 ---- */
pagePrev.addEventListener("click", () => { if (searchPage > 1) gotoSearchPage(searchPage - 1); });
pageNext.addEventListener("click", () => gotoSearchPage(searchPage + 1));
dailyRefresh.addEventListener("click", () => {
  loadDaily((dailyOffset + PAGE_SIZE) % (PAGE_SIZE * 3)); /* 三批轮换 */
});

/* ---- 卡片按钮：播放 / 收藏（事件委托） ---- */
musicGrid.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-act]");
  if (!btn) return;
  const card = btn.closest(".music-card");
  const id = Number(card.dataset.id);
  const list = currentList();
  const idx = list.findIndex((t) => t.id === id);
  if (idx < 0) return;
  if (btn.dataset.act === "play") {
    const cur = queue[queueIdx];
    if (cur && cur.id === id) {
      if (musicAudio.paused) musicAudio.play().catch(() => {});
      else musicAudio.pause();
      refreshPlaying();
    } else {
      playTrack(list, idx);
    }
  } else if (btn.dataset.act === "fav") {
    const favs = getFavs();
    const i = favs.findIndex((t) => t.id === id);
    if (i >= 0) favs.splice(i, 1); else favs.push(list[idx]);
    setFavs(favs);
    renderMusic();
  }
});

/* ---- 初始化：按日期固定选一位歌手，每天不同 ---- */
(function initDaily() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now - start) / 86400000);
  const seed = now.getFullYear() * 366 + dayOfYear;
  dailyKeyword = DAILY_KEYWORDS[seed % DAILY_KEYWORDS.length];
  loadDaily(dailyOffset);
})();
