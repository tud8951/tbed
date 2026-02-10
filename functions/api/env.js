export async function onRequestGet({ request, env }) {
  const u = new URL(request.url);
  const test = u.searchParams.get("test") === "1";
  const tgbot = env.TGBOT || "";
  const tggroup = env.TGGROUP || "";
  const kv = !!env.kv;
  const db = !!env.db;
  const formatOk = /^[0-9]+:[A-Za-z0-9_\\-]+$/.test(tgbot);
  let telegramOk = false;
  let me = null;
  if (test && tgbot) {
    try {
      const r = await fetch(`https://api.telegram.org/bot${tgbot}/getMe`);
      if (r.ok) {
        const j = await r.json();
        telegramOk = !!j?.ok;
        if (telegramOk) {
          me = {
            id: j?.result?.id,
            name: j?.result?.username || j?.result?.first_name || ""
          };
        }
      }
    } catch {}
  }
  const groupType = tggroup
    ? (String(tggroup).startsWith("-100")
        ? "supergroup_or_channel"
        : (String(tggroup).startsWith("@") ? "username" : "group_or_user"))
    : null;
  const tokenMasked = tgbot ? tgbot.slice(0, 6) + "..." : "";
  const res = {
    tgbot_set: !!tgbot,
    tgbot_format_ok: formatOk,
    tgbot_masked: tokenMasked,
    tggroup_set: !!tggroup,
    tggroup_type: groupType,
    kv_bound: kv,
    d1_bound: db,
    telegram_token_valid: telegramOk,
    telegram_me: me
  };
  return new Response(JSON.stringify(res), { headers: { "Content-Type": "application/json" } });
}
