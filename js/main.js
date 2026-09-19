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
const PLAYER_SCALE_KEY = "hjy_player_scale";
const DAILY_CACHE_KEY = "hjy_daily_cache";
const PAGE_SIZE = 30; /* 每页歌曲数 */

const NE_BASE = "https://music.163.com/api";
/* 多个公共 CORS 代理兜底：请求时前两个并行竞速，哪个快用哪个；失败的通道下次自动降级 */
const PROXIES = [
  (u) => "https://api.allorigins.win/raw?url=" + encodeURIComponent(u),
  (u) => "https://api.codetabs.com/v1/proxy?quest=" + encodeURIComponent(u),
  (u) => "https://corsproxy.io/?url=" + encodeURIComponent(u),
  (u) => "https://api.allorigins.win/get?url=" + encodeURIComponent(u), /* 返回包了一层 */
];
let goodProxy = 0;

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
const plMin = document.getElementById("plMin");
const plClose = document.getElementById("plClose");
const playerMini = document.getElementById("playerMini");
const pfResize = document.getElementById("pfResize");

/* ---- 状态 ---- */
let musicView = "home";          /* home=搜索+每日推荐 | search=搜索结果 | fav=我的收藏 */
let lastView = "home";           /* 从收藏页返回时用 */
let favPlayable = [];            /* 收藏里检查过可播放的 */
let favChecked = false;          /* 收藏可播性是否已检查过 */
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

