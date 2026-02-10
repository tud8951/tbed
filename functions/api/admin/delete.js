export async function onRequestPost({ request, env }) {
  const auth = request.headers.get("Authorization") || "";
  const pass = env.PASSWORD || "";
  if (!pass || !auth.startsWith("Bearer ") || auth.slice(7) !== pass) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }
  const body = await request.json().catch(() => null);
  const id = body?.id;
  if (!id) {
    return new Response(JSON.stringify({ error: "bad_request" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }
  if (env?.db) {
    await env.db.prepare("DELETE FROM images WHERE id = ?").bind(id).run();
  }
  if (env?.kv) {
    await env.kv.delete(`image:${id}`);
  }
  return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
}
