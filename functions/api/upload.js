export async function onRequestPost({ request, env }) {
  try {
    let allow = true;
    if (env?.kv) {
      const v = await env.kv.get("settings:allow_upload");
      if (v !== null && v !== undefined) {
        allow = v === "1" || v === "true";
      }
    }
    if (!allow) {
      return new Response(JSON.stringify({ error: "已关闭上传" }), { status: 403, headers: { "Content-Type": "application/json" } });
    }
    const form = await request.formData();
    const file = form.get("file");
    if (!file) {
      return new Response(JSON.stringify({ error: "缺少文件" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
    const size = file.size || 0;
    const type = file.type || "";
    const allowed = ["image/jpeg", "image/png"];
    if (!allowed.includes(type)) {
      return new Response(JSON.stringify({ error: "不支持的图片格式，仅支持 JPG/PNG" }), { status: 415, headers: { "Content-Type": "application/json" } });
    }
    if (size > 5 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: "图片过大（>5MB）" }), { status: 413, headers: { "Content-Type": "application/json" } });
    }

    const tgForm = new FormData();
    const ab = await file.arrayBuffer();
    const blob = new Blob([ab], { type: file.type || "image/jpeg" });
    tgForm.append("file", blob, file.name || "image.jpg");
    const hosts = ["https://telegra.ph/upload", "https://te.legra.ph/upload", "https://graph.org/upload"];
    let res = null;
    let lastErr = "";
    for (const h of hosts) {
      const r = await fetch(h, { method: "POST", body: tgForm, headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0" } });
      if (r.ok) {
        res = { r, host: h.split("/upload")[0] };
        break;
      } else {
        lastErr = await r.text().catch(() => "");
      }
    }
    let url = "";
    if (!res) {
      // 最终回退：使用 Telegram 文件直链作为图床
      if (env.TGBOT && env.TGGROUP) {
        const td = new FormData();
        td.append("chat_id", env.TGGROUP);
        td.append("document", blob, file.name || "image.jpg");
        const sendDoc = await fetch(`https://api.telegram.org/bot${env.TGBOT}/sendDocument`, { method: "POST", body: td });
        if (!sendDoc.ok) {
          const msg = await sendDoc.text().catch(() => "");
          return new Response(JSON.stringify({ error: "Telegram 回退上传失败", detail: msg || "Unknown error" }), { status: 502, headers: { "Content-Type": "application/json" } });
        }
        const sendJson = await sendDoc.json().catch(() => null);
        const fid = sendJson?.result?.document?.file_id;
        if (!fid) {
          return new Response(JSON.stringify({ error: "Telegram 返回异常，缺少 file_id" }), { status: 502, headers: { "Content-Type": "application/json" } });
        }
        const gf = await fetch(`https://api.telegram.org/bot${env.TGBOT}/getFile?file_id=${encodeURIComponent(fid)}`);
        const gfJson = await gf.json().catch(() => null);
        const fpath = gfJson?.result?.file_path;
        if (!fpath) {
          return new Response(JSON.stringify({ error: "Telegram 返回异常，缺少 file_path" }), { status: 502, headers: { "Content-Type": "application/json" } });
        }
        url = `https://api.telegram.org/file/bot${env.TGBOT}/${fpath}`;
      } else {
        return new Response(JSON.stringify({ error: "Telegraph 上传失败", detail: lastErr || "Unknown error" }), { status: 502, headers: { "Content-Type": "application/json" } });
      }
    } else {
      let json;
      try {
        json = await res.r.json();
      } catch {
        const txt = await res.r.text().catch(() => "");
        return new Response(JSON.stringify({ error: "Telegraph 返回异常", detail: txt || "Unknown error" }), { status: 502, headers: { "Content-Type": "application/json" } });
      }
      if (!Array.isArray(json) && json?.error) {
        return new Response(JSON.stringify({ error: "Telegraph 上传失败", detail: json.error }), { status: 502, headers: { "Content-Type": "application/json" } });
      }
      if (!Array.isArray(json) || !json[0]?.src) {
        return new Response(JSON.stringify({ error: "Telegraph 返回异常" }), { status: 502, headers: { "Content-Type": "application/json" } });
      }
      url = `${res.host}${json[0].src}`;
    }

    let filterEnabled = false;
    if (env?.kv) {
      const fv = await env.kv.get("settings:filter_enabled");
      if (fv !== null && fv !== undefined) {
        filterEnabled = fv === "1" || fv === "true";
      }
    }
    if (filterEnabled) {
      let ok = true;
      let detail = "";
      const parseList = (v) => {
        if (!v) return [];
        const s = String(v).trim();
        try {
          const j = JSON.parse(s);
          return Array.isArray(j) ? j.map(x => String(x)) : [];
        } catch {
          return [];
        }
      };
      const users = parseList(env.SIGHTENGINE_USER);
      const keys = parseList(env.SIGHTENGINE_KEY);
      let idx = 0;
      if (env?.kv) {
        const si = await env.kv.get("settings:sightengine_index");
        if (si !== null && si !== undefined) {
          const n = parseInt(si, 10);
          if (Number.isFinite(n) && n >= 0) idx = n;
        }
      }
      const apiUser = users.length ? users[Math.min(idx, users.length - 1)] : (env.SIGHTENGINE_USER || "");
      const apiKey = keys.length ? keys[Math.min(idx, keys.length - 1)] : (env.SIGHTENGINE_KEY || "");
      if (apiUser && apiKey) {
        try {
          const usp = new URLSearchParams();
          usp.set("models", "nudity");
          usp.set("url", url);
          usp.set("api_user", String(apiUser));
          usp.set("api_secret", String(apiKey));
          const r = await fetch(`https://api.sightengine.com/1.0/check.json?${usp.toString()}`, { headers: { "Accept": "application/json" } });
          if (r.ok) {
            const j = await r.json().catch(() => null);
            if (j && j.nudity) {
              const n = j.nudity;
              const raw = Number(n.raw) || 0;
              const sa = Number(n.sexual_activity) || 0;
              const sd = Number(n.sexual_display) || 0;
              ok = raw < 0.3 && sa < 0.3 && sd < 0.3;
              detail = JSON.stringify({ nudity: n });
            }
          }
        } catch {}
      }
      if (!ok) {
        return new Response(JSON.stringify({ error: "图片不符合社区规范", detail }), { status: 415, headers: { "Content-Type": "application/json" } });
      }
    }

    const id = crypto.randomUUID();
    const ts = Date.now();
    const ip = String((request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For") || "")).split(",")[0].trim();
    const record = { id, url, ts, likes: 0, ip };
    if (env?.db) {
      await env.db
        .prepare("INSERT INTO images (id, url, ts, likes) VALUES (?, ?, ?, ?)")
        .bind(id, url, ts, 0)
        .run();
    }
    if (env?.kv) {
      await env.kv.put(`image:${id}`, JSON.stringify(record));
      await env.kv.put(`image_meta:${id}`, JSON.stringify({ ip }));
    }

    if (env.TGBOT && env.TGGROUP) {
      await fetch(`https://api.telegram.org/bot${env.TGBOT}/sendPhoto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: env.TGGROUP, photo: url, disable_notification: true })
      });
    }

    return new Response(JSON.stringify(record), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: "服务器错误" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
