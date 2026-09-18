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

/* 年份 */
document.getElementById("year").textContent = new Date().getFullYear();

/* ============ 留言板 ============ */
const STORE_KEY = "hjy_comments_v1";
const AVATARS = ["😀", "😎", "🦊", "🐼", "🐧", "🐸", "🌟", "🚀", "🎧", "🍀"];
const input = document.getElementById("commentInput");
const submitBtn = document.getElementById("commentSubmit");
const charCount = document.getElementById("charCount");
const listEl = document.getElementById("commentList");
const emptyEl = document.getElementById("commentEmpty");

function loadComments() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; }
  catch { return []; }
}
function saveComments(list) {
  localStorage.setItem(STORE_KEY, JSON.stringify(list));
}
function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "刚刚";
  if (s < 3600) return Math.floor(s / 60) + " 分钟前";
  if (s < 86400) return Math.floor(s / 3600) + " 小时前";
  return Math.floor(s / 86400) + " 天前";
}
function esc(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;")
            .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function render() {
  const comments = loadComments()
    .sort((a, b) => b.ts - a.ts);
  if (emptyEl) emptyEl.style.display = comments.length ? "none" : "";
  listEl.querySelectorAll(".comment-item").forEach((el) => el.remove());

  comments.forEach((c) => {
    const item = document.createElement("div");
    item.className = "comment-item" + (c.blocked ? " is-blocked" : "");

    const main = c.blocked
      ? `<p class="comment-text">🚫 该留言已被你屏蔽</p>
         <p class="blocked-tip">再点一次 👎 可以取消屏蔽</p>`
      : `<p class="comment-text">${esc(c.text)}</p>`;

    item.innerHTML = `
      <div class="comment-avatar">${AVATARS[c.av % AVATARS.length]}</div>
      <div class="comment-main">
        <div class="comment-meta"><b>${esc(c.name)}</b><time>${timeAgo(c.ts)}</time></div>
        ${main}
        <div class="comment-actions">
          <button class="act like ${c.liked ? "liked" : ""}" aria-label="点赞">👍 <span>${c.likes}</span></button>
          <button class="act dislike ${c.blocked ? "blocked-on" : ""}" aria-label="屏蔽 / 取消屏蔽">👎</button>
        </div>
      </div>`;

    item.querySelector(".like").addEventListener("click", () => {
      const all = loadComments();
      const cur = all.find((x) => x.id === c.id);
      cur.liked = !cur.liked;
      cur.likes += cur.liked ? 1 : -1;
      saveComments(all);
      render();
    });
    item.querySelector(".dislike").addEventListener("click", () => {
      const all = loadComments();
      const cur = all.find((x) => x.id === c.id);
      cur.blocked = !cur.blocked;
      saveComments(all);
      render();
    });

    listEl.appendChild(item);
  });
}

input.addEventListener("input", () => {
  charCount.textContent = input.value.length + " / 200";
});

submitBtn.addEventListener("click", () => {
  const text = input.value.trim();
  if (!text) { input.focus(); return; }
  const all = loadComments();
  all.push({
    id: Date.now() + "-" + Math.random().toString(36).slice(2, 7),
    name: "访客 #" + (all.length + 1),
    av: Math.floor(Math.random() * AVATARS.length),
    text: text.slice(0, 200),
    ts: Date.now(),
    likes: 0,
    liked: false,
    blocked: false,
  });
  saveComments(all);
  input.value = "";
  charCount.textContent = "0 / 200";
  render();
});

render();
