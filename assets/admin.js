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
        <span><button class="btn ip-toggle" data-ip="${x.ip || ""}" title="点击切换为IP">定位中...</button> · ${formatTime(x.ts)} · ❤️ <input class="like-input" type="number" min="0" value="${x.likes}" style="width:80px" /> <button class="btn save-like" data-id="${x.id}">保存点赞</button></span>
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
  // resolve locations
  const btns = els(".ip-toggle");
  for (const b of btns) {
    const ip = b.dataset.ip || "";
    if (!ip) {
      b.textContent = "-";
      b.disabled = true;
      continue;
    }
    try {
      const j = await fetchJSON(`/api/admin/geo?ip=${encodeURIComponent(ip)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      b.textContent = j?.location || ip;
    } catch {
      b.textContent = ip;
    }
  }
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
      await load();
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
    const ipBtn = ev.target.closest(".ip-toggle");
    if (ipBtn) {
      const ip = ipBtn.dataset.ip || "";
      const showingIp = ipBtn.textContent === ip;
      if (showingIp) {
        try {
          const j = await fetchJSON(`/api/admin/geo?ip=${encodeURIComponent(ip)}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          ipBtn.textContent = j?.location || ip;
        } catch {
          ipBtn.textContent = ip;
        }
      } else {
        ipBtn.textContent = ip;
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
        await load();
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
