const el = (sel) => document.querySelector(sel);
const els = (sel) => Array.from(document.querySelectorAll(sel));
let selectedFile = null;

function formatTime(ts) {
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function loadImages(sort = "latest") {
  const res = await fetch(`/api/images?sort=${encodeURIComponent(sort)}`);
  if (!res.ok) {
    el("#gallery").innerHTML = `<div class="status">加载图片失败</div>`;
    return;
  }
  const items = await res.json();
  renderGallery(items);
}

function renderGallery(items) {
  const liked = JSON.parse(localStorage.getItem("liked_ids") || "[]");
  el("#gallery").innerHTML = items.map(item => {
    const isLiked = liked.includes(item.id);
    return `
      <article class="card" data-id="${item.id}">
        <img src="/api/i/${item.id}" alt="image" loading="lazy">
        <div class="meta">
          <span class="time">${formatTime(item.ts)}</span>
          <div class="actions">
            <a class="download" href="/api/i/${item.id}" download="img-${item.id}.jpg">下载</a>
            <button class="like ${isLiked ? "liked" : ""}" data-id="${item.id}">❤️ <span class="count">${item.likes}</span></button>
          </div>
        </div>
      </article>`;
  }).join("");
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
      loadImages(sort);
    });
  });
  const lb = el("#lightbox");
  const lbImg = el("#lightboxImg");
  el("#gallery").addEventListener("click", (ev) => {
    const img = ev.target.closest(".card img");
    if (img) {
      lbImg.src = img.src;
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
  setActiveTab("latest");
  bindEvents();
  loadImages("latest");
}

document.addEventListener("DOMContentLoaded", init);
