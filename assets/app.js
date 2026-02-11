const el = (sel) => document.querySelector(sel);
const els = (sel) => Array.from(document.querySelectorAll(sel));
let selectedFile = null;
let allowUpload = true;

function formatTime(ts) {
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

let nextCursor = "";
let loadingMore = false;
const cacheBust = (() => {
  const m = (location.search || "").match(/[?&]cb=([^&]+)/);
  return m ? decodeURIComponent(m[1]) : "";
})();
const addCb = (url) => cacheBust ? url + (url.indexOf("?") >= 0 ? "&" : "?") + "cb=" + encodeURIComponent(cacheBust) : url;

async function loadImages(sort = "latest", reset = true) {
  const url = new URL(`/api/images`, window.location.origin);
  url.searchParams.set("sort", sort);
  url.searchParams.set("limit", "20");
  if (!reset && nextCursor) url.searchParams.set("cursor", nextCursor);
  const res = await fetch(url.pathname + url.search);
  if (!res.ok) {
    el("#gallery").innerHTML = `<div class="status">加载图片失败</div>`;
    return;
  }
  const items = await res.json();
  const nc = res.headers.get("X-Next-Cursor") || "";
  nextCursor = nc;
  renderGallery(items, reset);
}

function renderGallery(items, reset = true) {
  const liked = JSON.parse(localStorage.getItem("liked_ids") || "[]");
  const html = items.map(item => {
    const isLiked = liked.includes(item.id);
    return `
      <article class="card" data-id="${item.id}">
        <img class="lazy" data-src="${addCb(`/api/i/${item.id}?w=480&q=65`)}" alt="image" loading="lazy" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==">
        <div class="meta">
          <span class="time">${formatTime(item.ts)}</span>
          <div class="actions">
            <a class="download" href="${addCb(`/api/i/${item.id}`)}" download="img-${item.id}.jpg">下载</a>
            <button class="like ${isLiked ? "liked" : ""}" data-id="${item.id}">❤️ <span class="count">${item.likes}</span></button>
          </div>
        </div>
      </article>`;
  }).join("");
  if (reset) {
    el("#gallery").innerHTML = html;
  } else {
    el("#gallery").insertAdjacentHTML("beforeend", html);
  }
  lazyLoadImages();
}

function setActiveTab(sort) {
  els(".tab-btn").forEach(b => b.classList.toggle("active", b.dataset.sort === sort));
}

async function like(id, btn) {
  const liked = new Set(JSON.parse(localStorage.getItem("liked_ids") || "[]"));
  if (liked.has(id)) return;
  btn.disabled = true;
  try {
    const res = await fetch("/api/like", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id })
    });
    if (res.ok) {
      const data = await res.json();
      btn.querySelector(".count").textContent = String(data.likes);
      btn.classList.add("liked");
      liked.add(id);
      localStorage.setItem("liked_ids", JSON.stringify([...liked]));
    }
  } finally {
    btn.disabled = false;
  }
}

