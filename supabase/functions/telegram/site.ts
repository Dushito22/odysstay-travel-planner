// A mini Odysstay inside a message: a Telegram widget where you pick a region and a budget and see the best matching
// listings from our database, three at a time with "Show more"; each one opens on the site. Widgets work in private chats only (Bot API 10.4).
import { adminClient } from "../_shared/runtime.ts";

type Admin = ReturnType<typeof adminClient>;
type Row = Record<string, unknown>;
type Tg = (method: string, body: Record<string, unknown>) => Promise<Record<string, any>>;
type Lang = "ru" | "en";

const SITE = (Deno.env.get("SITE_URL") || "https://odysstay.xyz").replace(/\/$/, "");
const REGIONS = [null, "Toscana", "Puglia", "Sicilia", "Abruzzo", "Calabria", "Piemonte", "Liguria"];
const BUDGETS = [30000, 70000, 150000, 400000];
const TYPES = ["house", "rural_house", "apartment", "building"];
const SALE = ["sale", "auction_judicial", "auction_notary", "one_euro"];

const S = {
  ru: {
    sub: "Дома в Италии, которые стоят своих денег",
    reg: ["Все", "Тоскана", "Апулия", "Сицилия", "Абруццо", "Калабрия", "Пьемонт", "Лигурия"],
    bud: ["до 30к", "до 70к", "до 150к", "любой"], found: "Найдено", best: "лучшие по оценке", more: "Показать ещё", again: "Сначала", of: "из", none: "Пока ничего, попробуйте шире", load: "Ищу", err: "Не вышло, ещё раз",
    types: ["Дом", "Сельский дом", "Квартира", "Здание"], sqm: "м²", open: "Открыть на сайте",
    sell: "Больше домов и разбор каждого", site: "odysstay.xyz",
  },
  en: {
    sub: "Houses in Italy worth their price",
    reg: ["All", "Tuscany", "Puglia", "Sicily", "Abruzzo", "Calabria", "Piedmont", "Liguria"],
    bud: ["to 30k", "to 70k", "to 150k", "any"], found: "Found", best: "best by score", more: "Show more", again: "Back to start", of: "of", none: "Nothing yet, try wider", load: "Searching", err: "Didn't work, try again",
    types: ["House", "Country house", "Apartment", "Building"], sqm: "m²", open: "Open on the site",
    sell: "More houses and a breakdown of each", site: "odysstay.xyz",
  },
};

const CSS = `:root{--bg:#fff;--ink:#1b1916;--mut:#8a857b;--ln:#e7e2d8;--ac:#2f6fa8;--te:#c0613a;--soft:#f3efe6}
.dark{--bg:#12181f;--ink:#f2ede3;--mut:#8f8a80;--ln:#2a343e;--ac:#7db6e8;--te:#e58f68;--soft:#1d2730}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
body{margin:0;background:var(--bg);color:var(--ink);font:15px -apple-system,system-ui,sans-serif;height:440px;overflow:hidden}
#a{padding:14px 14px 0}
.hd{display:flex;align-items:baseline;justify-content:space-between}
.lo{font:400 24px Georgia,serif;letter-spacing:-.5px}
.k{font-size:12px;color:var(--mut)}
.g{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:6px}
.g button{border:1px solid var(--ln);background:none;color:var(--ink);font:13px -apple-system,system-ui,sans-serif;height:32px;border-radius:16px;padding:0}
.g button.on{background:var(--ink);color:var(--bg);border-color:var(--ink)}
.h{display:flex;justify-content:space-between;align-items:center;border:0;border-top:1px solid var(--ln);background:none;color:var(--ink);width:100%;text-align:left;padding:10px 2px;font:inherit}
.h b{font:400 17px Georgia,serif}
.h span{font-size:12px;color:var(--mut);display:block;margin-top:2px}
.h i{font:400 17px Georgia,serif;font-style:normal;color:var(--te)}

.mb{width:100%;height:44px;border:0;border-radius:22px;background:var(--ink);color:var(--bg);font:600 15px -apple-system,system-ui,sans-serif;margin-top:10px}
.mb:active{transform:scale(.98)}
.ft{position:absolute;left:0;right:0;bottom:12px;text-align:center}`;

