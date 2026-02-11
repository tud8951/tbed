export async function onRequestGet({ env }) {
  let allow = true;
  let filter = false;
  if (env?.kv) {
    const v = await env.kv.get("settings:allow_upload");
    if (v !== null && v !== undefined) {
      allow = v === "1" || v === "true";
    }
    const f = await env.kv.get("settings:filter_enabled");
    if (f !== null && f !== undefined) {
      filter = f === "1" || f === "true";
    }
  }
  return new Response(JSON.stringify({ allow_upload: allow, filter_enabled: filter }), { headers: { "Content-Type": "application/json" } });
}
