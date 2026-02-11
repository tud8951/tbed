const el = (sel) => document.querySelector(sel);
const els = (sel) => Array.from(document.querySelectorAll(sel));
let selectedFile = null;
let allowUpload = true;

function formatTime(ts) {
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

let imgObserver = null;
let pages = [];
let cursors = [];
let pageIndex = 0;
let pageSize = 20;
const cacheBust = (() => {
  const m = (location.search || "").match(/[?&]cb=([^&]+)/);
  return m ? decodeURIComponent(m[1]) : "";
})();
const addCb = (url) => cacheBust ? url + (url.indexOf("?") >= 0 ? "&" : "?") + "cb=" + encodeURIComponent(cacheBust) : url;
function setupLazyObserver() {
  if (typeof window !== "undefined" && "IntersectionObserver" in window) {
    imgObserver = new IntersectionObserver((entries, obs) => {
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
  } else {
    imgObserver = null;
  }
}
function lazyLoadImages() {
  if (!imgObserver) return;
  els("img.lazy").forEach(img => imgObserver.observe(img));
}

function computePageSize() {
  if (window.matchMedia && window.matchMedia("(max-width: 640px)").matches) {
    return 10;
  }
  return 21;
}
function updatePagerUI() {
  const info = el("#pageInfo");
  if (info) info.textContent = `第 ${pageIndex + 1} 页`;
  const prev = el("#prevPage");
  const next = el("#nextPage");
  if (prev) prev.disabled = pageIndex <= 0;
  const hasNext = !!cursors[pageIndex];
  if (next) next.disabled = !hasNext;
  const pn = el("#pageNumbers");
  if (pn) {
    pn.innerHTML = pages.map((_, i) => `<button class="page-num${i === pageIndex ? " active" : ""}" data-idx="${i}">${i + 1}</button>`).join("");
  }
}
async function fetchPage(sort, cursorToken) {
  const url = new URL(`/api/images`, window.location.origin);
  url.searchParams.set("sort", sort);
  url.searchParams.set("limit", String(pageSize));
  if (cursorToken) url.searchParams.set("cursor", cursorToken);
  const res = await fetch(url.pathname + url.search);
  if (!res.ok) {
    throw new Error("加载图片失败");
  }
  const items = await res.json();
  const nc = res.headers.get("X-Next-Cursor") || "";
  return { items, nextCursor: nc };
}
async function resetPagination(sort) {
  pages = [];
  cursors = [];
  pageIndex = 0;
  pageSize = computePageSize();
  try {
    const { items, nextCursor: nc } = await fetchPage(sort, "");
    pages.push(items);
    cursors.push(nc);
    renderGallery(items, true);
  } catch {
    el("#gallery").innerHTML = `<div class="status">加载图片失败</div>`;
  }
  updatePagerUI();
}
async function goNext(sort) {
  if (!cursors[pageIndex]) return;
  const nextToken = cursors[pageIndex];
  if (pages[pageIndex + 1]) {
    pageIndex += 1;
    renderGallery(pages[pageIndex], true);
    updatePagerUI();
    return;
  }
  try {
    const { items, nextCursor: nc } = await fetchPage(sort, nextToken);
    pages.push(items);
    cursors.push(nc);
    pageIndex += 1;
    renderGallery(items, true);
  } catch {
    // keep page index unchanged
  }
  updatePagerUI();
}
function goPrev() {
  if (pageIndex <= 0) return;
  pageIndex -= 1;
  renderGallery(pages[pageIndex] || [], true);
  updatePagerUI();
}

function renderGallery(items, reset = true) {
  const liked = JSON.parse(localStorage.getItem("liked_ids") || "[]");
  const html = items.map(item => {
    const isLiked = liked.includes(item.id);
    const thumb = addCb(`/api/i/${item.id}?w=480&q=65`);
    return `
      <article class="card" data-id="${item.id}">
        ${imgObserver ? `<img class="lazy" data-src="${thumb}" alt="image" loading="lazy" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==">` : `<img src="${thumb}" alt="image" loading="lazy">`}
        <div class="meta">
          <span class="time">${formatTime(item.ts)}</span>
          <div class="actions">
            <a class="download" href="${addCb(`/api/i/${item.id}.${item.ext || "jpg"}`)}" download="img-${item.id}.${item.ext || "jpg"}">下载</a>
            <a class="download share" href="${addCb(`/api/i/${item.id}.${item.ext || "jpg"}`)}" data-id="${item.id}" data-ext="${item.ext || "jpg"}">分享</a>
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
      resetPagination(sort);
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
    const shareLink = ev.target.closest("a.share");
    if (shareLink) {
      ev.preventDefault();
      const id = shareLink.dataset.id;
      const ext = shareLink.dataset.ext || "jpg";
      const link = window.location.origin + addCb(`/api/i/${id}.${ext}`);
      const text = shareLink.textContent;
      shareLink.classList.add("disabled");
      Promise.resolve().then(async () => {
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(link);
          } else {
            const ta = document.createElement("textarea");
            ta.value = link;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            document.body.removeChild(ta);
          }
          shareLink.textContent = "已复制";
          setTimeout(() => { shareLink.textContent = text; }, 1500);
        } finally {
          shareLink.classList.remove("disabled");
        }
      });
      return;
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
  const prevBtn = el("#prevPage");
  const nextBtn = el("#nextPage");
  if (prevBtn) prevBtn.addEventListener("click", () => goPrev());
  if (nextBtn) nextBtn.addEventListener("click", () => {
    const active = document.querySelector(".tab-btn.active")?.dataset.sort || "hot";
    goNext(active);
  });
  const pageNumbers = el("#pageNumbers");
  if (pageNumbers) {
    pageNumbers.addEventListener("click", (ev) => {
      const btn = ev.target.closest(".page-num[data-idx]");
      if (!btn) return;
      const idx = parseInt(btn.dataset.idx, 10);
      if (!Number.isFinite(idx) || idx < 0) return;
      if (pages[idx]) {
        pageIndex = idx;
        renderGallery(pages[pageIndex], true);
        updatePagerUI();
      }
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
      resetPagination(active);
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
  setupLazyObserver();
  resetPagination("hot");
  (async () => {
    try {
      const r = await fetch("/api/count");
      if (r.ok) {
        const j = await r.json();
        const sc = el("#siteCount");
        if (sc) sc.textContent = `已存储 ${Number(j?.count || 0)} 张图片`;
      }
    } catch {}
  })();
}

document.addEventListener("DOMContentLoaded", init);
