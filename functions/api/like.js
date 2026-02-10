export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const id = body?.id;
    if (!id) {
      return new Response(JSON.stringify({ error: "缺少图片ID" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
    // D1 优先
    if (env?.db) {
      await env.db.prepare("UPDATE images SET likes = likes + 1 WHERE id = ?").bind(id).run();
      const row = await env.db.prepare("SELECT id, likes FROM images WHERE id = ?").bind(id).first();
      if (!row) {
        return new Response(JSON.stringify({ error: "图片不存在" }), { status: 404, headers: { "Content-Type": "application/json" } });
      }
      // KV 镜像更新（可选）
      if (env?.kv) {
        const key = `image:${id}`;
        const raw = await env.kv.get(key);
        if (raw) {
          const rec = JSON.parse(raw);
          rec.likes = row.likes;
          await env.kv.put(key, JSON.stringify(rec));
        }
      }
      return new Response(JSON.stringify({ id: row.id, likes: row.likes }), { headers: { "Content-Type": "application/json" } });
    }

    // 回退到 KV
    if (env?.kv) {
      const key = `image:${id}`;
      const raw = await env.kv.get(key);
      if (!raw) {
        return new Response(JSON.stringify({ error: "图片不存在" }), { status: 404, headers: { "Content-Type": "application/json" } });
      }
      const record = JSON.parse(raw);
      record.likes = (record.likes || 0) + 1;
      await env.kv.put(key, JSON.stringify(record));
      return new Response(JSON.stringify({ id: record.id, likes: record.likes }), { headers: { "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "未配置存储" }), { status: 500, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: "服务器错误" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
