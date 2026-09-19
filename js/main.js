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
