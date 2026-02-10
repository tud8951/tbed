export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const sort = url.searchParams.get("sort") || "latest"; // latest | hot

    // 优先使用 D1
    if (env?.db) {
      const order = sort === "hot" ? "likes DESC, ts DESC" : "ts DESC";
      const { results } = await env.db
        .prepare(`SELECT id, url, ts, likes FROM images ORDER BY ${order}`)
        .all();
      return new Response(JSON.stringify(results || []), { headers: { "Content-Type": "application/json" } });
    }

    // 回退至 KV（仅本地或未绑定 D1 时）
    if (env?.kv) {
      const list = await env.kv.list({ prefix: "image:" });
      const keys = list.keys || [];
      const records = await Promise.all(
        keys.map(k => env.kv.get(k.name).then(v => (v ? JSON.parse(v) : null)))
      );
      const items = records.filter(Boolean);

    if (sort === "hot") {
      items.sort((a, b) => {
        if (b.likes !== a.likes) return b.likes - a.likes;
        return b.ts - a.ts;
      });
    } else {
      items.sort((a, b) => b.ts - a.ts);
    }

      return new Response(JSON.stringify(items), { headers: { "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify([]), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: "服务器错误" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