/* ---- 网易云接口（多代理并行竞速 + 超时 + 整轮重试） ---- */
function fetchTimeout(url, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

/* 单个代理取一次：返回解析好的 JSON，失败抛错 */
async function tryProxy(idx, target) {
  const res = await fetchTimeout(PROXIES[idx](target), 9000);
  if (!res.ok) throw new Error("proxy " + res.status);
  let text = await res.text();
  /* allorigins /get 变体返回 {"contents": "..."} 包装，需要拆开 */
  if (text.charAt(0) === "{" && text.indexOf('"contents"') === 1) {
    const wrapped = JSON.parse(text);
    if (typeof wrapped.contents !== "string") throw new Error("bad wrapper");
    text = wrapped.contents;
  }
  return JSON.parse(text);
}

async function neteaseGet(pathAndQuery) {
  const target = NE_BASE + pathAndQuery;
  const idxs = PROXIES.map((_, i) => i);
  const order = [goodProxy, ...idxs.filter((i) => i !== goodProxy)];
  let lastErr = null;
  for (let pass = 0; pass < 2; pass++) {           /* 整轮失败后歇 800ms 再来一轮 */
    /* 前两个代理并行竞速：谁先成功用谁 */
    try {
      const racers = order.slice(0, 2).map(async (idx) => ({ idx, data: await tryProxy(idx, target) }));
      const win = await Promise.any(racers);
      goodProxy = win.idx;
      return win.data;
    } catch (e) { lastErr = e; }
    /* 其余代理依次兜底 */
    for (const idx of order.slice(2)) {
      try {
        const data = await tryProxy(idx, target);
        goodProxy = idx;
        return data;
      } catch (e) { lastErr = e; }
    }
    if (pass === 0) await new Promise((r) => setTimeout(r, 800));
  }
  throw lastErr || new Error("所有网络通道都失败了");
}

/* 图片加载失败兜底：第1步换镜像域名（秒级），第2步走代理，最后隐藏 */
window.pfImgFallback = function (img) {
  const step = +(img.dataset.fb || 0);
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

/* 批量可播性检查：一次请求整页歌的播放地址，去掉无版权（拿不到地址）和试听片段的。
   返回 {list, checked}：checked=false 表示检查本身失败（此时不筛，也不该被缓存） */
async function filterPlayable(list) {
  if (!list.length) return { list, checked: false };
  try {
    const ids = "[" + list.map((t) => t.id).join(",") + "]";
    const data = await neteaseGet("/song/enhance/player/url?ids=" + ids + "&br=320000");
    const ok = new Set((data.data || [])
      .filter((d) => d && d.url && !d.freeTrialInfo) /* 无地址=无版权；freeTrialInfo=30秒试听 */
      .map((d) => d.id));
    return { list: list.filter((t) => ok.has(t.id)), checked: true };
  } catch (e) {
    return { list, checked: false }; /* 检查通道失败时不误杀，宁可先显示 */
  }
}

function artOf(al) {
  const u = (al && al.picUrl) || "";
  return u.replace("http://", "https://")
    + (u && !u.includes("?") ? "?param=240y240" : "");
}

/* 搜索一页：cloudsearch 接口自带封面地址。
   onRaw 回调：搜索结果一到就先画出来（不等版权检查），过滤完再更新 */
async function fetchTracks(term, offset, onRaw) {
  const data = await neteaseGet(
    "/cloudsearch/pc?s=" + encodeURIComponent(term) +
    "&type=1&limit=" + PAGE_SIZE + "&offset=" + offset
  );
  const raw = ((data.result && data.result.songs) || []).map((s) => ({
    id: s.id,
    name: s.name,
    artist: (s.ar || s.artists || []).map((a) => a.name).join(" / "),
    album: (s.al && s.al.name) || (s.album && s.album.name) || "",
    art: artOf(s.al || s.album),
  }));
  if (onRaw) onRaw(raw);
  const r = await filterPlayable(raw);
  return { list: r.list, more: raw.length >= PAGE_SIZE, checked: r.checked };
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
      <img class="music-art" src="${esc(t.art)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="pfImgFallback(this)" />
      <button class="music-fav" data-act="fav" aria-label="收藏">${fav ? "❤️" : "🤍"}</button>
      <button class="music-play" data-act="play" aria-label="播放">${isCur && !musicAudio.paused ? "⏸" : "▶"}</button>
    </div>
    <p class="music-name" title="${esc(t.name)}">${esc(t.name)}</p>
    <p class="music-artist" title="${esc(t.artist)}">${esc(t.artist)}</p>
  </div>`;
}

function currentList() {
  if (musicView === "fav") return favChecked ? favPlayable : getFavs();
  if (musicView === "home") return dailyList;
  const entry = searchCache[searchKw] && searchCache[searchKw][searchPage];
  return (entry && entry.list) || [];
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
    const entry = searchCache[searchKw] && searchCache[searchKw][searchPage];
    pagePrev.disabled = searchPage <= 1;
    pageNext.disabled = !(entry && entry.more); /* 服务端还有下一页才可点 */
    pageInfo.textContent = `第 ${searchPage} 页`;
  } else {
    musicCaption.textContent = "❤️ 我的收藏";
  }

  const list = currentList();
  if (musicView === "fav" && !list.length) {
    const total = getFavs().length;
    musicStatus.textContent = (favChecked && total)
      ? "收藏里的无版权歌曲已自动隐藏～"
      : "还没有收藏，搜索一首喜欢的歌吧～";
  } else if (musicView === "home" && !list.length) musicStatus.textContent = "今日推荐生成中…";
  else musicStatus.textContent = "";
  musicGrid.innerHTML = list.map(trackCard).join("");
}

/* ---- 每日推荐 ---- */
async function loadDaily(offset) {
  dailyOffset = offset;
  musicStatus.textContent = "正在生成今日推荐…";
  musicGrid.innerHTML = "";
  try {
    const res = await fetchTracks(dailyKeyword, offset, (raw) => {
      /* 推荐列表一到就先显示（已带封面），版权过滤在后台继续 */
      dailyList = raw;
      if (musicView === "home") { renderMusic(); musicStatus.textContent = "正在过滤无版权歌曲…"; }
    });
    dailyList = res.list;
    if (musicView === "home") {
      renderMusic();
      if (!res.list.length) musicStatus.textContent = "这一批没有可播放的歌曲，点「换一批」试试吧～";
    }
    if (res.checked) { /* 只有确认过滤过的列表才值得缓存（v=缓存格式版本） */
      try {
        localStorage.setItem(DAILY_CACHE_KEY, JSON.stringify({ v: 3, day: dayKey(), off: offset, list: dailyList }));
      } catch (e) { /* 忽略存储失败 */ }
    }
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
    const res = await fetchTracks(searchKw, (page - 1) * PAGE_SIZE, (raw) => {
      /* 搜索结果一到就先显示（此时已带封面），版权过滤在后台继续 */
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
  } catch (e) {
    musicStatus.textContent = "搜索失败，可能是网络波动，稍后再试～";
  }
}

/* ---- 悬浮播放窗 ---- */
let playerPlaced = false;
let playerScale = 1;
try {
  const s = parseFloat(localStorage.getItem(PLAYER_SCALE_KEY));
  if (s >= 0.7 && s <= 2.5) playerScale = s;
} catch (e) { /* 忽略坏数据 */ }

function applyPlayerScale() {
  playerBar.style.transform = "scale(" + playerScale + ")";
}
function savePlayerScale() {
  localStorage.setItem(PLAYER_SCALE_KEY, String(playerScale));
}

function showPlayer(t) {
  if (!playerMinimized) playerBar.hidden = false; /* 最小化时不弹回窗口 */
  if (t.art) {
    plArt.dataset.fb = ""; /* 新歌重新允许兜底重试 */
    plArt.style.visibility = "visible";
    plArt.src = t.art;
  } else plArt.style.visibility = "hidden";
  plName.textContent = t.name;
  plName.title = t.name;
  plArtist.textContent = "加载中…";
  plFav.textContent = isFav(t.id) ? "❤️" : "🤍";
  if (!playerPlaced) {
    applyPlayerScale();
    placePlayer();
  }
}

/* 把窗口约束回视口内（拖动/缩放后都要保证可见） */
function clampPlayer() {
  const rect = playerBar.getBoundingClientRect();
  let x = parseFloat(playerBar.style.left);
  if (!isFinite(x)) x = 8;
  let y = parseFloat(playerBar.style.top);
  if (!isFinite(y)) y = 8;
  x = Math.max(8, Math.min(x, window.innerWidth - rect.width - 8));
  y = Math.max(8, Math.min(y, window.innerHeight - rect.height - 8));
  playerBar.style.left = x + "px";
  playerBar.style.top = y + "px";
}

function placePlayer() {
  const rect = playerBar.getBoundingClientRect(); /* 缩放后的实际尺寸 */
  let x = window.innerWidth - rect.width - 20;    /* 默认右下角 */
  let y = window.innerHeight - rect.height - 20;
  try {
    const saved = JSON.parse(localStorage.getItem(PLAYER_POS_KEY));
    if (saved && typeof saved.x === "number" && typeof saved.y === "number" &&
        saved.x < window.innerWidth - 40 && saved.y < window.innerHeight - 40) {
      x = saved.x; y = saved.y;
    }
  } catch (e) { /* 忽略坏数据 */ }
  playerBar.style.left = x + "px";
  playerBar.style.top = y + "px";
  clampPlayer();
  playerPlaced = true;
}

/* 拖动：在窗口上按住即可拖（按钮/进度条除外），位置记忆 */
let dragState = null;
playerBar.addEventListener("pointerdown", (e) => {
  if (e.target.closest("button, input, .pf-resize")) return;
  const rect = playerBar.getBoundingClientRect();
  dragState = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
  playerBar.setPointerCapture(e.pointerId);
  e.preventDefault();
});
playerBar.addEventListener("pointermove", (e) => {
  if (!dragState) return;
  playerBar.style.left = (e.clientX - dragState.dx) + "px";
  playerBar.style.top = (e.clientY - dragState.dy) + "px";
  clampPlayer();
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

/* 缩放：按住右下角手柄拖动，放大/缩小整个播放窗（0.7x ~ 2.5x），比例记忆 */
let resizeState = null;
pfResize.addEventListener("pointerdown", (e) => {
  e.stopPropagation();
  const rect = playerBar.getBoundingClientRect();
  resizeState = { x: e.clientX, y: e.clientY, scale: playerScale, w: rect.width, h: rect.height };
  pfResize.setPointerCapture(e.pointerId);
  e.preventDefault();
});
pfResize.addEventListener("pointermove", (e) => {
  if (!resizeState) return;
  const rx = (e.clientX - resizeState.x + resizeState.w) / resizeState.w;
  const ry = (e.clientY - resizeState.y + resizeState.h) / resizeState.h;
  playerScale = Math.min(2.5, Math.max(0.7, resizeState.scale * Math.max(rx, ry)));
  applyPlayerScale();
  clampPlayer();
});
function endResize() {
  if (!resizeState) return;
  resizeState = null;
  savePlayerScale();
}
pfResize.addEventListener("pointerup", endResize);
pfResize.addEventListener("pointercancel", endResize);

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

/* 最小化：悬浮窗真正隐藏，变成贴屏幕最左侧的小球，音乐继续播放 */
let playerMinimized = false;
function minimizePlayer() {
  playerMinimized = true;
  playerBar.hidden = true;
  playerMini.hidden = false;
}
playerMini.addEventListener("click", () => {
  playerMinimized = false;
  playerMini.hidden = true;
  playerBar.hidden = false;
});

/* 关闭：停止播放、清空队列，悬浮窗和小球都收起来 */
function closePlayer() {
  playerMinimized = false;
  playSeq++;
  musicAudio.pause();
  musicAudio.removeAttribute("src");
  musicAudio.load(); /* 中断下载中的音频 */
  queue = []; queueIdx = -1;
  playerBar.hidden = true;
  playerMini.hidden = true;
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
plMin.addEventListener("click", minimizePlayer);
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
favTab.addEventListener("click", async () => {
  if (musicView === "fav") {
    musicView = lastView || "home";
    renderMusic();
  } else {
    lastView = musicView;
    musicView = "fav";
    favChecked = false;
    renderMusic(); /* 先显示全部收藏 */
    const r = await filterPlayable(getFavs()); /* 再后台筛掉无版权的 */
    favPlayable = r.list;
    favChecked = true;
    if (musicView === "fav") renderMusic();
  }
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
    favPlayable = favPlayable.filter((t) => t.id !== id); /* 同步收藏过滤视图 */
    renderMusic();
  }
});

/* ---- 初始化：按日期固定选一位歌手，每天不同；今天已拉取过则直接用本地缓存 ---- */
function dayKey() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  return now.getFullYear() * 366 + Math.floor((now - start) / 86400000);
}
(function initDaily() {
  dailyKeyword = DAILY_KEYWORDS[dayKey() % DAILY_KEYWORDS.length];
  try {
    const c = JSON.parse(localStorage.getItem(DAILY_CACHE_KEY));
    if (c && c.v === 3 && c.day === dayKey() && Array.isArray(c.list) && c.list.length) {
      dailyList = c.list;
      dailyOffset = c.off || 0;
      renderMusic();
      return; /* 命中今日缓存，不再请求网络 */
    }
  } catch (e) { /* 缓存坏了就走网络 */ }
  loadDaily(0);
})();
