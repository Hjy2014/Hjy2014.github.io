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
const SEARCH_DISK_KEY = "hjy_search_cache_v1";

/* 搜索结果磁盘缓存：网络波动时用之前搜过的结果兜底（只存过滤过的列表，上限 40 条） */
function loadSearchDisk() {
  try { return JSON.parse(localStorage.getItem(SEARCH_DISK_KEY)) || {}; }
  catch (e) { return {}; }
}
function saveSearchDisk(kw, page, entry) {
  try {
    const d = loadSearchDisk();
    d[kw + "\u0001" + page] = { t: Date.now(), list: entry.list, more: entry.more };
    const keys = Object.keys(d);
    if (keys.length > 40) {
      keys.sort((a, b) => d[a].t - d[b].t).slice(0, keys.length - 40)
        .forEach((k) => delete d[k]);
    }
    localStorage.setItem(SEARCH_DISK_KEY, JSON.stringify(d));
  } catch (e) { /* 存储失败不影响主流程 */ }
}
const PAGE_SIZE = 12; /* 每页歌曲数：页小响应快，逐页搜索逐页展示 */

const NE_BASE = "https://music.163.com/api";
/* 多个公共 CORS 代理兜底：请求时前两个并行竞速，哪个快用哪个；失败的通道下次自动降级 */
const PROXIES = [
  (u) => "https://api.allorigins.win/raw?url=" + encodeURIComponent(u),
  (u) => "https://api.codetabs.com/v1/proxy?quest=" + encodeURIComponent(u),
  (u) => "https://api.cors.lol/?url=" + encodeURIComponent(u),
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
const histTab = document.getElementById("histTab");
const histTools = document.getElementById("histTools");
const histSelect = document.getElementById("histSelect");
const histClear = document.getElementById("histClear");
const musicPager = document.getElementById("musicPager");
const pagePrev = document.getElementById("pagePrev");
const pageNext = document.getElementById("pageNext");
const pageInfo = document.getElementById("pageInfo");
const dailyRefresh = document.getElementById("dailyRefresh");
const loadHint = document.getElementById("loadHint"); /* 「音乐加载可能有些慢」提示：只在点换一批后出现 */

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
const askMask = document.getElementById("askMask");
const askText = document.getElementById("askText");
const askOk = document.getElementById("askOk");
const askCancel = document.getElementById("askCancel");
const npMask = document.getElementById("npMask");
const npClose = document.getElementById("npClose");
const npArt = document.getElementById("npArt");
const npName = document.getElementById("npName");
const npArtist = document.getElementById("npArtist");
const npLyrics = document.getElementById("npLyrics");
const npCur = document.getElementById("npCur");
const npDur = document.getElementById("npDur");
const npSeek = document.getElementById("npSeek");
const npPrev = document.getElementById("npPrev");
const npToggle = document.getElementById("npToggle");
const npNext = document.getElementById("npNext");
const npVol = document.getElementById("npVol");
const npVolPop = document.getElementById("npVolPop");
const npVolBar = document.getElementById("npVolBar");

/* ---- 状态 ---- */
let musicView = "home";          /* home=搜索+每日推荐 | search=搜索结果 | fav=我的收藏 | hist=历史记录 */
let lastView = "home";           /* 从收藏/历史页返回时用 */
let histSelMode = false;         /* 历史记录：是否处于多选模式 */
const histSel = new Set();       /* 多选模式下选中的歌曲 id */
let favPlayable = [];            /* 收藏里检查过可播放的 */
let favChecked = false;          /* 收藏可播性是否已检查过 */
const searchCache = {};          /* { 关键词: { 页码: 歌曲列表 } } */
let searchKw = "", searchPage = 1;
let dailyList = [];              /* 今日推荐列表（网易云爆火榜单） */
let dailyOffset = 0;             /* 换一批偏移 */
/* 网易云爆火歌曲榜单：每天轮换一个，"近日爆火"以飙升榜为代表 */
const DAILY_CHARTS = [
  { id: 19723756, name: "飙升榜" },      /* 最近飙升最快的歌，爆火风向标 */
  { id: 2250011882, name: "抖音热歌" },  /* 短视频爆火曲 */
  { id: 3778678, name: "热歌榜" },       /* 全网最热 */
];
let dailyChart = DAILY_CHARTS[0];
let dailyChartLen = PAGE_SIZE * 3; /* 当前榜单总曲数（用于换一批循环范围） */
const chartCache = {};             /* { 榜单playlistId: 原始曲目列表 } */

/* ---- 播放器状态 ---- */
const musicAudio = new Audio();
let queue = [], queueIdx = -1;   /* 当前播放队列与位置 */
let queueIsDaily = false;        /* 当前队列是否为每日推荐的一批（整批播完自动换下一批） */
let playSeq = 0;                 /* 播放请求序号，防止快速切换时旧响应覆盖 */

function getFavs() {
  try { return JSON.parse(localStorage.getItem(MUSIC_FAV_KEY)) || []; }
  catch (e) { return []; }
}
function setFavs(list) { localStorage.setItem(MUSIC_FAV_KEY, JSON.stringify(list)); }
function isFav(id) { return getFavs().some((t) => t.id === id); }

/* ---- 播放历史（本地，最近 100 首） ---- */
const PLAY_HIST_KEY = "hjy_play_history_v1";
function getHist() {
  try { return JSON.parse(localStorage.getItem(PLAY_HIST_KEY)) || []; }
  catch (e) { return []; }
}
function setHist(list) {
  try { localStorage.setItem(PLAY_HIST_KEY, JSON.stringify(list.slice(0, 100))); }
  catch (e) { /* 存储失败不影响播放 */ }
}
function pushHist(t) {
  const h = getHist().filter((x) => x.id !== t.id);
  h.unshift({ id: t.id, name: t.name, artist: t.artist, album: t.album || "", art: t.art || "", t: Date.now() });
  setHist(h);
}

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
    /* 前三个代理并行竞速：谁先成功用谁 */
    try {
      const racers = order.slice(0, 3).map(async (idx) => ({ idx, data: await tryProxy(idx, target) }));
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

/* GDStudio 搜索通道（CORS 直连，不走公共代理） */
async function searchViaGd(term, offset) {
  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const r = await fetchTimeout(
    "https://music-api.gdstudio.xyz/api.php?types=search&source=netease&name=" + encodeURIComponent(term) +
    "&count=" + PAGE_SIZE + "&pages=" + page, 9000);
  if (!r.ok) throw new Error("gd " + r.status);
  const arr = await r.json();
  return (Array.isArray(arr) ? arr : []).map((s) => ({
    id: s.id,
    name: s.name,
    artist: [].concat(s.artist || []).join(" / "),
    album: s.album || "",
    art: String(s.pic || s.picUrl || "").replace("http://", "https://"),
  }));
}

/* 网易云搜索一页（cloudsearch 自带封面） */
async function neSearchRaw(term, offset) {
  const data = await neteaseGet(
    "/cloudsearch/pc?s=" + encodeURIComponent(term) +
    "&type=1&limit=" + PAGE_SIZE + "&offset=" + offset
  );
  return ((data.result && data.result.songs) || []).map((s) => ({
    id: s.id,
    name: s.name,
    artist: (s.ar || s.artists || []).map((a) => a.name).join(" / "),
    album: (s.al && s.al.name) || (s.album && s.album.name) || "",
    art: artOf(s.al || s.album),
  }));
}

/* 双通道赛跑：两条搜索通道同时发请求，谁先带回非空结果用谁；
   全空返回空（正常显示“没找到”），全失败才抛错 */
function raceSearch(pairs) {
  return new Promise((resolve, reject) => {
    let pending = pairs.length, settled = false, lastEmpty = null;
    pairs.forEach((p) => p.then((res) => {
      if (settled) return;
      if (res.raw && res.raw.length) { settled = true; resolve(res); }
      else { lastEmpty = res; if (--pending === 0) { settled = true; resolve(lastEmpty); } }
    }, (e) => {
      if (settled) return;
      if (--pending === 0) { settled = true; if (lastEmpty) resolve(lastEmpty); else reject(e); }
    }));
  });
}

const searchChannel = {}; /* 记住每个关键词上次赢的通道，后续翻页优先走它 */

/* 搜索一页：双通道竞速。
   onRaw 回调：结果一到就先画出来（不等版权检查），过滤完再更新 */
async function fetchTracks(term, offset, onRaw) {
  const order = searchChannel[term] === "gd" ? ["gd", "ne"] : ["ne", "gd"];
  let raw;
  try {
    const win = await raceSearch(order.map((ch) => ({
      ch,
      raw: ch === "ne" ? neSearchRaw(term, offset) : searchViaGd(term, offset),
    })));
    searchChannel[term] = win.ch;
    raw = win.raw;
  } catch (e) {
    throw new Error("所有搜索通道都失败了");
  }
  if (onRaw) onRaw(raw);
  const r = await filterPlayable(raw);
  return { list: r.list, more: raw.length >= PAGE_SIZE, checked: r.checked };
}

/* 播放地址会过期，所以每次播放前实时解析。
   三通道：GDStudio（CORS 直连，不走代理）→ 网易云接口（经代理）→ Meting 兜底。
   源明确答复"没有地址"抛 no url；通道全部网络失败抛 net。 */
async function resolveUrl(id) {
  /* 1) GDStudio 直连（最快最稳） */
  try {
    const r = await fetchTimeout("https://music-api.gdstudio.xyz/api.php?types=url&source=netease&id=" + id + "&br=320000", 8000);
    if (r.ok) {
      const d = await r.json();
      if (d && d.url) return String(d.url).replace("http://", "https://");
      throw new Error("no url");
    }
  } catch (e) {
    if (e.message === "no url") throw e; /* 源明确说没有 = 版权问题 */
    /* 网络问题，落到下一通道 */
  }
  /* 2) 网易云官方接口（经代理） */
  try {
    const data = await neteaseGet("/song/enhance/player/url?ids=[" + id + "]&br=320000");
    const u = data.data && data.data[0] && data.data[0].url;
    if (u) return u.replace("http://", "https://");
    throw new Error("no url");
  } catch (e) {
    if (e.message === "no url") throw e;
  }
  /* 3) Meting 兜底 */
  const r2 = await fetchTimeout("https://api.injahow.cn/meting/?type=song&id=" + id, 8000);
  if (!r2.ok) throw new Error("net");
  const arr = await r2.json();
  const u2 = Array.isArray(arr) && arr[0] && arr[0].url;
  if (u2) return String(u2).replace("http://", "https://");
  throw new Error("no url");
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
  if (musicView === "hist") return getHist();
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
  histTab.classList.toggle("active", musicView === "hist");
  histTab.textContent = musicView === "hist" ? "← 返回" : "🕐 历史";

  /* 离开历史视图时退出多选模式 */
  if (musicView !== "hist" && histSelMode) { histSelMode = false; histSel.clear(); }
  histTools.hidden = musicView !== "hist";
  histSelect.textContent = histSelMode ? (histSel.size ? `🗑 清理（${histSel.size}）` : "取消选择") : "选择";
  histSelect.classList.toggle("danger", histSelMode && histSel.size > 0);
  musicGrid.classList.toggle("selecting", musicView === "hist" && histSelMode);

  dailyRefresh.hidden = musicView !== "home";
  if (musicView !== "home") loadHint.hidden = true; /* 离开每日推荐页就把等待提示收掉 */
  musicPager.hidden = musicView !== "search";
  if (musicView === "home") {
    musicCaption.textContent = "🔥 今日推荐";
  } else if (musicView === "search") {
    musicCaption.textContent = `🔍 “${searchKw}” 的搜索结果`;
    const entry = searchCache[searchKw] && searchCache[searchKw][searchPage];
    pagePrev.disabled = searchPage <= 1;
    pageNext.disabled = !(entry && entry.more); /* 服务端还有下一页才可点 */
    pageInfo.textContent = `第 ${searchPage} 页`;
  } else if (musicView === "hist") {
    musicCaption.textContent = "🕐 历史记录";
  } else {
    musicCaption.textContent = "❤️ 我的收藏";
  }

  const list = currentList();
  if (musicView === "fav" && !list.length) {
    const total = getFavs().length;
    musicStatus.textContent = (favChecked && total)
      ? "收藏里的无版权歌曲已自动隐藏～"
      : "还没有收藏，搜索一首喜欢的歌吧～";
  } else if (musicView === "hist" && !list.length) {
    musicStatus.textContent = "还没有播放记录，去听首歌吧～";
  } else if (musicView === "home" && !list.length) musicStatus.textContent = "今日推荐生成中…";
  else musicStatus.textContent = "";
  musicGrid.innerHTML = list.map(trackCard).join("");
  /* 多选模式下恢复选中标记 */
  if (musicView === "hist" && histSelMode) {
    musicGrid.querySelectorAll(".music-card").forEach((card) => {
      if (histSel.has(Number(card.dataset.id))) card.classList.add("hist-sel");
    });
  }
}

/* ---- 每日推荐：网易云爆火榜单 ---- */
/* 取整张榜单曲目（匿名 playlist 接口，字段为旧格式 artists/album，自带封面），内存缓存 */
async function fetchChart(pid) {
  if (chartCache[pid]) return chartCache[pid];
  let list = null;
  try {
    const data = await neteaseGet("/playlist/detail?id=" + pid);
    const p = data.playlist || data.result || {};
    list = (p.tracks || []).map((s) => ({
      id: s.id,
      name: s.name,
      artist: ((s.ar || s.artists) || []).map((a) => a.name).join(" / "),
      album: (s.al && s.al.name) || (s.album && s.album.name) || "",
      art: artOf(s.al || s.album),
    }));
  } catch (e) { /* 代理全挂 → Meting 直连兜底 */ }
  if (!list || !list.length) {
    /* Meting 免代理直连：从每首歌的播放地址里提取歌曲 id */
    const r = await fetchTimeout("https://api.injahow.cn/meting/?type=playlist&id=" + pid, 9000);
    if (!r.ok) throw new Error("meting " + r.status);
    const arr = await r.json();
    list = (Array.isArray(arr) ? arr : []).map((s) => {
      const m = /[?&]id=(\d+)/.exec(s.url || "");
      return {
        id: m ? +m[1] : 0,
        name: s.name || "未知歌曲",
        artist: String(s.artist || ""),
        album: "",
        art: String(s.pic || "").replace("http://", "https://"),
      };
    }).filter((t) => t.id);
  }
  if (!list.length) throw new Error("榜单为空");
  chartCache[pid] = list;
  return list;
}

/* 后台预取：当前批还在看/听时，提前把下一批和下下一批拉好并过滤好（换页时秒出更顺滑） */
const dailyPrefetch = {};          /* offset → 已过滤好的列表；null = 已排队/进行中 */
let prefetchChain = Promise.resolve(); /* 预取串行执行，避免抢占正在播放歌曲的带宽 */
function schedulePrefetch(offset) {
  const total = Math.ceil(dailyChartLen / PAGE_SIZE) * PAGE_SIZE;
  if (!total) return;
  for (let k = 1; k <= 2; k++) {
    const off = (offset + k * PAGE_SIZE) % total; /* 与「换一批」相同的循环取模 */
    if (dailyPrefetch[off] !== undefined) continue; /* 已排队或已就绪 */
    dailyPrefetch[off] = null;
    prefetchChain = prefetchChain.then(async () => {
      try {
        const chart = await fetchChart(dailyChart.id);
        dailyChartLen = chart.length;
        const raw = chart.slice(off, off + PAGE_SIZE);
        if (!raw.length) { delete dailyPrefetch[off]; return; } /* 越界空批，标记失效 */
        const r = await filterPlayable(raw);
        dailyPrefetch[off] = r.list; /* 完成；空列表也存，连播跳批逻辑会处理 */
      } catch (e) { delete dailyPrefetch[off]; /* 失败允许下次重试 */ }
    });
  }
}

async function loadDaily(offset) {
  dailyOffset = offset;
  const instant = Array.isArray(dailyPrefetch[offset]); /* 预取已就绪：免加载秒出 */
  if (musicView === "home" && !instant) { /* 自动连播时用户可能切到别的页面，别污染那边的状态栏 */
    musicStatus.textContent = `正在获取网易云${dailyChart.name}…`;
    musicGrid.innerHTML = "";
  }
  try {
    const chart = await fetchChart(dailyChart.id);
    dailyChartLen = chart.length;
    const raw = chart.slice(offset, offset + PAGE_SIZE);
    let r;
    if (instant) {
      r = { list: dailyPrefetch[offset], checked: true }; /* 预取结果本身就是过滤过的 */
    } else {
      /* 榜单片段一到就先显示（已带封面），版权过滤在后台继续 */
      dailyList = raw;
      if (musicView === "home") { renderMusic(); loadHint.hidden = true; /* 新音乐已出来，收掉等待提示 */ musicStatus.textContent = "正在过滤无版权歌曲…"; }
      r = await filterPlayable(raw);
    }
    dailyList = r.list;
    if (musicView === "home") {
      renderMusic();
      loadHint.hidden = true;
      if (!r.list.length) musicStatus.textContent = "这一批没有可播放的歌曲，点「换一批」试试吧～";
    }
    if (r.checked) { /* 只有确认过滤过的列表才值得缓存（v=缓存格式版本） */
      try {
        localStorage.setItem(DAILY_CACHE_KEY, JSON.stringify({ v: 4, day: dayKey(), off: offset, list: dailyList }));
      } catch (e) { /* 忽略存储失败 */ }
    }
    schedulePrefetch(offset); /* 本批就位后，后台预取下一批和下下一批 */
    return true;
  } catch (e) {
    /* 失败时恢复旧列表显示（否则网格空白），并提示 */
    if (musicView === "home") {
      renderMusic();
      loadHint.hidden = true; /* 等待已结束（没等到新歌），收掉提示换失败文案 */
      musicStatus.textContent = "推荐获取失败，点「换一批」再试试～";
    }
    return false;
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
    /* 后台预取下一页：翻页时秒开 */
    if (res.more && !searchCache[searchKw][page + 1]) {
      fetchTracks(searchKw, page * PAGE_SIZE).then((r2) => {
        searchCache[searchKw][page + 1] = { list: r2.list, more: r2.more };
        if (musicView === "search" && searchPage === page) renderMusic(); /* 让"下一页"按钮状态就绪 */
      }).catch(() => { /* 预取失败无所谓，真翻页时会重新拉 */ });
    }
    if (res.checked && res.list.length) saveSearchDisk(searchKw, page, res); /* 存到本地，断网也有 */
  } catch (e) {
    /* 网络失败 → 用之前搜过的本地结果兜底 */
    const hit = loadSearchDisk()[searchKw + "\u0001" + page];
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
  /* 详情页开着时切歌：同步封面/歌名/歌词 */
  if (!npMask.hidden && npArt.dataset.tid !== String(t.id)) { npLines = []; npFillTrack(t); }
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
/* 双击（快速两次轻点、位移很小）悬浮窗空白处 → 打开播放详情页 */
let lastTapT = 0, lastTapXY = null;
function endDrag(e) {
  if (!dragState) return;
  dragState = null;
  const now = Date.now();
  const near = lastTapXY && e &&
    Math.abs(e.clientX - lastTapXY.x) < 26 && Math.abs(e.clientY - lastTapXY.y) < 26;
  if (now - lastTapT < 420 && near) {
    lastTapT = 0; lastTapXY = null;
    if (!npMask.hidden) closeNowPlaying(); else openNowPlaying();
  } else {
    lastTapT = now; lastTapXY = e ? { x: e.clientX, y: e.clientY } : null;
  }
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
  npToggle.textContent = plToggle.textContent; /* 详情页播放键同步 */
  document.querySelectorAll(".music-card").forEach((card) => {
    const on = cur && String(cur.id) === card.dataset.id && !musicAudio.paused;
    card.classList.toggle("playing", on);
    card.querySelector(".music-play").textContent = on ? "⏸" : "▶";
  });
}

async function playTrack(list, idx) {
  if (!list.length) return;
  queue = list;
  queueIsDaily = (list === dailyList); /* 每日推荐的队列：整批播完后自动换下一批 */
  queueIdx = (idx + list.length) % list.length;
  const seq = ++playSeq;
  const t = queue[queueIdx];
  showPlayer(t);
  refreshPlaying();
  musicAudio.pause();
  try {
    /* 网络失败自动重试一次；版权问题不重试 */
    let url = null, lastErr = null;
    for (let a = 0; a < 2; a++) {
      try { url = await resolveUrl(t.id); break; }
      catch (e) {
        lastErr = e;
        if (e.message === "no url") break;
        if (a === 0) await new Promise((r) => setTimeout(r, 900));
      }
    }
    if (seq !== playSeq) return;
    if (!url) throw lastErr || new Error("net");
    musicAudio.src = url;
    plArtist.textContent = t.artist;
    await musicAudio.play();
    pushHist(t);                       /* 记入播放历史（真实开播才算） */
    if (musicView === "hist") renderMusic(); /* 历史页开着时同步刷新排序 */
  } catch (e) {
    if (seq !== playSeq) return;
    plArtist.textContent = e.message === "no url"
      ? "这首歌暂时无法播放（版权限制），换一首试试吧～"
      : "网络开小差了，再点一次试试～";
  }
  refreshPlaying();
}

function playNext() {
  if (!queue.length) return;
  if (queueIdx + 1 < queue.length) { playTrack(queue, queueIdx + 1); return; }
  /* 整批播完 */
  if (queueIsDaily) { playNextDailyBatch(); return; } /* 每日推荐：自动换下一页继续播 */
  playTrack(queue, 0); /* 其他列表：循环回第一首 */
}
function playPrev() { if (queue.length) playTrack(queue, queueIdx - 1); }

/* 每日推荐：一批播完自动换下一批；若下一批过滤后没有能播的歌，最多连续跳 4 批 */
let dailyAutoTries = 0;
async function playNextDailyBatch() {
  if (dailyAutoTries >= 4) {
    dailyAutoTries = 0;
    if (musicView === "home") musicStatus.textContent = "后面几批暂时没有能播的歌，点「换一批」试试吧～";
    return;
  }
  const nextOff = (dailyOffset + PAGE_SIZE) % (Math.ceil(dailyChartLen / PAGE_SIZE) * PAGE_SIZE);
  if (musicView === "home") musicStatus.textContent = "本批播完，自动换下一批…";
  const ok = await loadDaily(nextOff);
  if (!ok) { /* 网络失败：连播暂停，提示手动继续 */
    if (musicView === "home") musicStatus.textContent = "网络开小差了，连播暂停，点「换一批」继续～";
    return;
  }
  if (dailyList.length) {
    dailyAutoTries = 0;
    playTrack(dailyList, 0);
  } else {
    dailyAutoTries++;
    playNextDailyBatch();
  }
}

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

/* ---- 播放中网络波动自愈：音频出错（地址过期/断网）时重新解析并从原进度继续，最多 3 次 ---- */
let audioRecover = 0;
musicAudio.addEventListener("playing", () => { audioRecover = 0; });
musicAudio.addEventListener("error", async () => {
  const cur = queue[queueIdx];
  if (!cur || audioRecover >= 3) return;   /* 无歌在播/重试次数用尽 */
  audioRecover++;
  const at = musicAudio.currentTime || 0;
  plArtist.textContent = "网络波动，正在重连…";
  try {
    const url = await resolveUrl(cur.id);
    if (queue[queueIdx] !== cur) return;   /* 用户已切歌 */
    musicAudio.src = url;
    musicAudio.addEventListener("loadedmetadata", () => {
      try { musicAudio.currentTime = at; } catch (e) { /* 进度恢复失败就算了 */ }
    }, { once: true });
    await musicAudio.play();
  } catch (e) {
    if (queue[queueIdx] === cur && musicAudio.error) {
      plArtist.textContent = "网络不稳定，点播放键再试一次～";
    }
  }
});
musicAudio.addEventListener("loadedmetadata", () => {
  plDur.textContent = fmt(musicAudio.duration);
  plSeek.max = Math.floor(musicAudio.duration) || 30;
  npDur.textContent = plDur.textContent;       /* 详情页时长同步 */
  npSeek.max = plSeek.max;
});
musicAudio.addEventListener("timeupdate", () => {
  plCur.textContent = fmt(musicAudio.currentTime);
  plSeek.value = Math.floor(musicAudio.currentTime);
  if (!npMask.hidden) { npSyncTime(); npFollowLyric(); } /* 详情页开着：同步进度与歌词高亮 */
});
plSeek.addEventListener("input", () => {
  if (isFinite(musicAudio.duration)) musicAudio.currentTime = +plSeek.value;
});

/* ---- 播放详情页：双击悬浮窗空白处打开（左封面 / 右歌名+滚动歌词 / 进度条 / 控制键 / 音量） ---- */
const npLrcCache = {};   /* 歌曲id → 已解析歌词 [{t,text}]；null = 确认无歌词 */
let npLines = [];        /* 详情页当前展示的歌词行 */
let npLrcIdx = -1;       /* 当前高亮行 */
let npUserScroll = 0;    /* 用户手动滚动的时刻；3 秒内暂停自动跟随 */
let npLrcReq = 0;        /* 歌词请求序号，防止慢响应串台 */

function npSyncTime() {
  npCur.textContent = fmt(musicAudio.currentTime || 0);
  npDur.textContent = fmt(musicAudio.duration || 0);
  if (isFinite(musicAudio.duration) && musicAudio.duration > 0) {
    npSeek.max = Math.floor(musicAudio.duration);
    if (document.activeElement !== npSeek) npSeek.value = Math.floor(musicAudio.currentTime || 0);
  }
}

function parseLrc(text) {
  const out = [];
  for (const line of String(text).split("\n")) {
    const times = [...line.matchAll(/\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g)];
    if (!times.length) continue;
    const words = line.replace(/\[[^\]]*\]/g, "").trim();
    if (!words) continue;
    for (const m of times) {
      out.push({ t: (+m[1]) * 60 + (+m[2]) + (m[3] ? +("0." + m[3]) : 0), text: words });
    }
  }
  out.sort((a, b) => a.t - b.t);
  return out;
}

/* 歌词主通道：网易云代理；兜底：Meting 直连 LRC 文本 */
async function fetchLyrics(id) {
  try {
    const data = await neteaseGet("/song/lyric?id=" + id + "&lv=1&tv=-1");
    const raw = data && data.lrc && data.lrc.lyric;
    if (raw && raw.trim()) {
      const lines = parseLrc(raw);
      if (lines.length) return lines;
    }
  } catch (e) { /* 代理全挂 → Meting 兜底 */ }
  const r = await fetchTimeout("https://api.injahow.cn/meting/?type=lrc&id=" + id, 9000);
  if (!r.ok) throw new Error("lrc " + r.status);
  const lines = parseLrc(await r.text());
  if (!lines.length) throw new Error("empty lrc");
  return lines;
}

function renderLyrics(lines) {
  npLyrics.innerHTML = lines.length
    ? lines.map((l, i) => `<p data-i="${i}">${esc(l.text)}</p>`).join("")
    : '<p class="np-hint">这首是纯音乐，没有歌词哦～</p>';
  npLrcIdx = -1;
  npLyrics.scrollTop = 0;
}

async function loadLyricsInto(id) {
  const seq = ++npLrcReq;
  npLines = []; npLrcIdx = -1;
  npLyrics.innerHTML = '<p class="np-hint">歌词加载中…</p>';
  if (npLrcCache[id] !== undefined) {          /* 取过（含确认无歌词），直接用 */
    npLines = npLrcCache[id] || [];
    renderLyrics(npLines);
    npFollowLyric();
    return;
  }
  try {
    const lines = await fetchLyrics(id);
    if (seq !== npLrcReq) return;              /* 已切到别的歌 */
    npLrcCache[id] = lines;
    npLines = lines;
    renderLyrics(lines);
    npFollowLyric();
  } catch (e) {
    if (seq !== npLrcReq) return;
    npLrcCache[id] = null;
    npLines = [];
    npLyrics.innerHTML = '<p class="np-hint">暂时拿不到这首歌词～</p>';
  }
}

/* 高亮当前句并滚动到歌词区中间（用户手动滚动后 3 秒内不抢滚动条） */
function npFollowLyric() {
  if (npMask.hidden || !npLines.length) return;
  const t = musicAudio.currentTime || 0;
  let idx = -1;
  for (let i = 0; i < npLines.length; i++) { if (npLines[i].t <= t + 0.25) idx = i; else break; }
  if (idx === npLrcIdx) return;
  npLrcIdx = idx;
  const ps = npLyrics.querySelectorAll("p[data-i]");
  ps.forEach((p) => p.classList.toggle("on", +p.dataset.i === idx));
  if (idx >= 0 && ps[idx] && Date.now() - npUserScroll > 3000) {
    const el = ps[idx];
    npLyrics.scrollTo({ top: el.offsetTop - npLyrics.clientHeight / 2 + el.clientHeight / 2, behavior: "smooth" });
  }
}

function npFillTrack(t) {
  npArt.dataset.tid = String(t.id);
  if (t.art) { npArt.dataset.fb = ""; npArt.style.visibility = "visible"; npArt.src = t.art; }
  else npArt.style.visibility = "hidden";
  npName.textContent = t.name;
  npName.title = t.name;
  npArtist.textContent = t.artist || "";
  loadLyricsInto(t.id);
}

function openNowPlaying() {
  const t = queue[queueIdx];
  if (!t) return;                              /* 还没播过歌，不打开 */
  npMask.hidden = false;
  npSyncTime();
  if (npArt.dataset.tid !== String(t.id)) { npLines = []; npFillTrack(t); }
  else npFollowLyric();
}
function closeNowPlaying() { npMask.hidden = true; npVolPop.hidden = true; }

npClose.addEventListener("click", closeNowPlaying);
npPrev.addEventListener("click", playPrev);
npNext.addEventListener("click", playNext);
npToggle.addEventListener("click", () => {
  if (!queue.length) return;
  if (musicAudio.paused) musicAudio.play().catch(() => {});
  else musicAudio.pause();
  refreshPlaying();
});
npSeek.addEventListener("input", () => {
  if (isFinite(musicAudio.duration)) musicAudio.currentTime = +npSeek.value;
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !npMask.hidden) closeNowPlaying(); });

/* 点歌词任意句 → 跳到那句开始播 */
npLyrics.addEventListener("click", (e) => {
  const p = e.target.closest("p[data-i]");
  if (!p || !npLines.length) return;
  const line = npLines[+p.dataset.i];
  if (line && isFinite(musicAudio.duration)) {
    musicAudio.currentTime = Math.max(0, line.t - 0.2);
    npFollowLyric();
  }
});

/* 用户手动滚动歌词 → 暂时关掉自动跟随 */
["wheel", "touchmove"].forEach((ev) =>
  npLyrics.addEventListener(ev, () => { npUserScroll = Date.now(); }, { passive: true }));

/* 音量：点键弹出滑条，拖动调整并记忆；音量 0 时显示静音图标 */
function applyVolume(v) {
  musicAudio.volume = Math.max(0, Math.min(1, v));
  npVolBar.value = Math.round(musicAudio.volume * 100);
  npVol.textContent = musicAudio.volume > 0 ? "🔊" : "🔇";
  try { localStorage.setItem("hjy_volume", String(musicAudio.volume)); } catch (e) { /* 忽略 */ }
}
try {
  const sv = parseFloat(localStorage.getItem("hjy_volume"));
  if (isFinite(sv)) musicAudio.volume = Math.max(0, Math.min(1, sv));
} catch (e) { /* 默认 1 */ }
npVolBar.value = Math.round(musicAudio.volume * 100);
npVol.textContent = musicAudio.volume > 0 ? "🔊" : "🔇";
/* 音量键交互：单击弹出/收起竖向音量条；双击=静音切换（记住静音前的音量） */
let volTapT = 0, volMuteBefore = 0.8, volTapTimer = 0;
npVol.addEventListener("pointerup", (e) => {
  e.stopPropagation();
  const now = Date.now();
  if (now - volTapT < 280) {                 /* 双击 → 静音 / 取消静音 */
    volTapT = 0;
    clearTimeout(volTapTimer);
    if (musicAudio.volume > 0) { volMuteBefore = musicAudio.volume; applyVolume(0); }
    else applyVolume(volMuteBefore || 0.8);
    return;
  }
  volTapT = now;
  volTapTimer = setTimeout(() => { npVolPop.hidden = !npVolPop.hidden; }, 290); /* 单击 → 竖条 */
});
npVolBar.addEventListener("input", () => applyVolume(+npVolBar.value / 100));
document.addEventListener("click", (e) => {
  if (npVolPop.hidden) return;
  if (!e.target.closest(".np-volwrap")) npVolPop.hidden = true;  /* 点外面收起 */
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

/* ---- 通用确认弹窗（替代浏览器原生 confirm，样式与站点统一，有「确定」「取消」两个按钮） ---- */
let askCb = null;
function askConfirm(text, onOk) {
  askText.textContent = text;
  askCb = onOk || null;
  askMask.hidden = false;
}
function closeAsk() { askMask.hidden = true; askCb = null; }
askOk.addEventListener("click", () => { const cb = askCb; closeAsk(); if (cb) cb(); });
askCancel.addEventListener("click", closeAsk);
askMask.addEventListener("click", (e) => { if (e.target === askMask) closeAsk(); }); /* 点遮罩=取消 */

/* ---- 历史记录：进入/退出、多选删除、清空 ---- */
histTab.addEventListener("click", () => {
  if (musicView === "hist") {
    musicView = lastView || "home";
  } else {
    lastView = musicView;
    musicView = "hist";
  }
  renderMusic();
});

histSelect.addEventListener("click", () => {
  if (!histSelMode) {            /* 进入多选模式 */
    histSelMode = true;
    histSel.clear();
    renderMusic();
    return;
  }
  if (histSel.size) {            /* 清理选中的歌曲：先弹确认（确定/取消） */
    const ids = [...histSel];
    askConfirm(`是否清理所选的 ${ids.length} 首歌曲？`, () => {
      setHist(getHist().filter((t) => !ids.includes(t.id)));
      histSelMode = false;
      histSel.clear();
      renderMusic();
    });
    return;
  }
  histSelMode = false;           /* 没有选中 → 退出多选模式 */
  histSel.clear();
  renderMusic();
});

histClear.addEventListener("click", () => {
  if (!getHist().length) return;
  askConfirm("是否清空历史记录？", () => {
    setHist([]);
    histSelMode = false;
    histSel.clear();
    renderMusic();
  });
});

/* ---- 搜索控件 ---- */
musicSearchBtn.addEventListener("click", searchMusic);
musicInput.addEventListener("keydown", (e) => { if (e.key === "Enter") searchMusic(); });

/* ---- 翻页 / 换一批 ---- */
pagePrev.addEventListener("click", () => { if (searchPage > 1) gotoSearchPage(searchPage - 1); });
pageNext.addEventListener("click", () => gotoSearchPage(searchPage + 1));
dailyRefresh.addEventListener("click", () => {
  /* 在当前榜单总曲数内循环分批 */
  loadHint.hidden = false; /* 换一批需要等网络，先亮出等待提示，新音乐出来后再收掉 */
  loadDaily((dailyOffset + PAGE_SIZE) % (Math.ceil(dailyChartLen / PAGE_SIZE) * PAGE_SIZE));
});

/* ---- 卡片按钮：播放 / 收藏（事件委托） ---- */
musicGrid.addEventListener("click", (e) => {
  /* 历史记录多选模式：点卡片本身切换选中态 */
  if (musicView === "hist" && histSelMode) {
    const selCard = e.target.closest(".music-card");
    if (!selCard) return;
    const sid = Number(selCard.dataset.id);
    if (histSel.has(sid)) { histSel.delete(sid); selCard.classList.remove("hist-sel"); }
    else { histSel.add(sid); selCard.classList.add("hist-sel"); }
    histSelect.textContent = histSel.size ? `🗑 清理（${histSel.size}）` : "取消选择";
    histSelect.classList.toggle("danger", histSel.size > 0);
    return;
  }
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

/* ---- 初始化：按日期轮换一个爆火榜单，每天不同；今天已拉取过则直接用本地缓存 ---- */
function dayKey() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  return now.getFullYear() * 366 + Math.floor((now - start) / 86400000);
}
(function initDaily() {
  dailyChart = DAILY_CHARTS[dayKey() % DAILY_CHARTS.length];
  try {
    const c = JSON.parse(localStorage.getItem(DAILY_CACHE_KEY));
    if (c && c.v === 4 && c.day === dayKey() && Array.isArray(c.list) && c.list.length) {
      dailyList = c.list;
      dailyOffset = c.off || 0;
      renderMusic();
      schedulePrefetch(dailyOffset); /* 首屏就用缓存：后台预取下一批和下下一批 */
      return; /* 命中今日缓存，不再请求网络 */
    }
  } catch (e) { /* 缓存坏了就走网络 */ }
  loadDaily(0);
})();
