// The Telegram Mini App backend: the games and the mini site, opened as a page inside Telegram
// (odysstay.xyz/tg). Telegram restricted in-chat widgets to whitelisted bots; Mini Apps need no whitelist.
// Every game call is signed by Telegram (initData), so a player can only play as themselves.
import { adminClient } from "../_shared/runtime.ts";
import { miniGuess, miniRound, miniTop, priceHtml, setName, whereHtml } from "../telegram/game.ts";
import { siteData, siteHtml } from "../telegram/site.ts";

const BOT = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
  "access-control-allow-methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, "content-type": "application/json" } });

const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");

/** Telegram's Mini App signature: HMAC-SHA256 over the sorted fields, keyed by HMAC("WebAppData", bot token). */
async function player(initData: string): Promise<{ id: number; first_name?: string; language_code?: string } | null> {
  if (!initData || !BOT) return null;
  const p = new URLSearchParams(initData);
  const hash = p.get("hash");
  if (!hash) return null;
  p.delete("hash");
  const check = [...p.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `${k}=${v}`).join("\n");
  const enc = new TextEncoder();
  const k1 = await crypto.subtle.importKey("raw", enc.encode("WebAppData"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const secret = await crypto.subtle.sign("HMAC", k1, enc.encode(BOT));
  const k2 = await crypto.subtle.importKey("raw", secret, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  if (hex(await crypto.subtle.sign("HMAC", k2, enc.encode(check))) !== hash) return null;
  if (Date.now() / 1000 - Number(p.get("auth_date") ?? 0) > 7 * 86400) return null;
  try { return JSON.parse(p.get("user") ?? "null"); } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const lang = body.lang === "en" ? "en" : "ru";
  const action = String(body.action ?? "");
  const admin = adminClient();
  try {
    if (action === "html") {
      const m = String(body.mode ?? "");
      return json({ html: m === "where" ? whereHtml(lang) : m === "price" ? priceHtml(lang) : siteHtml(lang) });
    }
    if (action === "site") return json({ result: JSON.stringify(await siteData(admin, String(body.data ?? ""))) });

    const me = await player(String(body.initData ?? ""));
    if (!me?.id) return json({ error: "open this from Telegram" }, 401);
    const chatId = me.id; // a user's private chat with the bot has the user's id
    if (me.first_name) await setName(admin, chatId, me.first_name).catch(() => {});

    if (action === "round") {
      const kind = body.kind === "where" ? "where" : "price";
      const only = typeof body.only === "string" && /^[0-9a-f-]{36}$/i.test(body.only) ? body.only : undefined;
      const r = await miniRound(admin, chatId, lang, kind, only);
      return r ? json(r) : json({ error: "empty" }, 404);
    }
    if (action === "guess") {
      const out = await miniGuess(admin, chatId, Number(body.id), String(body.data ?? ""));
      return out ? json({ result: JSON.stringify(out) }) : json({ error: "bad guess" }, 400);
    }
    if (action === "top") return json(await miniTop(admin, chatId, lang));
    return json({ error: "unknown action" }, 400);
  } catch (e) {
    console.error("tg-mini", action, e);
    return json({ error: "failed" }, 500);
  }
});
