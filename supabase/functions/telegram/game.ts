// "Guess the price": a Telegram widget game inside the Argos bot (Bot API 10.4 HTML widgets).
// The house photo goes as a normal photo, the widget under it holds the slider. The real price never
// leaves the server until the player has sent a guess. Widgets work in private chats only.
import { adminClient } from "../_shared/runtime.ts";

type Admin = ReturnType<typeof adminClient>;
type Row = Record<string, unknown>;
type Tg = (method: string, body: Record<string, unknown>) => Promise<Record<string, any>>;

const SB = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/$/, "");
const SITE = (Deno.env.get("SITE_URL") || "https://odysstay.xyz").replace(/\/$/, "");
const photo = (p: string | null) => (!p ? null : /^https?:\/\//.test(p) ? p : `${SB}/storage/v1/object/public/listing-images/${p}`);
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const S = {
  ru: {
    q: "Сколько стоит этот дом?", tap: "Коснитесь шкалы или жмите + и −", go: "Угадать", real: "На самом деле", you: "Вы", pts: "очков",
    total: "Всего", houses: "домов", next: "Ещё дом", wait: "Секунду…", err: "Не вышло, попробуйте ещё раз",
    t: ["Как будто сами продавали", "Глаз намётан", "Неплохо", "Италия умеет удивлять"],
    type: { house: "Дом", rural_house: "Загородный дом" } as Record<string, string>, sqm: "м²", look: "Смотреть этот дом",
    fail: "Игра сейчас не открывается. Попробуйте чуть позже.", empty: "Домов для игры пока нет, загляните позже.", cap: "Ваша цифра?",
  },
  en: {
    q: "What does this house cost?", tap: "Tap the scale or use + and -", go: "Guess", real: "Actual price", you: "You", pts: "points",
    total: "Total", houses: "houses", next: "Another house", wait: "One moment…", err: "Didn't work, try again",
    t: ["Could have sold it yourself", "Sharp eye", "Not bad", "Italy loves to surprise"],
    type: { house: "House", rural_house: "Country house" } as Record<string, string>, sqm: "m²", look: "See this house",
    fail: "The game won't open right now. Try again soon.", empty: "No houses for the game yet, check back later.", cap: "Your number?",
  },
};
type Lang = keyof typeof S;

/** Points from how far off the guess is, on a ratio scale: 10% off is about 90, 2x off is about 25. */
export function score(guess: number, real: number) {
  return Math.round(100 * Math.max(0, 1 - Math.abs(Math.log(guess / real)) / Math.log(2.5)));
}

function widgetHtml(l: Lang) {
  const s = S[l];
  return `<style>
body{margin:0;font:15px system-ui,sans-serif;background:#f6ecd9;color:#2b2118;border-radius:14px;height:250px;overflow:hidden}
#a{padding:14px 16px;text-align:center}
h4{margin:0;font:600 15px Georgia,serif}
.v{font:700 34px Georgia,serif;color:#a8472a;margin:8px 0 4px}
.h{font-size:12px;color:#7a6a58}
.tr{position:relative;height:30px;margin:10px 4px}
.tr i{position:absolute;left:0;right:0;top:13px;height:4px;border-radius:2px;background:#d9c7a8}
.tr b{position:absolute;top:13px;left:0;height:4px;border-radius:2px;background:#a8472a}
.tr u{position:absolute;top:4px;width:22px;height:22px;margin-left:-11px;border-radius:50%;background:#a8472a;border:3px solid #f6ecd9;box-shadow:0 1px 4px #0005}
.tr s{position:absolute;top:4px;width:22px;height:22px;margin-left:-11px;border-radius:50%;background:#5d6b3a;border:3px solid #f6ecd9}
.r{display:flex;gap:8px;justify-content:center;align-items:center;margin-top:8px}
button{font:600 15px system-ui,sans-serif;border:0;border-radius:10px;background:#a8472a;color:#fff;padding:10px 20px}
button.o{background:#e6d6b8;color:#2b2118;width:44px;padding:10px 0;font-size:20px}
button:disabled{opacity:.5}
.p{font:700 15px Georgia,serif;color:#5d6b3a;margin-top:6px}
</style><div id=a></div><script>
var T=${JSON.stringify(s)},W=TelegramWidget,A=document.getElementById('a'),lo=5e3,hi=4e5,pos=.45;
function val(p){var v=lo*Math.pow(hi/lo,p),st=v<2e4?500:v<1e5?1e3:5e3;return Math.round(v/st)*st}
function pp(v){return Math.log(v/lo)/Math.log(hi/lo)}
function eur(v){return '\\u20ac'+String(Math.round(v)).replace(/\\B(?=(\\d{3})+$)/g,'\\u2009')}
function game(){
A.innerHTML='<h4>'+T.q+'</h4><div class=v id=v></div><div class=tr id=t><i></i><b id=f></b><u id=k></u></div><div class=h>'+T.tap+'</div><div class=r><button class=o id=m>\\u2212</button><button id=g>'+T.go+'</button><button class=o id=n>+</button></div>';
var V=document.getElementById('v'),F=document.getElementById('f'),K=document.getElementById('k'),B=document.getElementById('g');
function d(){pos=Math.max(0,Math.min(1,pos));V.textContent=eur(val(pos));F.style.width=pos*100+'%';K.style.left=pos*100+'%'}
d();
document.getElementById('t').onclick=function(e){var r=this.getBoundingClientRect();pos=(e.clientX-r.left)/r.width;d();W.HapticFeedback&&W.HapticFeedback.selectionChanged()};
document.getElementById('m').onclick=function(){pos-=.02;d()};
document.getElementById('n').onclick=function(){pos+=.02;d()};
B.onclick=function(){B.disabled=true;B.textContent=T.wait;var g=val(pos);
W.request('g:'+g).then(function(a){res(JSON.parse(a.result))},function(){B.disabled=false;B.textContent=T.err})}}
function res(o){
var i=o.s>=90?0:o.s>=70?1:o.s>=40?2:3;
A.innerHTML='<h4>'+T.t[i]+'</h4><div class=h style="margin-top:8px">'+T.real+'</div><div class=v style="margin:2px 0">'+eur(o.p)+'</div><div class=tr><i></i><s style="left:'+pp(o.p)*100+'%"></s><u style="left:'+pp(o.g)*100+'%"></u></div><div class=h>'+T.you+': '+eur(o.g)+'</div><div class=p>+'+o.s+' '+T.pts+' \\u00b7 '+T.total+' '+o.t+' / '+o.n+' '+T.houses+'</div><div class=r><button id=x>'+T.next+'</button></div>';
W.HapticFeedback&&W.HapticFeedback.notificationOccurred(o.s>=70?'success':'warning');
var X=document.getElementById('x');X.onclick=function(){X.disabled=true;X.textContent=T.wait;W.request('n').then(function(){X.textContent='\\u2713'},function(){X.disabled=false;X.textContent=T.err})}}
var c=null;try{c=JSON.parse(W.chatData)}catch(e){}
if(c&&c.p)res(c);else game();
</script>`;
}

async function stats(admin: Admin, chatId: number) {
  const { data } = await admin.from("tg_games").select("points").eq("chat_id", chatId).not("answered_at", "is", null);
  const pts = (data ?? []).map((r) => Number(r.points ?? 0));
  return { t: pts.reduce((a, b) => a + b, 0), n: pts.length };
}

/** Sends one round: the photo, then the widget. `only` pins a specific house (from the channel post). */
export async function startRound(admin: Admin, tg: Tg, chatId: number, lang: Lang, only?: string) {
  const s = S[lang] ?? S.ru;
  const { data: played } = await admin.from("tg_games").select("listing_id").eq("chat_id", chatId);
  const seen = new Set((played ?? []).map((p) => p.listing_id as string));
  let r: Row | null = null;
  const cols = "id, comune, region, price_eur, surface_sqm, property_type, hero_image_path";
  if (only) {
    const { data } = await admin.from("listing_feed").select(cols).eq("id", only).maybeSingle();
    if (data && !seen.has(only)) r = data as Row;
  }
  if (!r) {
    const { data } = await admin.from("listing_feed").select(cols)
      .eq("is_demo", false).eq("is_scrap", false).eq("has_real_photo", true).not("status", "in", "(closed,withdrawn)")
      .eq("sale_type", "sale").in("property_type", ["house", "rural_house"]).gte("price_eur", 8000).lte("price_eur", 250000)
      .gte("score", 55).not("hero_image_path", "is", null).order("created_at", { ascending: false }).limit(150);
    const list = (data ?? []).filter((x) => !seen.has(x.id as string));
    r = list.length ? list[Math.floor(Math.random() * list.length)] as Row : null;
  }
  if (!r) { await tg("sendMessage", { chat_id: chatId, text: s.empty }); return; }
  const facts = [s.type[r.property_type as string] ?? s.type.house, r.surface_sqm ? `${Math.round(Number(r.surface_sqm))} ${s.sqm}` : null, `${r.comune}, ${r.region}`].filter(Boolean).join(" · ");
  const ph = photo(r.hero_image_path as string | null);
  if (ph) await tg("sendPhoto", { chat_id: chatId, photo: ph, caption: facts });
  else await tg("sendMessage", { chat_id: chatId, text: facts });
  const sent = await tg("sendWidget", { chat_id: chatId, html: widgetHtml(lang), allow_queries: true, width: 0, height: 250, caption: s.cap });
  if (!sent.ok) { await tg("sendMessage", { chat_id: chatId, text: s.fail }); return; }
  await admin.from("tg_games").insert({ chat_id: chatId, message_id: sent.result?.message_id ?? null, listing_id: r.id });
}

/** A tap inside the widget. Always answered, within 15 seconds. */
export async function widgetQuery(admin: Admin, tg: Tg, q: Row, lang: (chatId: number) => Promise<Lang>) {
  const chatId = (q.chat as Row | undefined)?.id as number | undefined;
  const messageId = q.message_id as number | undefined;
  const data = String(q.data ?? "");
  const answer = (d?: string) => tg("answerWidgetQuery", { widget_query_id: q.id, ...(d ? { data: d } : {}) });
  if (!chatId || !messageId) { await answer(); return; }
  const l = await lang(chatId);
  if (data === "n") {
    await answer("ok");
    await startRound(admin, tg, chatId, l);
    return;
  }
  const m = data.match(/^g:(\d{3,7})$/);
  const { data: row } = await admin.from("tg_games").select("*").eq("chat_id", chatId).eq("message_id", messageId).maybeSingle();
  if (!m || !row) { await answer(); return; }
  const { data: h } = await admin.from("listing_feed").select("price_eur").eq("id", row.listing_id).maybeSingle();
  const real = Number(h?.price_eur);
  if (!real) { await answer(); return; }
  if (row.answered_at) {
    const st = await stats(admin, chatId);
    await answer(JSON.stringify({ p: real, g: Number(row.guess), s: row.points, ...st }));
    return;
  }
  const guess = Number(m[1]);
  const pts = score(guess, real);
  await admin.from("tg_games").update({ guess, points: pts, answered_at: new Date().toISOString() }).eq("id", row.id);
  const st = await stats(admin, chatId);
  const out = { p: Math.round(real), g: guess, s: pts, ...st };
  await answer(JSON.stringify(out));
  // Keep the result in the message so it survives reopening the chat, and unlock the link to the house.
  await tg("editMessageWidgetData", { chat_id: chatId, message_id: messageId, chat_data: JSON.stringify({ p: out.p, g: guess, s: pts, t: st.t, n: st.n }) });
  await tg("editMessageReplyMarkup", { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [[{ text: S[l].look, url: `${SITE}/listing/${row.listing_id}?utm_source=tg_game` }]] } });
}
