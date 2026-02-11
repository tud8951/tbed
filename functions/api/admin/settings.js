export async function onRequestGet({ request, env }) {
  const auth = request.headers.get("Authorization") || "";
  const pass = env.PASSWORD || "";
  if (!pass || !auth.startsWith("Bearer ") || auth.slice(7) !== pass) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }
  let allow = true;
  let filter = false;
  let seIndex = 0;
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
  if (env?.kv) {
    const v = await env.kv.get("settings:allow_upload");
    if (v !== null && v !== undefined) {
      allow = v === "1" || v === "true";
    }
    const f = await env.kv.get("settings:filter_enabled");
    if (f !== null && f !== undefined) {
      filter = f === "1" || f === "true";
    }
    const si = await env.kv.get("settings:sightengine_index");
    if (si !== null && si !== undefined) {
      const n = parseInt(si, 10);
      if (Number.isFinite(n) && n >= 0) seIndex = n;
    }
  }
  if (!Number.isFinite(seIndex) || seIndex < 0) seIndex = 0;
  if (users.length && seIndex >= users.length) seIndex = 0;
  return new Response(JSON.stringify({ allow_upload: allow, filter_enabled: filter, sightengine_index: seIndex, sightengine_users: users }), { headers: { "Content-Type": "application/json" } });
}

export async function onRequestPost({ request, env }) {
  const auth = request.headers.get("Authorization") || "";
  const pass = env.PASSWORD || "";
  if (!pass || !auth.startsWith("Bearer ") || auth.slice(7) !== pass) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }
  const body = await request.json().catch(() => null);
  const op = body?.op || "";
  if (op === "toggle_upload") {
    const allow = !!body?.allow_upload;
    if (env?.kv) {
      await env.kv.put("settings:allow_upload", allow ? "1" : "0");
    }
    return new Response(JSON.stringify({ allow_upload: allow }), { headers: { "Content-Type": "application/json" } });
  }
  if (op === "toggle_filter") {
    const enable = !!body?.filter_enabled;
    if (env?.kv) {
      await env.kv.put("settings:filter_enabled", enable ? "1" : "0");
    }
    return new Response(JSON.stringify({ filter_enabled: enable }), { headers: { "Content-Type": "application/json" } });
  }
  if (op === "set_sightengine_index") {
    let idx = parseInt(body?.index, 10);
    if (!Number.isFinite(idx) || idx < 0) {
      return new Response(JSON.stringify({ error: "bad_request" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
    if (env?.kv) {
      await env.kv.put("settings:sightengine_index", String(idx));
    }
    return new Response(JSON.stringify({ sightengine_index: idx }), { headers: { "Content-Type": "application/json" } });
  }
  if (op === "set_likes") {
    const id = body?.id;
    let likes = body?.likes;
    if (!id || likes === undefined || likes === null) {
      return new Response(JSON.stringify({ error: "bad_request" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
    likes = Number(likes);
    if (!Number.isFinite(likes) || likes < 0) {
      return new Response(JSON.stringify({ error: "invalid_likes" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
    if (env?.db) {
      await env.db.prepare("UPDATE images SET likes = ? WHERE id = ?").bind(likes, id).run();
      if (env?.kv) {
        const key = `image:${id}`;
        const raw = await env.kv.get(key);
        if (raw) {
          const rec = JSON.parse(raw);
          rec.likes = likes;
          await env.kv.put(key, JSON.stringify(rec));
        }
      }
      return new Response(JSON.stringify({ id, likes }), { headers: { "Content-Type": "application/json" } });
    }
    if (env?.kv) {
      const key = `image:${id}`;
      const raw = await env.kv.get(key);
      if (!raw) {
        return new Response(JSON.stringify({ error: "not_found" }), { status: 404, headers: { "Content-Type": "application/json" } });
      }
      const rec = JSON.parse(raw);
      rec.likes = likes;
      await env.kv.put(key, JSON.stringify(rec));
      return new Response(JSON.stringify({ id, likes }), { headers: { "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: "no_storage" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
  return new Response(JSON.stringify({ error: "unsupported_op" }), { status: 400, headers: { "Content-Type": "application/json" } });
}