function bindEvents() {
  els(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const sort = btn.dataset.sort;
      setActiveTab(sort);
      nextCursor = "";
      loadImages(sort, true);
    });
  });
  const lb = el("#lightbox");
  const lbImg = el("#lightboxImg");
  el("#gallery").addEventListener("click", (ev) => {
    const img = ev.target.closest(".card img");
    if (img) {
      const id = img.closest(".card")?.dataset.id;
      lbImg.src = id ? addCb(`/api/i/${id}`) : img.src;
      lb.classList.remove("hidden");
      return;
    }
    const btn = ev.target.closest(".like");
    if (btn) {
      const id = btn.dataset.id;
      like(id, btn);
    }
  });
  lb.addEventListener("click", () => {
    lb.classList.add("hidden");
    lbImg.src = "";
  });
  const dz = el("#dropzone");
  const chooseBtn = el("#chooseBtn");
  const input = el("#fileInput");
  const preview = el("#preview");
  const previewImg = el("#previewImg");
  const previewName = el("#previewName");
  const previewSize = el("#previewSize");
  const status = el("#uploadStatus");
  const applyUploadEnabled = (enabled) => {
    allowUpload = !!enabled;
    chooseBtn.disabled = !enabled;
    el("#uploadBtn").disabled = !enabled;
    dz.style.pointerEvents = enabled ? "auto" : "none";
    if (!enabled) {
      status.textContent = "上传已关闭";
    } else {
      if (status.textContent === "上传已关闭") status.textContent = "";
    }
  };
  (async () => {
    try {
      const r = await fetch("/api/settings");
      if (r.ok) {
        const s = await r.json();
        applyUploadEnabled(!!s?.allow_upload);
      }
    } catch {}
  })();
  const sentinel = el("#sentinel");
  const io = new IntersectionObserver(async (entries) => {
    const active = document.querySelector(".tab-btn.active")?.dataset.sort || "hot";
    for (const entry of entries) {
      if (entry.isIntersecting && nextCursor && !loadingMore) {
        loadingMore = true;
        try {
          await loadImages(active, false);
        } finally {
          loadingMore = false;
        }
      }
    }
  });
  io.observe(sentinel);

  const imgObserver = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        const src = img.getAttribute("data-src");
        if (src) {
          img.src = src;
          img.removeAttribute("data-src");
          img.classList.remove("lazy");
          obs.unobserve(img);
        }
      }
    });
  }, { rootMargin: "200px 0px" });
  function lazyLoadImages() {
    els("img.lazy").forEach(img => imgObserver.observe(img));
  }
  const rl = el("#reloadLink");
  if (rl) {
    rl.addEventListener("click", (e) => {
      e.preventDefault();
      const href = location.pathname + "?cb=" + Date.now();
      location.replace(href);
    });
  }
  const showPreview = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      previewImg.src = reader.result;
      previewName.textContent = file.name || "";
      const sizeKB = file.size / 1024;
      previewSize.textContent = `${sizeKB >= 1024 ? (sizeKB/1024).toFixed(2)+' MB' : sizeKB.toFixed(1)+' KB'}`;
      preview.classList.remove("hidden");
    };
    reader.readAsDataURL(file);
  };
  chooseBtn.addEventListener("click", (e) => { e.stopPropagation(); input.click(); });
  dz.addEventListener("click", () => input.click());
  dz.addEventListener("dragenter", (e) => { e.preventDefault(); dz.classList.add("dragover"); });
  dz.addEventListener("dragover", (e) => { e.preventDefault(); dz.classList.add("dragover"); });
  dz.addEventListener("dragleave", () => { dz.classList.remove("dragover"); });
  dz.addEventListener("drop", (e) => {
    e.preventDefault();
    dz.classList.remove("dragover");
    if (!allowUpload) {
      status.textContent = "上传已关闭";
      return;
    }
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    if (!["image/jpeg", "image/png"].includes(f.type)) {
      status.textContent = "仅支持 JPG/PNG 格式";
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      status.textContent = "图片过大（>5MB），请压缩后再上传";
      return;
    }
    selectedFile = f;
    showPreview(f);
  });
  input.addEventListener("change", () => {
    if (!allowUpload) {
      status.textContent = "上传已关闭";
      return;
    }
    const f = input.files?.[0];
    if (!f) return;
    if (!["image/jpeg", "image/png"].includes(f.type)) {
      status.textContent = "仅支持 JPG/PNG 格式";
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      status.textContent = "图片过大（>5MB），请压缩后再上传";
      return;
    }
    selectedFile = f;
    showPreview(f);
  });
  el("#uploadBtn").addEventListener("click", async () => {
    if (!allowUpload) {
      status.textContent = "上传已关闭";
      return;
    }
    const file = selectedFile || el("#fileInput").files?.[0];
    if (!file) {
      status.textContent = "请选择图片文件";
      return;
    }
    el("#uploadBtn").disabled = true;
    status.textContent = "正在上传...";
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) {
        let err = "上传失败";
        try {
          const j = await res.json();
          err = j?.error || err;
          if (j?.detail) err += `：${j.detail.slice(0, 120)}`;
        } catch {}
        status.textContent = err;
        return;
      }
      const data = await res.json();
      status.textContent = "上传成功";
      // Refresh current tab list
      const active = document.querySelector(".tab-btn.active")?.dataset.sort || "latest";
      loadImages(active);
      // reset input
      el("#fileInput").value = "";
      selectedFile = null;
      el("#preview").classList.add("hidden");
    } catch (e) {
      status.textContent = "上传出现错误";
    } finally {
      el("#uploadBtn").disabled = false;
      setTimeout(() => status.textContent = "", 2500);
    }
  });
}

function init() {
  setActiveTab("hot");
  bindEvents();
  nextCursor = "";
  loadImages("hot", true);
}

document.addEventListener("DOMContentLoaded", init);
