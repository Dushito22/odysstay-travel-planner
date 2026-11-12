// Two games inside the Argos bot, built as Telegram widgets (Bot API 10.4 HTML widgets):
// "Guess the price" and "Where is this house?". The photo goes as a normal photo, the widget under it holds
// the game. The answer never leaves the server until the player has sent a guess. Widgets work in private chats only.
import { adminClient } from "../_shared/runtime.ts";

type Admin = ReturnType<typeof adminClient>;
type Row = Record<string, unknown>;
type Tg = (method: string, body: Record<string, unknown>) => Promise<Record<string, any>>;
export type Kind = "price" | "where";

const SB = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/$/, "");
const SITE = (Deno.env.get("SITE_URL") || "https://odysstay.xyz").replace(/\/$/, "");
const photo = (p: string | null) => (!p ? null : /^https?:\/\//.test(p) ? p : `${SB}/storage/v1/object/public/listing-images/${p}`);

// Map of Italy: equirectangular, 40 units per degree of latitude. Same maths in the widget and here.
const LON0 = 6.5, LAT0 = 47.1, COS = 0.7431, K = 40, MW = 366, MH = 425;
const ITALY = "M16 47l3 2l8 -2l4 -2l9 2l2 -2l2 -1l1 -4l3 -1l0 -3l-1 -3l6 -4l1 -2l2 -1l2 1l0 8l4 4l7 1l0 1l-2 4l4 1l0 5l3 0l2 -3l-2 -3l0 -3l7 -7l1 -4l-1 -4l2 -3l3 1l1 -1l0 5l3 3l4 0l2 -2l6 -1l4 6l3 -2l-2 -2l1 -3l-3 -2l0 -3l2 -3l3 -1l3 3l4 0l1 -3l-3 -2l2 -8l6 0l3 2l0 2l8 0l5 -8l7 0l2 -1l8 1l13 -4l0 1l-2 2l0 4l4 1l1 4l2 0l1 3l25 6l7 -1l7 2l-1 3l-2 0l-7 6l1 4l2 -1l5 2l-5 7l1 1l4 0l-2 6l6 3l4 5l-2 2l-4 -1l3 -1l-7 -7l-1 2l1 1l-5 2l1 -2l-2 -1l-7 -1l-2 3l3 0l-2 2l-4 1l-16 8l0 -2l3 -1l2 -2l-2 1l0 -2l-2 3l-2 -2l1 2l-3 0l-3 8l-2 -1l1 3l1 -2l0 4l3 -1l0 5l0 -1l-1 1l2 1l0 3l0 -3l5 4l-2 6l0 -3l-1 0l-1 4l-3 -2l-1 1l0 6l3 17l9 10l8 3l10 9l6 4l2 -1l3 3l9 30l4 8l15 15l4 2l1 4l13 6l8 1l17 -2l4 1l1 5l-9 7l1 6l20 11l14 5l6 4l6 6l5 2l11 5l1 4l6 4l6 7l2 7l-3 5l-1 6l-1 1l-8 -4l-2 -4l0 -1l-1 -1l1 -2l-4 -7l-14 -2l-6 -4l1 -1l0 -1l3 -1l-4 1l-4 -2l-3 1l-11 17l1 4l-4 8l2 5l7 2l11 8l-2 5l1 3l0 4l2 3l-1 3l-2 2l-4 -2l-4 1l-8 6l-1 3l1 11l-7 5l-5 6l-2 8l-10 1l-2 -1l-1 -2l-1 -9l6 -3l2 -7l1 -3l-2 -4l4 -3l6 -1l1 -6l-4 -7l-2 -11l-1 -4l-4 -5l-2 -13l-5 -7l-2 0l-4 3l-5 -1l0 -2l-4 -4l-2 0l-4 -3l1 -3l2 -1l0 -2l-7 -11l-7 2l-2 0l-4 2l0 -2l4 -3l0 -1l-5 -5l-3 2l-4 -1l0 2l-1 -1l0 -5l-5 -9l-4 -4l-4 0l-2 2l-7 -4l-7 3l-5 -7l-8 -2l-5 -7l-6 -4l-2 -6l-5 -5l-3 -2l-3 1l-5 -10l-8 -5l-5 -1l-1 2l-2 -1l-1 -1l3 -1l0 -1l-1 -4l-6 -7l-6 -2l1 -4l-1 -1l-3 -1l-4 0l1 -12l-7 -10l-2 -14l-4 -7l-8 -3l0 2l-18 -12l0 2l-4 -3l-10 -2l-9 5l-1 4l-5 3l-2 7l-3 2l-11 4l-6 0l0 -3l5 -8l-1 -4l-9 2l-11 -5l-3 -5l1 -2l-2 -4l3 -4l1 -2l2 0l-1 -6l-8 -3l0 -5l-3 0l-1 -3l4 -2l3 1l4 -3l2 -1l2 -1l0 -3l2 -3l-6 -4l0 -6l-5 -2l-1 -3l1 -2l4 -1zM268 352l4 1l-2 2l-2 6l-9 13l-1 7l-2 3l0 6l4 4l0 1l-1 0l0 -1l-1 2l4 4l-1 2l1 2l-5 3l-2 5l2 4l-2 2l-2 -2l-4 -1l-3 1l-9 -4l-3 -7l-5 -4l-3 -2l-6 1l-10 -7l-4 -2l-8 -6l-4 -1l-2 -3l-9 0l-2 -2l-3 -2l-2 -5l1 -1l1 -8l5 -4l1 1l1 -4l5 7l5 -2l1 -5l3 1l4 -2l2 5l3 0l5 4l4 1l7 -3l7 1l7 -1l4 -1l3 -3l5 -2l5 3l3 -1l2 -5l0 2l1 1zM98 262l1 1l-1 3l-5 7l1 5l2 3l-4 29l1 2l-1 1l-1 5l-1 2l-7 -5l-2 0l-2 2l-4 -4l2 2l-2 3l0 6l-5 5l-4 -2l-2 2l-3 -7l-2 -1l-3 -6l1 -3l-1 -3l2 -8l0 -7l3 2l-1 -1l1 -6l-3 -2l0 3l-1 -2l-1 -5l3 -3l0 -8l-3 -2l0 -4l-3 -6l-2 1l-1 -2l-1 2l0 -2l2 -3l-2 -1l2 -6l-1 -2l1 -2l2 4l7 2l9 -5l5 -7l5 -1l0 -4l2 -1l2 3l0 -1l0 1l1 0l3 1l0 3l1 -2l3 1l-1 4l1 1l3 0l-2 0l-1 3l-2 0l4 0l0 1l3 2l-2 2zM117 170l-1 3l0 3l-2 -3l-6 2l-1 -2l2 -2l6 1l1 -3z";
const toXY = (lat: number, lon: number) => [Math.round((lon - LON0) * COS * K * 10) / 10, Math.round((LAT0 - lat) * K * 10) / 10];
const fromXY = (x: number, y: number) => [LAT0 - y / K, LON0 + x / (COS * K)];
const km = (a: number[], b: number[]) => {
  const r = Math.PI / 180, dLat = (b[0] - a[0]) * r, dLon = (b[1] - a[1]) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};
const CITIES: [string, string, number, number][] = [
  ["Милан", "Milan", 45.46, 9.19], ["Турин", "Turin", 45.07, 7.69], ["Венеция", "Venice", 45.44, 12.33], ["Флоренция", "Florence", 43.77, 11.26],
  ["Рим", "Rome", 41.9, 12.5], ["Неаполь", "Naples", 40.85, 14.27], ["Бари", "Bari", 41.12, 16.87], ["Палермо", "Palermo", 38.12, 13.36], ["Кальяри", "Cagliari", 39.22, 9.12],
];

const S = {
  ru: {
    price: "Ваша цена", tap: "Коснитесь шкалы или ведите пальцем", go: "Угадать", real: "Цена на самом деле", you: "Вы", house: "Дом", pts: "очков", total: "всего",
    houses: "домов", next: "Ещё дом", wait: "Секунду", err: "Не вышло, ещё раз",
    t: ["Как будто сами продавали", "Глаз намётан", "Неплохо", "Италия умеет удивлять"],
    where: "Где этот дом?", pin: "Коснитесь карты, чтобы поставить метку", miss: "Вы промахнулись на", kmu: "км", bull: "В точку",
    type: { house: "Дом", rural_house: "Загородный дом" } as Record<string, string>, sqm: "м²", look: "Смотреть этот дом",
    other: { price: "Другая игра: где этот дом?", where: "Другая игра: угадай цену" },
    fail: "Игра сейчас не открывается. Попробуйте чуть позже.", empty: "Домов для игры пока нет, загляните позже.",
    pick: "Выберите игру", pPrice: "Угадай цену", pWhere: "Где этот дом?",
  },
  en: {
    price: "Your price", tap: "Tap the scale or drag", go: "Guess", real: "Actual price", you: "You", house: "House", pts: "points", total: "total",
    houses: "houses", next: "Another house", wait: "One moment", err: "Didn't work, try again",
    t: ["Could have sold it yourself", "Sharp eye", "Not bad", "Italy loves to surprise"],
    where: "Where is this house?", pin: "Tap the map to drop a pin", miss: "You missed by", kmu: "km", bull: "Spot on",
    type: { house: "House", rural_house: "Country house" } as Record<string, string>, sqm: "m²", look: "See this house",
    other: { price: "Other game: where is this house?", where: "Other game: guess the price" },
    fail: "The game won't open right now. Try again soon.", empty: "No houses for the game yet, check back later.",
    pick: "Pick a game", pPrice: "Guess the price", pWhere: "Where is this house?",
  },
};
type Lang = keyof typeof S;

/** Price: points by how far off, on a ratio scale (10% off is about 90, 2x off is about 25). */
export const scorePrice = (guess: number, real: number) => Math.round(100 * Math.max(0, 1 - Math.abs(Math.log(guess / real)) / Math.log(2.5)));
/** Location: points fall with distance (50 km about 82, 150 km about 56, 500 km about 15). */
export const scoreWhere = (d: number) => Math.round(100 * Math.exp(-d / 260));

const CSS = `:root{--bg:#fff;--ink:#1b1916;--mut:#8a857b;--ln:#e7e2d8;--ac:#2f6fa8;--te:#c0613a;--soft:#f3efe6;--sea:#e8eef2}
.dark{--bg:#12181f;--ink:#f2ede3;--mut:#8f8a80;--ln:#2a343e;--ac:#7db6e8;--te:#e58f68;--soft:#1d2730;--sea:#0d1319}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
body{margin:0;background:var(--bg);color:var(--ink);font:15px -apple-system,system-ui,sans-serif;overflow:hidden}
#a{display:flex;flex-direction:column;align-items:center;justify-content:center}
.k{font-size:13px;color:var(--mut);letter-spacing:.01em}
.s{font:400 20px/1.1 Georgia,serif;letter-spacing:-.3px}
.b{font:600 16px -apple-system,system-ui,sans-serif;border:0;border-radius:24px;background:var(--ink);color:var(--bg);height:48px;width:240px;transition:transform .12s,opacity .2s}
.b:active{transform:scale(.97)}.b:disabled{opacity:.35}
`;
const CSSP = `.v{font:400 46px/1 Georgia,'Times New Roman',serif;letter-spacing:-1.5px;margin:6px 0 2px}
.c{width:36px;height:36px;border-radius:18px;border:0;background:var(--soft);color:var(--ink);font:300 22px/36px system-ui;padding:0}
.c:active{transform:scale(.92)}`;

function priceHtml(l: Lang) {
  const s = S[l];
  return `<style>${CSS}${CSSP}
body,#a{height:284px}
.tr{position:relative;height:40px;width:196px;touch-action:none}
.tr i,.tr b{position:absolute;left:0;top:18px;height:4px;border-radius:2px;background:var(--ln)}.tr i{right:0}
.tr b{background:var(--ac)}
.tr u{position:absolute;top:6px;width:28px;height:28px;margin-left:-14px;border-radius:50%;background:#fff;box-shadow:0 1px 2px #0003,0 3px 10px #0002}
.tr s{position:absolute;top:10px;width:20px;height:20px;margin-left:-10px;border-radius:50%;background:var(--te);border:3px solid var(--bg);box-shadow:0 1px 5px #0003}
.tr em{position:absolute;top:10px;width:20px;height:20px;margin-left:-10px;border-radius:50%;background:var(--ac);border:3px solid var(--bg);box-shadow:0 1px 5px #0003}
.tr q{position:absolute;top:19px;height:2px;background:var(--mut);opacity:.5}
.r{display:flex;align-items:center;gap:6px;margin:2px 0 12px}
.n{font:400 40px/1 Georgia,serif;letter-spacing:-1px;margin-top:8px}
.n small{font:13px -apple-system,system-ui,sans-serif;letter-spacing:0;color:var(--mut)}
.lg{display:flex;gap:14px;font-size:12px;color:var(--mut);margin:0 0 4px}
.lg b{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:5px}
</style><div id=a></div><script>
var T=${JSON.stringify(s)},W=TelegramWidget,A=document.getElementById('a'),lo=5e3,hi=4e5,pos=.45;
document.documentElement.className=W.colorScheme;
function val(p){var v=lo*Math.pow(hi/lo,p),st=v<2e4?500:v<1e5?1e3:5e3;return Math.round(v/st)*st}
function pp(v){return Math.max(0,Math.min(1,Math.log(v/lo)/Math.log(hi/lo)))}
function eur(v){return '\\u20ac'+String(Math.round(v)).replace(/\\B(?=(\\d{3})+$)/g,'\\u2009')}
function game(){
A.innerHTML='<div class=k>'+T.price+'</div><div class=v id=v></div><div class=k style="margin-bottom:6px">'+T.tap+'</div><div class=r><button class=c id=m>\\u2212</button><div class=tr id=t><i></i><b id=f></b><u id=k></u></div><button class=c id=n>+</button></div><button class=b id=g>'+T.go+'</button>';
var V=document.getElementById('v'),F=document.getElementById('f'),K=document.getElementById('k'),B=document.getElementById('g'),H=document.getElementById('t'),last=0,dn=0;
function d(){pos=Math.max(0,Math.min(1,pos));var x=val(pos);V.textContent=eur(x);F.style.width=pos*100+'%';K.style.left=pos*100+'%';if(x!=last){last=x;W.HapticFeedback&&W.HapticFeedback.selectionChanged()}}
function at(e){var r=H.getBoundingClientRect();pos=(e.clientX-r.left)/r.width;d()}
d();
H.onpointerdown=function(e){dn=1;try{H.setPointerCapture(e.pointerId)}catch(x){}at(e)};
H.onpointermove=function(e){if(dn)at(e)};H.onpointerup=H.onpointercancel=function(){dn=0};
document.getElementById('m').onclick=function(){pos-=.025;d()};
document.getElementById('n').onclick=function(){pos+=.025;d()};
B.onclick=function(){B.disabled=true;B.textContent=T.wait;var g=val(pos);
W.request('g:'+g).then(function(a){res(JSON.parse(a.result))},function(){B.disabled=false;B.textContent=T.err})}}
function res(o){
var i=o.s>=90?0:o.s>=70?1:o.s>=40?2:3,a=pp(o.p)*100,b=pp(o.g)*100;
A.innerHTML='<div class=k>'+T.real+'</div><div class=v>'+eur(o.p)+'</div><div class=tr style="width:240px;margin:8px 0 2px"><i></i><q style="left:'+Math.min(a,b)+'%;width:'+Math.abs(a-b)+'%"></q><s style="left:'+a+'%"></s><em style="left:'+b+'%"></em></div><div class=lg><span><b style="background:var(--te)"></b>'+T.house+'</span><span><b style="background:var(--ac)"></b>'+T.you+' '+eur(o.g)+'</span></div><div class=n>+'+o.s+' <small>'+T.pts+', '+T.t[i].toLowerCase()+'</small></div><div class=k style="margin:2px 0 12px">'+T.total+' '+o.t+' / '+o.n+' '+T.houses+'</div><button class=b id=x>'+T.next+'</button>';
W.HapticFeedback&&W.HapticFeedback.notificationOccurred(o.s>=70?'success':'warning');
var X=document.getElementById('x');X.onclick=function(){X.disabled=true;X.textContent=T.wait;W.request('n').then(function(){X.textContent='\\u2713'},function(){X.disabled=false;X.textContent=T.err})}}
var c=null;try{c=JSON.parse(W.chatData)}catch(e){}
if(c&&c.p)res(c);else game();
</script>`;
}

function whereHtml(l: Lang) {
  const s = S[l];
  const cities = CITIES.map((c) => [c[l === "ru" ? 0 : 1], ...toXY(c[2], c[3])]);
  return `<style>${CSS}
body,#a{height:472px}
#a{justify-content:flex-start;padding-top:16px}
.h{height:44px;text-align:center}
.h .s{margin-bottom:5px}
svg{display:block;width:276px;height:${Math.round((276 * MH) / MW)}px;border-radius:16px;background:var(--sea);touch-action:none;margin-top:6px}
.land{fill:var(--soft);stroke:var(--ln)}
.p{transform-box:fill-box;transform-origin:center;animation:pl 1.8s ease-out infinite}
@keyframes pl{0%{transform:scale(1);opacity:.55}100%{transform:scale(3.2);opacity:0}}
.ct{fill:var(--mut);font-family:-apple-system,system-ui,sans-serif}
</style><div id=a></div><script>
var T=${JSON.stringify({ where: s.where, pin: s.pin, go: s.go, wait: s.wait, err: s.err, next: s.next, miss: s.miss, kmu: s.kmu, bull: s.bull, pts: s.pts, total: s.total, houses: s.houses })},C=${JSON.stringify(cities)},D=${JSON.stringify(ITALY)},W=TelegramWidget,A=document.getElementById('a'),NS='http://www.w3.org/2000/svg',MW=${MW},MH=${MH};
document.documentElement.className=W.colorScheme;
function el(n,at,p){var e=document.createElementNS(NS,n);for(var k in at)e.setAttribute(k,at[k]);if(p)p.appendChild(e);return e}
function mk(){
A.innerHTML='<div class=h><div class=s id=ti></div><div class=k id=su></div></div>';
var sv=el('svg',{viewBox:'0 0 '+MW+' '+MH});A.appendChild(sv);
var ld=el('path',{d:D,class:'land'},sv),cg=el('g',{class:'ct'},sv),pg=el('g',{},sv),vb=[0,0,MW,MH];
var ct=C.map(function(c){return[el('circle',{cx:c[1],cy:c[2],fill:'var(--mut)'},cg),el('text',{x:c[1]+5,y:c[2]+3},cg)]});
C.forEach(function(c,i){ct[i][1].textContent=c[0]});
function view(){var s=vb[2]/276;sv.setAttribute('viewBox',vb.join(' '));ld.style.strokeWidth=s*.8;cg.style.fontSize=(10*s)+'px';
ct.forEach(function(c){c[0].setAttribute('r',2*s);c[1].setAttribute('x',+c[0].getAttribute('cx')+5*s);c[1].setAttribute('y',+c[0].getAttribute('cy')+3.5*s)});return s}
view();return{sv:sv,pg:pg,vb:vb,view:view,el:el}}
function pin(g,x,y,col,s,pulse){g.innerHTML='';if(pulse)el('circle',{cx:x,cy:y,r:7*s,fill:col,class:'p'},g);el('circle',{cx:x,cy:y,r:7*s,fill:col,stroke:'#fff','stroke-width':2.2*s},g)}
function play(){
var m=mk(),sv=m.sv,gx=null,gy=null;
document.getElementById('ti').textContent=T.where;document.getElementById('su').textContent=T.pin;
var f=document.createElement('div');f.style.cssText='margin-top:12px';f.innerHTML='<button class=b id=g disabled>'+T.go+'</button>';A.appendChild(f);
var B=document.getElementById('g');
function put(e){var r=sv.getBoundingClientRect();gx=Math.round((e.clientX-r.left)/r.width*MW);gy=Math.round((e.clientY-r.top)/r.height*MH);
pin(m.pg,gx,gy,'var(--ac)',1,1);B.disabled=false;W.HapticFeedback&&W.HapticFeedback.impactOccurred('light')}
var dn=0;sv.onpointerdown=function(e){dn=1;try{sv.setPointerCapture(e.pointerId)}catch(x){}put(e)};
sv.onpointermove=function(e){if(dn)put(e)};sv.onpointerup=sv.onpointercancel=function(){dn=0};
B.onclick=function(){B.disabled=true;B.textContent=T.wait;
W.request('l:'+gx+','+gy).then(function(a){reveal(m,JSON.parse(a.result),1)},function(){B.disabled=false;B.textContent=T.err})}}
function reveal(m,o,anim){
document.getElementById('ti').textContent=o.tw;
document.getElementById('su').textContent=o.d<4?T.bull:T.miss+' '+o.d+' '+T.kmu+', +'+o.s+' '+T.pts;
var fx=A.lastChild;fx.style.cssText='margin-top:12px;text-align:center';fx.innerHTML='<div class=k style="margin-bottom:6px">'+T.total+' '+o.t+' / '+o.n+' '+T.houses+'</div><button class=b id=x>'+T.next+'</button>';
var vb=m.vb,x0=Math.min(o.x,o.gx),x1=Math.max(o.x,o.gx),y0=Math.min(o.y,o.gy),y1=Math.max(o.y,o.gy),q=276/${Math.round((276 * MH) / MW)};
var w=Math.max(110,(x1-x0)*1.9),h=Math.max(w/q,(y1-y0)*1.9);w=h*q;
var tx=Math.max(0,Math.min(MW-w,(x0+x1)/2-w/2)),ty=Math.max(0,Math.min(MH-h,(y0+y1)/2-h/2));
if(w>MW){w=MW;h=MH;tx=0;ty=0}
var from=vb.slice(),to=[tx,ty,w,h],t0=Date.now();
function draw(){var k=anim?Math.min(1,(Date.now()-t0)/900):1,e=1-Math.pow(1-k,3);
for(var j=0;j<4;j++)vb[j]=from[j]+(to[j]-from[j])*e;var s=m.view();m.pg.innerHTML='';
if(o.d>=4)el('line',{x1:o.gx,y1:o.gy,x2:o.x,y2:o.y,stroke:'var(--mut)','stroke-width':1.4*s,'stroke-dasharray':(4*s)+' '+(4*s)},m.pg);
pin(m.pg,o.gx,o.gy,'var(--ac)',s);var g2=el('g',{},m.pg);pin(g2,o.x,o.y,'var(--te)',s,k>=1);
if(k<1)requestAnimationFrame(draw)}
draw();W.HapticFeedback&&W.HapticFeedback.notificationOccurred(o.s>=60?'success':'warning');
var X=document.getElementById('x');X.onclick=function(){X.disabled=true;X.textContent=T.wait;W.request('n').then(function(){X.textContent='\\u2713'},function(){X.disabled=false;X.textContent=T.err})}}
var c=null;try{c=JSON.parse(W.chatData)}catch(e){}
if(c&&c.s!=null){var m=mk();var f=document.createElement('div');A.appendChild(f);reveal(m,c,0)}else play();
</script>`;
}

async function stats(admin: Admin, chatId: number, kind: Kind) {
  const { data } = await admin.from("tg_games").select("points").eq("chat_id", chatId).eq("kind", kind).not("answered_at", "is", null);
  const pts = (data ?? []).map((r) => Number(r.points ?? 0));
  return { t: pts.reduce((a, b) => a + b, 0), n: pts.length };
}

/** The menu: two games, one tap each. */
export async function menu(tg: Tg, chatId: number, lang: Lang) {
  const s = S[lang] ?? S.ru;
  await tg("sendMessage", { chat_id: chatId, text: s.pick, reply_markup: { inline_keyboard: [[{ text: s.pPrice, callback_data: "g:price" }], [{ text: s.pWhere, callback_data: "g:where" }]] } });
}

/** Sends one round: the photo, then the widget. `only` pins a specific house (from the channel post). */
export async function startRound(admin: Admin, tg: Tg, chatId: number, lang: Lang, kind: Kind = "price", only?: string) {
  const s = S[lang] ?? S.ru;
  const { data: played } = await admin.from("tg_games").select("listing_id").eq("chat_id", chatId).eq("kind", kind);
  const seen = new Set((played ?? []).map((p) => p.listing_id as string));
  let r: Row | null = null;
  const cols = "id, comune, region, price_eur, surface_sqm, property_type, hero_image_path, lat, lng";
  if (only && kind === "price") {
    const { data } = await admin.from("listing_feed").select(cols).eq("id", only).maybeSingle();
    if (data && !seen.has(only)) r = data as Row;
  }
  if (!r) {
    let q = admin.from("listing_feed").select(cols)
      .eq("is_demo", false).eq("is_scrap", false).eq("has_real_photo", true).not("status", "in", "(closed,withdrawn)")
      .eq("sale_type", "sale").in("property_type", ["house", "rural_house"]).gte("price_eur", 8000).lte("price_eur", 250000)
      .gte("score", 55).not("hero_image_path", "is", null);
    if (kind === "where") q = q.not("lat", "is", null).not("lng", "is", null);
    const { data } = await q.order("created_at", { ascending: false }).limit(150);
    const list = (data ?? []).filter((x) => !seen.has(x.id as string));
    r = list.length ? list[Math.floor(Math.random() * list.length)] as Row : null;
  }
  if (!r) { await tg("sendMessage", { chat_id: chatId, text: s.empty }); return; }
  // The price game hides the price, the location game hides the town; the other facts are the clues.
  const facts = kind === "price"
    ? [s.type[r.property_type as string] ?? s.type.house, r.surface_sqm ? `${Math.round(Number(r.surface_sqm))} ${s.sqm}` : null, `${r.comune}, ${r.region}`]
    : [s.type[r.property_type as string] ?? s.type.house, r.surface_sqm ? `${Math.round(Number(r.surface_sqm))} ${s.sqm}` : null, `€${Math.round(Number(r.price_eur)).toLocaleString("en-GB")}`];
  const ph = photo(r.hero_image_path as string | null);
  const caption = facts.filter(Boolean).join(" · ");
  if (ph) await tg("sendPhoto", { chat_id: chatId, photo: ph, caption });
  else await tg("sendMessage", { chat_id: chatId, text: caption });
  const sent = await tg("sendWidget", kind === "price"
    ? { chat_id: chatId, html: priceHtml(lang), allow_queries: true, width: 300, height: 284 }
    : { chat_id: chatId, html: whereHtml(lang), allow_queries: true, width: 300, height: 472 });
  if (!sent.ok) { await tg("sendMessage", { chat_id: chatId, text: s.fail }); return; }
  await admin.from("tg_games").insert({ chat_id: chatId, message_id: sent.result?.message_id ?? null, listing_id: r.id, kind });
}

/** A tap inside the widget. Always answered, within 15 seconds. */
export async function widgetQuery(admin: Admin, tg: Tg, q: Row, lang: (chatId: number) => Promise<Lang>) {
  const chatId = (q.chat as Row | undefined)?.id as number | undefined;
  const messageId = q.message_id as number | undefined;
  const data = String(q.data ?? "");
  const answer = (d?: string) => tg("answerWidgetQuery", { widget_query_id: q.id, ...(d ? { data: d } : {}) });
  if (!chatId || !messageId) { await answer(); return; }
  const l = await lang(chatId);
  const { data: row } = await admin.from("tg_games").select("*").eq("chat_id", chatId).eq("message_id", messageId).maybeSingle();
  if (!row) { await answer(); return; }
  const kind = (row.kind === "where" ? "where" : "price") as Kind;
  if (data === "n") {
    await answer("ok");
    await startRound(admin, tg, chatId, l, kind);
    return;
  }
  const { data: h } = await admin.from("listing_feed").select("price_eur, comune, region, lat, lng").eq("id", row.listing_id).maybeSingle();
  if (!h) { await answer(); return; }
  let out: Row, saved: Row;
  if (kind === "price") {
    const m = data.match(/^g:(\d{3,7})$/);
    const real = Number(h.price_eur);
    if (!m || !real) { await answer(); return; }
    if (row.answered_at && row.result) { await answer(String(row.result)); return; }
    const guess = Number(m[1]), pts = scorePrice(guess, real);
    await admin.from("tg_games").update({ guess, points: pts, answered_at: new Date().toISOString() }).eq("id", row.id);
    const st = await stats(admin, chatId, kind);
    out = { p: Math.round(real), g: guess, s: pts, ...st };
    saved = out;
  } else {
    const m = data.match(/^l:(\d{1,3}),(\d{1,3})$/);
    if (!m || h.lat == null || h.lng == null) { await answer(); return; }
    const [rx, ry] = toXY(Number(h.lat), Number(h.lng));
    const tw = `${h.comune}${h.region ? `, ${h.region}` : ""}`;
    if (row.answered_at && row.result) { await answer(String(row.result)); return; }
    const gx = Math.min(MW, Number(m[1])), gy = Math.min(MH, Number(m[2]));
    const d = Math.round(km(fromXY(gx, gy), [Number(h.lat), Number(h.lng)]));
    const pts = scoreWhere(d);
    await admin.from("tg_games").update({ guess: d, points: pts, answered_at: new Date().toISOString() }).eq("id", row.id);
    const st = await stats(admin, chatId, kind);
    out = { x: rx, y: ry, gx, gy, d, s: pts, tw, ...st };
    saved = out;
  }
  await admin.from("tg_games").update({ result: JSON.stringify(out) }).eq("id", row.id);
  await answer(JSON.stringify(out));
  // Keep the result in the message so it survives reopening the chat, and unlock the link to the house.
  await tg("editMessageWidgetData", { chat_id: chatId, message_id: messageId, chat_data: JSON.stringify(saved) });
  const other = kind === "price" ? "where" : "price";
  await tg("editMessageReplyMarkup", { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [
    [{ text: S[l].look, url: `${SITE}/listing/${row.listing_id}?utm_source=tg_game` }],
    [{ text: S[l].other[kind], callback_data: `g:${other}` }],
  ] } });
}
