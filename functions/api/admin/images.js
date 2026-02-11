export async function onRequestGet({ request, env }) {
  const auth = request.headers.get("Authorization") || "";
  const pass = env.PASSWORD || "";
  if (!pass || !auth.startsWith("Bearer ") || auth.slice(7) !== pass) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }
  const u = new URL(request.url);
  const limitParam = parseInt(u.searchParams.get("limit") || "20", 10);
  const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(50, limitParam)) : 20;
  const cursor = u.searchParams.get("cursor") || "";
  if (env?.db) {
    let offset = 0;
    if (cursor && cursor.startsWith("d1:")) {
      const off = parseInt(cursor.slice(3), 10);
      if (Number.isFinite(off) && off >= 0) offset = off;
    }
    let { results } = await env.db.prepare("SELECT id, url, ts, likes FROM images ORDER BY ts DESC LIMIT ? OFFSET ?").bind(limit, offset).all();
    const mapExt = (u) => {
      try {
        const p = new URL(u).pathname.split("/").pop() || "";
        const e = p.includes(".") ? p.split(".").pop().toLowerCase() : "";
        return ["jpg", "jpeg", "png", "webp", "gif"].includes(e) ? (e === "jpeg" ? "jpg" : e) : "jpg";
      } catch { return "jpg"; }
    };
    results = (results || []).map(r => ({ ...r, url: `/api/i/${r.id}`, ext: mapExt(r.url || "") }));
    if (env?.kv && results.length) {
      const metas = await Promise.all(results.map(r => env.kv.get(`image_meta:${r.id}`).then(v => (v ? JSON.parse(v) : null)).catch(() => null)));
      results = results.map((r, i) => ({ ...r, ip: metas[i]?.ip || "" }));
    }
    const next = results.length === limit ? `d1:${offset + results.length}` : "";
    const headers = new Headers({ "Content-Type": "application/json" });
    if (next) headers.set("X-Next-Cursor", next);
    return new Response(JSON.stringify(results), { headers });
  }
  if (env?.kv) {
    const opts = { prefix: "image:", limit };
    if (cursor && cursor.startsWith("kv:")) opts.cursor = cursor.slice(3);
    const list = await env.kv.list(opts);
    const keys = list.keys || [];
    const records = await Promise.all(keys.map(k => env.kv.get(k.name).then(v => (v ? JSON.parse(v) : null))));
    const items = records
      .filter(Boolean)
      .sort((a, b) => b.ts - a.ts)
      .map(r => {
        let ext = "jpg";
        try {
          const p = new URL(r.url || "").pathname.split("/").pop() || "";
          const e = p.includes(".") ? p.split(".").pop().toLowerCase() : "";
          ext = ["jpg", "jpeg", "png", "webp", "gif"].includes(e) ? (e === "jpeg" ? "jpg" : e) : "jpg";
        } catch {}
        return { ...r, url: `/api/i/${r.id}`, ext };
      });
    const filled = await Promise.all(items.map(async r => {
      if (!r.ip) {
        const m = await env.kv.get(`image_meta:${r.id}`);
        if (m) {
          try { const j = JSON.parse(m); r.ip = j?.ip || ""; } catch {}
        }
      }
      return r;
    }));
    const next = list.list_complete ? "" : `kv:${list.cursor || ""}`;
    const headers = new Headers({ "Content-Type": "application/json" });
    if (next) headers.set("X-Next-Cursor", next);
    return new Response(JSON.stringify(filled), { headers });
  }
  return new Response(JSON.stringify([]), { headers: { "Content-Type": "application/json" } });
}