function siteHtml(l: Lang) {
  const s = S[l];
  return `<style>${CSS}</style><div id=a></div><script>
var T=${JSON.stringify(s)},W=TelegramWidget,A=document.getElementById('a'),rg=0,bd=1,pg=0,seq=0,box,mo;
document.documentElement.className=W.colorScheme;
function e(t,c,x){var n=document.createElement(t);if(c)n.className=c;if(x!=null)n.textContent=x;return n}
function eur(v){return '\\u20ac'+String(Math.round(v)).replace(/\\B(?=(\\d{3})+$)/g,'\\u2009')}
function chips(arr,cur,fn){var g=e('div','g');arr.forEach(function(t,i){var b=e('button',i==cur?'on':'',t);b.onclick=function(){fn(i)};g.appendChild(b)});A.appendChild(g)}
function show(){A.innerHTML='';var h=e('div','hd');h.appendChild(e('div','lo','Odysstay'));h.appendChild(e('div','k',T.sub.split(',')[0]));A.appendChild(h);
var sp=e('div');sp.style.height='12px';A.appendChild(sp);
chips(T.reg,rg,function(i){rg=i;pg=0;show()});chips(T.bud,bd,function(i){bd=i;pg=0;show()});
box=e('div');A.appendChild(box);mo=e('div','mo');A.appendChild(mo);A.appendChild(e('div','ft k',T.sell+' \\u00b7 '+T.site));
box.appendChild(e('div','k',T.load+'\\u2026'));var me=++seq;
W.request('q:'+rg+':'+bd+':'+pg).then(function(a){if(me!=seq)return;var o=JSON.parse(a.result);box.innerHTML='';
if(!o.h.length){box.appendChild(e('div','k',T.none));return}
var k=e('div','k',T.found+' '+o.n+', '+T.best);k.style.margin='4px 2px';box.appendChild(k);
o.h.forEach(function(r){var b=e('button','h');var d=e('div');d.appendChild(e('b','',r[0]));d.appendChild(e('span','',T.types[r[3]]+(r[2]?' \\u00b7 '+r[2]+' '+T.sqm:'')));b.appendChild(d);b.appendChild(e('i','',eur(r[1])));
b.onclick=function(){W.openLink('${SITE}/listing/'+r[4]+'?utm_source=tg_widget')};box.appendChild(b)});
var last=(pg+1)*3>=o.n,m=e('button','mb',last?T.again:T.more+' ('+Math.min(o.n,pg*3+3)+' '+T.of+' '+o.n+')');
m.onclick=function(){pg=last?0:pg+1;show()};mo.appendChild(m)},function(){if(me==seq){box.innerHTML='';box.appendChild(e('div','k',T.err))}})}
show();
</script>`;
}

export async function startSite(tg: Tg, chatId: number, lang: Lang) {
  const sent = await tg("sendWidget", { chat_id: chatId, html: siteHtml(lang), allow_queries: true, width: 320, height: 440 });
  if (!sent.ok) await tg("sendMessage", { chat_id: chatId, text: lang === "en" ? "The mini site won't open right now. Try again soon." : "Мини-сайт сейчас не открывается. Попробуйте чуть позже." });
}

/** "q:<region>:<budget>": the best houses for that region and budget, small enough for a widget answer (1024 bytes). */
export async function siteQuery(admin: Admin, tg: Tg, q: Row): Promise<boolean> {
  const m = String(q.data ?? "").match(/^q:(\d):(\d):(\d{1,2})$/);
  if (!m) return false;
  const region = REGIONS[Number(m[1])], budget = BUDGETS[Number(m[2])];
  let s = admin.from("listing_feed").select("id, comune, price_eur, surface_sqm, property_type", { count: "exact" })
    .eq("is_demo", false).eq("is_scrap", false).eq("has_real_photo", true).not("status", "in", "(closed,withdrawn)")
    .in("sale_type", SALE).in("property_type", TYPES).gte("price_eur", 1000).lte("price_eur", budget).gte("score", 55);
  if (region) s = s.eq("region", region);
  const { data, count } = await s.order("score", { ascending: false, nullsFirst: false }).range(Number(m[3]) * 3, Number(m[3]) * 3 + 2);
  const h = (data ?? []).map((r) => [String(r.comune ?? "").slice(0, 24), Math.round(Number(r.price_eur)), r.surface_sqm ? Math.round(Number(r.surface_sqm)) : 0, Math.max(0, TYPES.indexOf(String(r.property_type))), r.id]);
  await tg("answerWidgetQuery", { widget_query_id: q.id, data: JSON.stringify({ n: count ?? h.length, h }) });
  return true;
}

