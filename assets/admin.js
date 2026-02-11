const el = (s) => document.querySelector(s);
const els = (s) => Array.from(document.querySelectorAll(s));
let token = "";
let adminPages = [];
let adminCursors = [];
let adminPageIndex = 0;
const adminPageSize = 10;
let adminTotalCount = 0;
let adminTotalPages = 0;
let adminD1Bound = false;

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

async function loadSettings() {
  const s = await fetchJSON("/api/admin/settings", {
    headers: { Authorization: `Bearer ${token}` }
  });
  el("#allowUpload").checked = !!s?.allow_upload;
  el("#filterEnable").checked = !!s?.filter_enabled;
  const sel = el("#seSelect");
  const users = Array.isArray(s?.sightengine_users) ? s.sightengine_users : [];
  sel.innerHTML = users.length
    ? users.map((u, i) => `<option value="${i}">${u}</option>`).join("")
    : `<option value="0">未配置</option>`;
  const idx = Number(s?.sightengine_index || 0);
  sel.value = String(Math.min(Math.max(0, idx), Math.max(0, users.length - 1)));
}

function render(items) {
  el("#adminList").innerHTML = items.map(x => `
    <div class="item" data-id="${x.id}">
      <img src="/api/i/${x.id}?w=480&q=75" alt="image">
      <div class="meta">
        <span><button class="ip-copy" data-ip="${x.ip || ""}" title="点击复制">${x.ip || "-"}</button> · ${formatTime(x.ts)} · ❤️ <input class="like-input" type="number" min="0" value="${x.likes}" style="width:80px" /> <button class="btn primary save-like" data-id="${x.id}">保存点赞</button></span>
        <div class="actions">
          <a class="download" href="/api/i/${x.id}" download="img-${x.id}.jpg">下载</a>
          <button class="btn danger" data-id="${x.id}">删除</button>
        </div>
      </div>
    </div>
  `).join("");
}

