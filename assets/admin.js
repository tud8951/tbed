const el = (s) => document.querySelector(s);
const els = (s) => Array.from(document.querySelectorAll(s));
let token = "";

function formatTime(ts) {
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function fetchJSON(url, opts = {}) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(await res.text().catch(() => "请求失败"));
  return res.json();
}

function render(items) {
  el("#adminList").innerHTML = items.map(x => `
    <div class="item" data-id="${x.id}">
      <img src="/api/i/${x.id}" alt="image">
      <div class="meta">
        <span>${formatTime(x.ts)} · ❤️ ${x.likes}</span>
        <div class="actions">
          <a class="download" href="/api/i/${x.id}" download="img-${x.id}.jpg">下载</a>
          <button class="btn danger" data-id="${x.id}">删除</button>
        </div>
      </div>
    </div>
  `).join("");
}

async function load() {
  const items = await fetchJSON("/api/admin/images", {
    headers: { Authorization: `Bearer ${token}` }
  });
  render(items);
}

async function del(id) {
  await fetchJSON("/api/admin/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ id })
  });
}

function bind() {
  el("#enterBtn").addEventListener("click", async () => {
    const pwd = el("#pwd").value.trim();
    if (!pwd) {
      el("#loginStatus").textContent = "请输入密码";
      return;
    }
    token = pwd;
    el("#loginStatus").textContent = "正在验证...";
    try {
      await load();
      el("#loginStatus").textContent = "";
      el("#adminPanel").classList.remove("hidden");
    } catch (e) {
      const msg = String(e?.message || "");
      el("#loginStatus").textContent = msg.includes("unauthorized") || msg.includes("401")
        ? "密码错误"
        : "服务不可用";
      token = "";
    }
  });
  el("#adminList").addEventListener("click", async (ev) => {
    const lb = el("#lightbox");
    const lbImg = el("#lightboxImg");
    const img = ev.target.closest(".item img");
    if (img) {
      lbImg.src = img.src;
      lb.classList.remove("hidden");
      return;
    }
    const btn = ev.target.closest("button[data-id]");
    if (!btn) return;
    const id = btn.dataset.id;
    btn.disabled = true;
    try {
      await del(id);
      const card = el(`.item[data-id="${id}"]`);
      if (card) card.remove();
    } finally {
      btn.disabled = false;
    }
  });
  el("#lightbox").addEventListener("click", () => {
    el("#lightbox").classList.add("hidden");
    el("#lightboxImg").src = "";
  });
}

function init() {
  bind();
}

document.addEventListener("DOMContentLoaded", init);
