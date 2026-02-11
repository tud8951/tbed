export async function onRequestGet({ request, env }) {
  const cache = caches.default;
  const cached = await cache.match(request);
  if (cached) return cached;
  let count = 0;
  if (env?.db) {
    const row = await env.db.prepare("SELECT COUNT(*) AS c FROM images").first();
    count = Number(row?.c || 0);
  } else if (env?.kv) {
    let cursor = undefined;
    let total = 0;
    while (true) {
      const list = await env.kv.list({ prefix: "image:", cursor });
      total += (list.keys || []).length;
      if (list.list_complete) break;
      cursor = list.cursor;
    }
    count = total;
  }
  const headers = new Headers({ "Content-Type": "application/json", "Cache-Control": "public, max-age=60" });
  const res = new Response(JSON.stringify({ count }), { headers });
  await cache.put(request, res.clone());
  return res;
}