async function fetchAdminPage(cursorToken = "") {
  const u = new URL("/api/admin/images", window.location.origin);
  u.searchParams.set("limit", String(adminPageSize));
  if (cursorToken) u.searchParams.set("cursor", cursorToken);
  const res = await fetch(u.pathname + u.search, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(await res.text().catch(() => "请求失败"));
  const items = await res.json();
  const nc = res.headers.get("X-Next-Cursor") || "";
  return { items, nextCursor: nc };
}

async function resetAdminPagination() {
  adminPages = [];
  adminCursors = [];
  adminPageIndex = 0;
  const { items, nextCursor } = await fetchAdminPage("");
  adminPages.push(items);
  adminCursors.push(nextCursor);
  render(items);
  updateAdminPagerUI();
}

function updateAdminPagerUI() {
  const info = el("#adminPageInfo");
  if (info) info.textContent = `第 ${adminPageIndex + 1} 页`;
  const infoB = el("#adminPageInfoBottom");
  if (infoB) infoB.textContent = `第 ${adminPageIndex + 1} 页`;
  const prev = el("#adminPrev");
  const next = el("#adminNext");
  if (prev) prev.disabled = adminPageIndex <= 0;
  const hasNext = adminTotalPages > 0 ? (adminPageIndex + 1 < adminTotalPages) : !!adminCursors[adminPageIndex];
  if (next) next.disabled = !hasNext;
  const prevB = el("#adminPrevBottom");
  const nextB = el("#adminNextBottom");
  if (prevB) prevB.disabled = adminPageIndex <= 0;
  if (nextB) nextB.disabled = !hasNext;
  const pn = el("#adminPageNumbers");
  if (pn) {
    let html = "";
    if (adminTotalPages > 0) {
      for (let i = 0; i < adminTotalPages; i++) {
        html += `<button class="page-num${i === adminPageIndex ? " active" : ""}" data-idx="${i}">${i + 1}</button>`;
      }
    } else {
      html = adminPages.map((_, i) => `<button class="page-num${i === adminPageIndex ? " active" : ""}" data-idx="${i}">${i + 1}</button>`).join("");
      if (hasNext) {
        const nextNum = adminPages.length + 1;
        html += `<button class="page-num" data-idx="${adminPages.length}">${nextNum}</button>`;
      }
    }
    pn.innerHTML = html;
  }
  const pnB = el("#adminPageNumbersBottom");
  if (pnB) {
    pnB.innerHTML = (el("#adminPageNumbers")?.innerHTML) || "";
  }
}

async function adminNextPage() {
  const hasNext = adminTotalPages > 0 ? (adminPageIndex + 1 < adminTotalPages) : !!adminCursors[adminPageIndex];
  if (!hasNext) return;
  if (adminPages[adminPageIndex + 1]) {
    adminPageIndex += 1;
    render(adminPages[adminPageIndex]);
    updateAdminPagerUI();
    return;
  }
  if (adminD1Bound && adminTotalPages > 0) {
    const offsetToken = `d1:${(adminPageIndex + 1) * adminPageSize}`;
    const { items, nextCursor } = await fetchAdminPage(offsetToken);
    adminPages[adminPageIndex + 1] = items;
    adminCursors[adminPageIndex + 1] = nextCursor;
    adminPageIndex += 1;
    render(items);
    updateAdminPagerUI();
    return;
  }
  const tokenNext = adminCursors[adminPageIndex];
  if (!tokenNext) return;
  const { items, nextCursor } = await fetchAdminPage(tokenNext);
  adminPages.push(items);
  adminCursors.push(nextCursor);
  adminPageIndex += 1;
  render(items);
  updateAdminPagerUI();
}

function adminPrevPage() {
  if (adminPageIndex <= 0) return;
  adminPageIndex -= 1;
  render(adminPages[adminPageIndex] || []);
  updateAdminPagerUI();
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
      await loadSettings();
      await resetAdminPagination();
      el("#loginStatus").textContent = "";
      try { localStorage.setItem("admin_token", token); } catch {}
      const box = document.querySelector(".login");
      if (box) box.classList.add("hidden");
      el("#adminPanel").classList.remove("hidden");
    } catch (e) {
      const msg = String(e?.message || "");
      el("#loginStatus").textContent = msg.includes("unauthorized") || msg.includes("401")
        ? "密码错误"
        : "服务不可用";
      token = "";
    }
  });
  el("#allowUpload").addEventListener("input", async (ev) => {
    const checked = ev.target.checked;
    const st = el("#settingsStatus");
    st.textContent = "保存中...";
    try {
      await fetchJSON("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ op: "toggle_upload", allow_upload: checked })
      });
      st.textContent = "已保存";
    } catch {
      st.textContent = "保存失败";
      ev.target.checked = !checked;
    } finally {
      setTimeout(() => st.textContent = "", 2000);
    }
  });
  el("#filterEnable").addEventListener("input", async (ev) => {
    const checked = ev.target.checked;
    const st = el("#settingsStatus");
    st.textContent = "保存中...";
    try {
      await fetchJSON("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ op: "toggle_filter", filter_enabled: checked })
      });
      st.textContent = "已保存";
    } catch {
      st.textContent = "保存失败";
      ev.target.checked = !checked;
    } finally {
      setTimeout(() => st.textContent = "", 2000);
    }
  });
  el("#seSelect").addEventListener("change", async (ev) => {
    const idx = parseInt(ev.target.value, 10);
    const st = el("#settingsStatus");
    st.textContent = "保存中...";
    try {
      await fetchJSON("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ op: "set_sightengine_index", index: idx })
      });
      st.textContent = "已保存";
    } catch {
      st.textContent = "保存失败";
    } finally {
      setTimeout(() => st.textContent = "", 2000);
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
    const ipBtn = ev.target.closest(".ip-copy");
    if (ipBtn) {
      const ip = ipBtn.dataset.ip || "";
      if (!ip) return;
      const text = ipBtn.textContent;
      ipBtn.disabled = true;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(ip);
        } else {
          const ta = document.createElement("textarea");
          ta.value = ip;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          document.body.removeChild(ta);
        }
        ipBtn.textContent = "已复制";
        setTimeout(() => { ipBtn.textContent = text; }, 1200);
      } finally {
        ipBtn.disabled = false;
      }
      return;
    }
    const btn = ev.target.closest("button[data-id]");
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.classList.contains("save-like")) {
      const card = btn.closest(".item");
      const input = card?.querySelector(".like-input");
      const val = input ? Number(input.value) : 0;
      const st = el("#settingsStatus");
      btn.disabled = true;
      st.textContent = "保存中...";
      try {
        await fetchJSON("/api/admin/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ op: "set_likes", id, likes: val })
        });
        st.textContent = "已保存";
      } catch {
        st.textContent = "保存失败";
      } finally {
        btn.disabled = false;
        setTimeout(() => st.textContent = "", 2000);
      }
      return;
    }
    if (btn.classList.contains("danger")) {
      btn.disabled = true;
      try {
        await del(id);
        const card = el(`.item[data-id="${id}"]`);
        if (card) card.remove();
      } finally {
        btn.disabled = false;
      }
    }
  });
  const prevBtn = el("#adminPrev");
  const nextBtn = el("#adminNext");
  if (prevBtn) prevBtn.addEventListener("click", () => adminPrevPage());
  if (nextBtn) nextBtn.addEventListener("click", () => adminNextPage());
  const pn = el("#adminPageNumbers");
  if (pn) {
    pn.addEventListener("click", (ev) => {
      const btn = ev.target.closest(".page-num[data-idx]");
      if (!btn) return;
      const idx = parseInt(btn.dataset.idx, 10);
      if (!Number.isFinite(idx) || idx < 0) return;
      if (adminPages[idx]) {
        adminPageIndex = idx;
        render(adminPages[adminPageIndex]);
        updateAdminPagerUI();
        return;
      }
      if (adminD1Bound && adminTotalPages > 0) {
        const offsetToken = `d1:${idx * adminPageSize}`;
        (async () => {
          const { items, nextCursor } = await fetchAdminPage(offsetToken);
          adminPages[idx] = items;
          adminCursors[idx] = nextCursor;
          adminPageIndex = idx;
          render(items);
          updateAdminPagerUI();
        })();
      } else {
        adminNextPage();
      }
    });
  }
  const prevBtnB = el("#adminPrevBottom");
  const nextBtnB = el("#adminNextBottom");
  if (prevBtnB) prevBtnB.addEventListener("click", () => adminPrevPage());
  if (nextBtnB) nextBtnB.addEventListener("click", () => adminNextPage());
  const pnB = el("#adminPageNumbersBottom");
  if (pnB) {
    pnB.addEventListener("click", (ev) => {
      const btn = ev.target.closest(".page-num[data-idx]");
      if (!btn) return;
      const idx = parseInt(btn.dataset.idx, 10);
      if (!Number.isFinite(idx) || idx < 0) return;
      if (adminPages[idx]) {
        adminPageIndex = idx;
        render(adminPages[adminPageIndex]);
        updateAdminPagerUI();
        return;
      }
      if (adminD1Bound && adminTotalPages > 0) {
        const offsetToken = `d1:${idx * adminPageSize}`;
        (async () => {
          const { items, nextCursor } = await fetchAdminPage(offsetToken);
          adminPages[idx] = items;
          adminCursors[idx] = nextCursor;
          adminPageIndex = idx;
          render(items);
          updateAdminPagerUI();
        })();
      } else {
        adminNextPage();
      }
    });
  }
  el("#lightbox").addEventListener("click", () => {
    el("#lightbox").classList.add("hidden");
    el("#lightboxImg").src = "";
  });
}

function init() {
  const saved = (() => {
    try { return localStorage.getItem("admin_token") || ""; } catch { return ""; }
  })();
  if (saved) {
    token = saved;
    (async () => {
      try {
        await loadSettings();
        await resetAdminPagination();
        try {
          const e = await fetch("/api/env?test=1");
          if (e.ok) {
            const ej = await e.json();
            adminD1Bound = !!ej?.d1_bound;
          }
          const r = await fetch("/api/count");
          if (r.ok) {
            const j = await r.json();
            adminTotalCount = Number(j?.count || 0);
            adminTotalPages = adminTotalCount > 0 ? Math.ceil(adminTotalCount / adminPageSize) : 0;
            updateAdminPagerUI();
          }
        } catch {}
        el("#loginStatus").textContent = "";
        const box = document.querySelector(".login");
        if (box) box.classList.add("hidden");
        el("#adminPanel").classList.remove("hidden");
      } catch {
        try { localStorage.removeItem("admin_token"); } catch {}
        token = "";
      }
    })();
  }
  bind();
}

document.addEventListener("DOMContentLoaded", init);
