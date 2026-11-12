// A mini Odysstay inside a message: a Telegram widget with two tabs. "Houses" lets you pick a region and a budget and
// shows the best matching listings from our database, each one opens on the site. "Costs" shows what a house really
// costs once taxes, notary and agency are in. Widgets work in private chats only (Bot API 10.4).
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
    sub: "Дома в Италии, которые стоят своих денег", tabs: ["Дома", "Расходы"],
    reg: ["Все", "Тоскана", "Апулия", "Сицилия", "Абруццо", "Калабрия", "Пьемонт", "Лигурия"],
    bud: ["до 30к", "до 70к", "до 150к", "любой"], found: "Найдено", best: "лучшие по оценке", none: "Пока ничего, попробуйте шире", load: "Ищу", err: "Не вышло, ещё раз",
    types: ["Дом", "Сельский дом", "Квартира", "Здание"], sqm: "м²", open: "Открыть на сайте",
    price: "Цена дома", tax: "Налоги и регистрация", notary: "Нотариус и проверка", agency: "Агентство", all: "Итого", note: "Оценка. Точные цифры скажет нотариус.",
    sell: "Больше домов и разбор каждого", site: "odysstay.xyz",
  },
  en: {
    sub: "Houses in Italy worth their price", tabs: ["Houses", "Costs"],
    reg: ["All", "Tuscany", "Puglia", "Sicily", "Abruzzo", "Calabria", "Piedmont", "Liguria"],
    bud: ["to 30k", "to 70k", "to 150k", "any"], found: "Found", best: "best by score", none: "Nothing yet, try wider", load: "Searching", err: "Didn't work, try again",
    types: ["House", "Country house", "Apartment", "Building"], sqm: "m²", open: "Open on the site",
    price: "House price", tax: "Taxes and registration", notary: "Notary and checks", agency: "Agency", all: "Total", note: "An estimate. The notary confirms the exact figures.",
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
.tb{display:flex;background:var(--soft);border-radius:10px;padding:3px;margin:10px 0}
.tb button{flex:1;border:0;background:none;color:var(--mut);font:600 14px -apple-system,system-ui,sans-serif;height:30px;border-radius:8px}
.tb button.on{background:var(--bg);color:var(--ink);box-shadow:0 1px 3px #0002}
.g{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:6px}
.g button{border:1px solid var(--ln);background:none;color:var(--ink);font:13px -apple-system,system-ui,sans-serif;height:32px;border-radius:16px;padding:0}
.g button.on{background:var(--ink);color:var(--bg);border-color:var(--ink)}
.h{display:flex;justify-content:space-between;align-items:center;border:0;border-top:1px solid var(--ln);background:none;color:var(--ink);width:100%;text-align:left;padding:10px 2px;font:inherit}
.h b{font:400 17px Georgia,serif}
.h span{font-size:12px;color:var(--mut);display:block;margin-top:2px}
.h i{font:400 17px Georgia,serif;font-style:normal;color:var(--te)}
.cf{display:flex;justify-content:space-between;padding:7px 2px;border-top:1px solid var(--ln);font-size:14px}
.cf.t{font:400 20px Georgia,serif;border-top:2px solid var(--ink);margin-top:4px;padding-top:10px}
.v{font:400 38px/1 Georgia,serif;letter-spacing:-1px;text-align:center;margin:14px 0 6px}
.tr{position:relative;height:36px;margin:2px 16px 12px;touch-action:none}
.tr i{position:absolute;left:0;right:0;top:16px;height:4px;border-radius:2px;background:var(--ln)}
.tr b{position:absolute;top:16px;left:0;height:4px;border-radius:2px;background:var(--ac)}
.tr u{position:absolute;top:4px;width:28px;height:28px;margin-left:-14px;border-radius:50%;background:#fff;box-shadow:0 1px 2px #0003,0 3px 10px #0002}
.ft{position:absolute;left:0;right:0;bottom:12px;text-align:center}`;

function siteHtml(l: Lang) {
  const s = S[l];
  return `<style>${CSS}</style><div id=a></div><script>
var T=${JSON.stringify(s)},W=TelegramWidget,A=document.getElementById('a'),tab=0,rg=0,bd=1,pos=.5,seq=0;
document.documentElement.className=W.colorScheme;
function e(t,c,x){var n=document.createElement(t);if(c)n.className=c;if(x!=null)n.textContent=x;return n}
function eur(v){return '\\u20ac'+String(Math.round(v)).replace(/\\B(?=(\\d{3})+$)/g,'\\u2009')}
function rd(n){return Math.round(n/100)*100}
function shell(){A.innerHTML='';var h=e('div','hd');h.appendChild(e('div','lo','Odysstay'));h.appendChild(e('div','k',T.sub.split(',')[0]));A.appendChild(h);
var b=e('div','tb');T.tabs.forEach(function(t,i){var x=e('button',i==tab?'on':'',t);x.onclick=function(){tab=i;show()};b.appendChild(x)});A.appendChild(b);return A}
function chips(arr,cur,fn){var g=e('div','g');arr.forEach(function(t,i){var b=e('button',i==cur?'on':'',t);b.onclick=function(){fn(i)};g.appendChild(b)});A.appendChild(g)}
function foot(){var f=e('div','ft k',T.sell+' \\u00b7 '+T.site);A.appendChild(f)}
function show(){shell();tab?costs():homes()}
var box;
function homes(){chips(T.reg,rg,function(i){rg=i;show()});chips(T.bud,bd,function(i){bd=i;show()});
box=e('div');A.appendChild(box);foot();box.appendChild(e('div','k',T.load+'\\u2026'));var me=++seq;
W.request('q:'+rg+':'+bd).then(function(a){if(me!=seq||tab)return;var o=JSON.parse(a.result);box.innerHTML='';
if(!o.h.length){box.appendChild(e('div','k',T.none));return}
var k=e('div','k',T.found+' '+o.n+', '+T.best);k.style.margin='4px 2px';box.appendChild(k);
o.h.forEach(function(r){var b=e('button','h');var d=e('div');d.appendChild(e('b','',r[0]));d.appendChild(e('span','',T.types[r[3]]+(r[2]?' \\u00b7 '+r[2]+' '+T.sqm:'')));b.appendChild(d);b.appendChild(e('i','',eur(r[1])));
b.onclick=function(){W.openLink('${SITE}/listing/'+r[4]+'?utm_source=tg_widget')};box.appendChild(b)})},function(){if(me==seq&&!tab){box.innerHTML='';box.appendChild(e('div','k',T.err))}})}
function costs(){var p=Math.round(1e4*Math.pow(40,pos)/500)*500,V=e('div','v');A.appendChild(V);
var t=e('div','tr');t.innerHTML='<i></i><b></b><u></u>';A.appendChild(t);var L=e('div');A.appendChild(L);
function d(){pos=Math.max(0,Math.min(1,pos));p=Math.round(1e4*Math.pow(40,pos)/(pos<.3?500:1e3))*(pos<.3?500:1e3);V.textContent=eur(p);t.children[1].style.width=pos*100+'%';t.children[2].style.left=pos*100+'%';
var x=rd(Math.max(1e3,.054*p)+100),y=600+rd(Math.min(4e3,1500+.01*p)),z=rd(p*.0366);L.innerHTML='';
[[T.price,p],[T.tax,x],[T.notary,y],[T.agency,z]].forEach(function(r){var c=e('div','cf');c.appendChild(e('span','',r[0]));c.appendChild(e('span','',eur(r[1])));L.appendChild(c)});
var c=e('div','cf t');c.appendChild(e('span','',T.all));c.appendChild(e('span','',eur(p+x+y+z)));L.appendChild(c);var n=e('div','k',T.note);n.style.marginTop='8px';L.appendChild(n)}
var dn=0;function at(ev){var r=t.getBoundingClientRect();pos=(ev.clientX-r.left)/r.width;d()}
t.onpointerdown=function(ev){dn=1;try{t.setPointerCapture(ev.pointerId)}catch(x){}at(ev)};t.onpointermove=function(ev){if(dn)at(ev)};t.onpointerup=t.onpointercancel=function(){dn=0};
d();foot()}
show();
</script>`;
}

export async function startSite(tg: Tg, chatId: number, lang: Lang) {
  const sent = await tg("sendWidget", { chat_id: chatId, html: siteHtml(lang), allow_queries: true, width: 320, height: 440 });
  if (!sent.ok) await tg("sendMessage", { chat_id: chatId, text: lang === "en" ? "The mini site won't open right now. Try again soon." : "Мини-сайт сейчас не открывается. Попробуйте чуть позже." });
}

/** "q:<region>:<budget>": the best houses for that region and budget, small enough for a widget answer (1024 bytes). */
export async function siteQuery(admin: Admin, tg: Tg, q: Row): Promise<boolean> {
  const m = String(q.data ?? "").match(/^q:(\d):(\d)$/);
  if (!m) return false;
  const region = REGIONS[Number(m[1])], budget = BUDGETS[Number(m[2])];
  let s = admin.from("listing_feed").select("id, comune, price_eur, surface_sqm, property_type", { count: "exact" })
    .eq("is_demo", false).eq("is_scrap", false).eq("has_real_photo", true).not("status", "in", "(closed,withdrawn)")
    .in("sale_type", SALE).in("property_type", TYPES).gte("price_eur", 1000).lte("price_eur", budget).gte("score", 55);
  if (region) s = s.eq("region", region);
  const { data, count } = await s.order("score", { ascending: false, nullsFirst: false }).limit(3);
  const h = (data ?? []).map((r) => [String(r.comune ?? "").slice(0, 24), Math.round(Number(r.price_eur)), r.surface_sqm ? Math.round(Number(r.surface_sqm)) : 0, Math.max(0, TYPES.indexOf(String(r.property_type))), r.id]);
  await tg("answerWidgetQuery", { widget_query_id: q.id, data: JSON.stringify({ n: count ?? h.length, h }) });
  return true;
}