const RU_REG: Record<string, string> = { тоскана: "Toscana", апулия: "Puglia", сицилия: "Sicilia", абруццо: "Abruzzo", калабрия: "Calabria", пьемонт: "Piemonte", лигурия: "Liguria", сардиния: "Sardegna", умбрия: "Umbria", марке: "Marche", ломбардия: "Lombardia", базиликата: "Basilicata", молизе: "Molise", кампания: "Campania", лацио: "Lazio" };
const SB = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/$/, "");
const img = (p: string | null) => (!p ? undefined : /^https?:\/\//.test(p) ? p : `${SB}/storage/v1/object/public/listing-images/${p}`);

/** Inline mode: @odysstay_bot toscana 50000 gives house cards anyone can drop into any chat. */
export async function inlineResults(admin: Admin, text: string, lang: Lang) {
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  let region: string | null = null, budget = 150000;
  for (const w of words) {
    const n = Number(w.replace(/[^\d]/g, ""));
    if (n >= 1000 || (n > 0 && /[kк]$/.test(w))) budget = /[kк]$/.test(w) && n < 1000 ? n * 1000 : n;
    else if (RU_REG[w]) region = RU_REG[w];
    else if (w.length > 3) { const hit = REGIONS.find((r) => r && r.toLowerCase().startsWith(w.slice(0, 5))); if (hit) region = hit; }
  }
  let s = admin.from("listing_feed").select("id, comune, region, price_eur, surface_sqm, hero_image_path")
    .eq("is_demo", false).eq("is_scrap", false).eq("has_real_photo", true).not("status", "in", "(closed,withdrawn)")
    .in("sale_type", SALE).in("property_type", TYPES).gte("price_eur", 1000).lte("price_eur", budget).gte("score", 55);
  if (region) s = s.eq("region", region);
  const { data } = await s.order("score", { ascending: false, nullsFirst: false }).limit(region ? 12 : 90);
  const ru = lang === "ru";
  const rows = (data ?? []) as Row[];
  const fmt = (h: Row) => `€${Number(h.price_eur).toLocaleString(ru ? "ru-RU" : "en-US")}${h.surface_sqm ? ` · ${Math.round(Number(h.surface_sqm))} м²` : ""}`;
  const link = (h: Row) => `${SITE}/listing/${h.id}?utm_source=tg_inline`;
  const BOT = [{ text: ru ? "Дома в Италии: @odysstay_bot" : "Houses in Italy: @odysstay_bot", url: "https://t.me/odysstay_bot" }];
  const RN: Record<string, string> = Object.fromEntries(Object.entries(RU_REG).map(([k, v]) => [v, k[0].toUpperCase() + k.slice(1)]));
  // A pack: the three best houses of one region in one message.
  const pack = (reg: string, hs: Row[]) => ({
    type: "article", id: `pack_${reg}`, title: ru ? `3 лучших дома: ${RN[reg] ?? reg}` : `Top 3 houses: ${reg}`,
    description: hs.map((h) => `${h.comune} ${fmt(h).split(" · ")[0]}`).join(", "),
    thumbnail_url: img(hs[0].hero_image_path as string | null),
    input_message_content: { message_text: `${ru ? "Три лучших дома" : "Three best houses"}: ${RN[reg] ?? reg}\n\n${hs.map((h, i) => `${i + 1}. ${h.comune}\n${fmt(h)}`).join("\n\n")}`, link_preview_options: { is_disabled: true } },
    reply_markup: { inline_keyboard: [...hs.map((h, i) => [{ text: `${i + 1}. ${h.comune}, ${fmt(h).split(" · ")[0]}`, url: link(h) }]), BOT] },
  });
  const packs: Row[] = [];
  if (region) { if (rows.length >= 3) packs.push(pack(region, rows.slice(0, 3))); }
  else {
    const by = new Map<string, Row[]>();
    for (const h of rows) { const r = String(h.region); if (!by.has(r)) by.set(r, []); by.get(r)!.push(h); }
    for (const [r, hs] of by) if (hs.length >= 3 && packs.length < 6) packs.push(pack(r, hs.slice(0, 3)));
  }
  const cards = rows.slice(0, 12).map((h) => ({
    type: "article", id: String(h.id), title: `${h.comune}, ${h.region}`, description: fmt(h),
    thumbnail_url: img(h.hero_image_path as string | null),
    input_message_content: { message_text: `${h.comune}, ${h.region}\n${fmt(h)}\n${link(h)}`, link_preview_options: { url: link(h), prefer_large_media: true, show_above_text: true } },
    reply_markup: { inline_keyboard: [[{ text: ru ? "Смотреть дом" : "See the house", url: link(h) }], BOT] },
  }));
  return [...packs, ...cards].slice(0, 20);
}
