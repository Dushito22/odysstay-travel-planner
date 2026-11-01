import { useQuery } from "@tanstack/react-query";
import { Coffee, ExternalLink, Landmark, Plane, ShoppingBasket, TrainFront, Umbrella, Car, Sun, CloudRain, Compass } from "lucide-react";
import type { ReactNode } from "react";

import { ArgosComposer } from "@/components/odys/ArgosComposer";
import { openArgos } from "@/components/odys/ArgosDock";
import { callFunction } from "@/lib/agent";
import { speechLang, useLang } from "@/lib/i18n";
import { AIRPORTS, CITIES, driveMinutes, formatDrive, km, nearest, nearestGems, ruPlace } from "@/lib/places";

type OsmEl = { lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> };

/** One Overpass query for everyday life and the sea. Free, public OpenStreetMap data. */
async function fetchOsm(lat: number, lng: number) {
  const q = `[out:json][timeout:20];(
    nwr["natural"="beach"](around:40000,${lat},${lng});
    nwr["amenity"~"^(restaurant|cafe|bar|pub|ice_cream)$"](around:3000,${lat},${lng});
    nwr["shop"~"^(supermarket|convenience|bakery)$"](around:10000,${lat},${lng});
    nwr["railway"="station"](around:25000,${lat},${lng});
  );out center 300;`;
  // The public Overpass servers are often busy: ask all three, take the first good answer.
  const one = async (host: string) => {
    const r = await fetch(`${host}/api/interpreter`, { method: "POST", body: new URLSearchParams({ data: q }), signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error(`overpass ${r.status}`);
    return ((await r.json()).elements ?? []) as OsmEl[];
  };
  const els = await Promise.any(["https://overpass-api.de", "https://overpass.kumi.systems", "https://overpass.private.coffee"].map(one));
  const pos = (e: OsmEl) => (e.lat != null && e.lon != null ? { lat: e.lat, lon: e.lon } : e.center ?? null);
  const closest = (pred: (t: Record<string, string>) => boolean) => {
    let best: { km: number; name: string | undefined } | null = null;
    for (const e of els) {
      const p = pos(e);
      if (!p || !e.tags || !pred(e.tags)) continue;
      const d = km(lat, lng, p.lat, p.lon);
      if (!best || d < best.km) best = { km: d, name: e.tags["name"] };
    }
    return best;
  };
  const eating = els.filter((e) => e.tags?.["amenity"] && (() => { const p = pos(e); return p && km(lat, lng, p.lat, p.lon) <= 3; })()).length;
  return {
    beach: closest((t) => t["natural"] === "beach"),
    shop: closest((t) => ["supermarket", "convenience"].includes(t["shop"] ?? "")),
    bakery: closest((t) => t["shop"] === "bakery"),
    station: closest((t) => t["railway"] === "station"),
    eating,
  };
}


type Climate = { winterDay: number; winterNight: number; summerDay: number; summerNight: number; rainYear: number; wettest: number };

const MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTHS_RU = ["январе", "феврале", "марте", "апреле", "мае", "июне", "июле", "августе", "сентябре", "октябре", "ноябре", "декабре"];
const KEYS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const DAYS = [31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** 30-year monthly averages for the exact spot, from NASA POWER (public, free, no key).
 * Typical day and night come from the mean temperature and the average daily swing. */
async function fetchClimate(lat: number, lng: number): Promise<Climate> {
  const u = `https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=T2M,T2M_RANGE,PRECTOTCORR&community=RE&longitude=${lng.toFixed(3)}&latitude=${lat.toFixed(3)}&format=JSON`;
  const r = await fetch(u, { signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`climate ${r.status}`);
  const p = (await r.json()).properties?.parameter;
  const t = p?.T2M, rg = p?.T2M_RANGE, rain = p?.PRECTOTCORR;
  if (!t || !rg || !rain || t.JAN == null || t.JAN < -90) throw new Error("climate empty");
  const mm = KEYS.map((k, i) => rain[k] * DAYS[i]!);
  return {
    winterDay: t.JAN + rg.JAN / 2, winterNight: t.JAN - rg.JAN / 2,
    summerDay: t.JUL + rg.JUL / 2, summerNight: t.JUL - rg.JUL / 2,
    rainYear: Math.round(mm.reduce((x, y) => x + y, 0) / 10) * 10,
    wettest: mm.indexOf(Math.max(...mm)),
  };
}

/** One plain line on what the climate means for living there. Only from the numbers. */
function climateNote(c: Climate, ru: boolean) {
  if (c.winterNight <= -1) return ru ? "Настоящая зима: ночью мороз, отопление важнее вида из окна." : "Real winters: frosty nights, so heating matters more than the view.";
  if (c.summerDay >= 32) return ru ? "Жаркое лето: толстые каменные стены и тень здесь не роскошь." : "Hot summers: thick stone walls and shade earn their keep.";
  if (c.winterNight >= 6) return ru ? "Мягкая зима, заморозков почти не бывает." : "Mild winters, frost is rare.";
  if (c.rainYear > 1100) return ru ? "Дождливо: проверьте крышу и сырость стен." : "A wet place: check the roof and the damp.";
  if (c.rainYear < 550) return ru ? "Сухо: полив сада придётся планировать." : "Dry: plan for watering the garden.";
  return null;
}

/** Two questions worth asking about this exact place, from what we know about it. */
function questionsFor(o: { cityKm: number; shore: { name: string; km: number } | undefined; gem: { name: string; km: number } | undefined; climate: Climate | undefined }, ru: boolean) {
  const q: string[] = [];
  if (o.climate && o.climate.winterNight <= 0) q.push(ru ? "Сколько стоит отопление здесь зимой?" : "What does heating cost here in winter?");
  if (o.cityKm > 30) q.push(ru ? "Где ближайший врач и больница?" : "Where are the nearest doctor and hospital?");
  if (o.shore && o.shore.km < 25) q.push(ru ? `Насколько людно в ${o.shore.name} летом?` : `How busy does ${o.shore.name} get in summer?`);
  else if (o.gem && o.gem.km < 30) q.push(ru ? `Стоит ли сдавать дом туристам рядом с ${o.gem.name}?` : `Could I rent it to visitors, with ${o.gem.name} nearby?`);
  q.push(ru ? "Есть ли здесь быстрый интернет?" : "Is there fast internet here?");
  q.push(ru ? "Какие здесь налоги и сбор за мусор?" : "What are the yearly taxes and rubbish fees?");
  return q.slice(0, 3);
}

type Near = { km: number; name?: string } | null;
type Brief = { brief: string | null; facts: Partial<Record<"beach" | "shop" | "bakery" | "station" | "hospital" | "pharmacy" | "school", Near>> & { eating?: number }; sources: { title: string; url: string | null }[] };

type WikiPlace = { pageid: number; title: string; dist: number };

/** Notable places within 10 km and a short introduction to the town, from Wikipedia. */
async function fetchWiki(lat: number, lng: number, comune: string | null, ru = false) {
  const u = `https://en.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${lat}|${lng}&gsradius=10000&gslimit=30&format=json&origin=*`;
  const r = await fetch(u);
  const places: WikiPlace[] = r.ok ? ((await r.json()).query?.geosearch ?? []) : [];
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const town = comune ? places.find((p) => norm(p.title).split(",")[0] === norm(comune)) : undefined;
  let intro: { extract: string; url: string; title: string } | null = null;
  const title = town?.title ?? comune;
  if (title) {
    const s = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
    if (s.ok) {
      const j = await s.json();
      const looksRight = j.type === "standard" && j.extract && (town || /Ital|comune|municipalit/i.test(j.description ?? j.extract));
      if (looksRight) intro = { extract: j.extract, url: j.content_urls?.desktop?.page, title: j.title };
    }
  }
  if (ru) {
    // Same town and sights, from Russian Wikipedia. Anything it does not have is simply left out.
    const ruApi = "https://ru.wikipedia.org/w/api.php";
    intro = null;
    if (title) {
      const ll = await fetch(`https://en.wikipedia.org/w/api.php?action=query&prop=langlinks&lllang=ru&titles=${encodeURIComponent(title)}&format=json&origin=*`);
      const pages = ll.ok ? Object.values((await ll.json()).query?.pages ?? {}) as { langlinks?: { "*": string }[] }[] : [];
      const ruTitle = pages[0]?.langlinks?.[0]?.["*"];
      if (ruTitle) {
        const s = await fetch(`https://ru.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(ruTitle)}`);
        if (s.ok) {
          const j = await s.json();
          if (j.type === "standard" && j.extract) intro = { extract: j.extract, url: j.content_urls?.desktop?.page, title: j.title };
        }
      }
    }
    const rr = await fetch(`${ruApi}?action=query&list=geosearch&gscoord=${lat}|${lng}&gsradius=10000&gslimit=30&format=json&origin=*`);
    const rplaces: WikiPlace[] = rr.ok ? ((await rr.json()).query?.geosearch ?? []) : [];
    const rskip = /^(Список|Римско-католическая|Железнодорожная станция|Станция )/;
    return { intro, sights: rplaces.filter((p) => !rskip.test(p.title) && p.title !== intro?.title).slice(0, 8) };
  }
  const skip = /^(List of|Roman Catholic Diocese|.* railway station$|.* \(Rome Metro\)$)/;
  const sights = places.filter((p) => p.pageid !== town?.pageid && !skip.test(p.title)).slice(0, 8);
  return { intro, sights };
}

function Row({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">{icon}</span>
      <span className="pt-1">{children}</span>
    </li>
  );
}

const kmText = (d: number, ru = false) => (d < 1 ? `${Math.round(d * 1000)} ${ru ? "м" : "m"}` : `${d < 10 ? d.toFixed(1) : Math.round(d)} ${ru ? "км" : "km"}`);

export function Nearby({ lat, lng, comune, listingId }: { lat: number; lng: number; comune: string | null; listingId?: string }) {
  const ru = useLang() === "ru";
  const fd = (m: number) => formatDrive(m, ru);
  const pn = (n: string) => (ru ? ruPlace(n) : n);
  const cities = nearest(lat, lng, CITIES, 6);
  const inside = cities[0] && cities[0].km < 4 ? cities[0] : null;
  const around = cities.filter((c) => c !== inside).slice(0, 3);
  const airport = nearest(lat, lng, AIRPORTS, 1)[0]!;
  const rome = km(lat, lng, 41.9028, 12.4964);
  const osm = useQuery({ queryKey: ["nearby-osm", lat, lng], queryFn: () => fetchOsm(lat, lng), staleTime: Infinity, retry: 1 });
  const climate = useQuery({ queryKey: ["nearby-climate", lat.toFixed(2), lng.toFixed(2)], queryFn: () => fetchClimate(lat, lng), staleTime: Infinity, retry: 1 });
  const wiki = useQuery({ queryKey: ["nearby-wiki", lat, lng, comune, ru], queryFn: () => fetchWiki(lat, lng, comune, ru), staleTime: Infinity, retry: 1 });
  const lang = ru ? "ru" : "en";
  const brief = useQuery({
    queryKey: ["area-brief", listingId, lang],
    enabled: !!listingId,
    queryFn: () => callFunction<Brief>("area-brief", { listing_id: listingId, lang }),
    staleTime: Infinity, retry: 1,
  });
  // The browser's own OpenStreetMap request is often rate limited; the server-side facts fill in.
  const bf = brief.data?.facts;
  const o = osm.data ?? (bf && Object.keys(bf).length ? {
    beach: bf.beach ?? null, shop: bf.shop ?? null, bakery: bf.bakery ?? null, station: bf.station ?? null, eating: bf.eating ?? 0,
  } : undefined);

  return (
    <div className="mt-6 grid gap-4 md:grid-cols-2">
      {(brief.isLoading || brief.data?.brief) && (
        <div className="grain rounded-2xl bg-gradient-to-b from-[oklch(0.93_0.02_240)] to-[oklch(0.965_0.01_235)] p-6 md:col-span-2">
          <p className="font-display text-[19px] italic text-azure">{ru ? "Argos о месте" : "Argos on the area"}</p>
          {brief.isLoading ? (
            <div className="mt-3 space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-4 animate-pulse rounded bg-foreground/10" />)}</div>
          ) : (
            <>
              <p className="mt-2 text-[17px] font-light leading-relaxed text-foreground/85">{brief.data!.brief}</p>
              {brief.data!.sources.length > 0 && (
                <p className="mt-3 text-xs text-muted-foreground">
                  {ru ? "Источники: " : "Sources: "}
                  {brief.data!.sources.map((s, i) => (
                    <span key={s.title}>{i > 0 && ", "}{s.url ? <a href={s.url} target="_blank" rel="noreferrer" className="hover:underline">{s.title}</a> : s.title}</span>
                  ))}
                  {ru ? ", OpenStreetMap." : ", OpenStreetMap."}
                </p>
              )}
            </>
          )}
        </div>
      )}
      <div className="glass rounded-2xl p-5">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">{ru ? "Как добираться" : "Getting around"}</p>
        <ul className="space-y-3">
          {inside && <Row icon={<Landmark className="h-4 w-4" />}>{ru ? <>Прямо в городе <strong>{pn(inside.name)}</strong></> : <>In <strong>{inside.name}</strong> itself</>}</Row>}
          {around.map((c) => (
            <Row key={c.name} icon={<Car className="h-4 w-4" />}>
              {ru ? <>До города {pn(c.name)} примерно <strong>{fd(driveMinutes(c.km))}</strong> на машине</> : <>About <strong>{fd(driveMinutes(c.km))}</strong> to {c.name}</>} <span className="text-muted-foreground">({Math.round(c.km)} {ru ? "км" : "km"})</span>
            </Row>
          ))}
          {rome < 220 && !around.some((c) => c.name === "Rome") && !inside && (
            <Row icon={<Car className="h-4 w-4" />}>{ru ? <>До Рима примерно <strong>{fd(driveMinutes(rome))}</strong> на машине</> : <>About <strong>{fd(driveMinutes(rome))}</strong> to Rome</>}</Row>
          )}
          <Row icon={<Plane className="h-4 w-4" />}>
            {ru ? <>До аэропорта {pn(airport.name)} примерно <strong>{fd(driveMinutes(airport.km))}</strong></> : <>{airport.name} airport about <strong>{fd(driveMinutes(airport.km))}</strong> away</>}
          </Row>
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">{ru ? "Время в пути оценено по расстоянию, это не маршрут из навигатора." : "Drive times are estimates from distance, not a route planner."}</p>
      </div>

      <div className="glass rounded-2xl p-5">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">{ru ? "Повседневная жизнь" : "Day to day"}</p>
        {(() => {
          const c = climate.data;
          const shore = nearestGems(lat, lng, 60, 1, ["coast", "lake"])[0];
          const gems = nearestGems(lat, lng, 45, 2, ["history", "wine", "mountains"]);
          const note = c ? climateNote(c, ru) : null;
          const r = (n: number) => `${Math.round(n)}°`;
          const asks = questionsFor({ cityKm: cities[0]?.km ?? 0, shore, gem: gems[0], climate: c }, ru);
          return (
            <>
              <ul className="space-y-3">
                {c && (
                  <Row icon={<Sun className="h-4 w-4" />}>
                    {ru
                      ? <>Зимой днём <strong>{r(c.winterDay)}</strong>, ночью {r(c.winterNight)}. Летом днём <strong>{r(c.summerDay)}</strong>, ночью {r(c.summerNight)}.</>
                      : <>Winter days <strong>{r(c.winterDay)}</strong>, nights {r(c.winterNight)}. Summer days <strong>{r(c.summerDay)}</strong>, nights {r(c.summerNight)}.</>}
                  </Row>
                )}
                {c && (
                  <Row icon={<CloudRain className="h-4 w-4" />}>
                    {ru ? <><strong>{c.rainYear} мм</strong> осадков в год, больше всего в {MONTHS_RU[c.wettest]}</> : <><strong>{c.rainYear} mm</strong> of rain a year, most in {MONTHS_EN[c.wettest]}</>}
                  </Row>
                )}
                <Row icon={<Umbrella className="h-4 w-4" />}>
                  {shore
                    ? <>{ru ? "Море или озеро: " : "Sea or lake: "}<strong>{shore.name}</strong>, {Math.round(shore.km)} {ru ? "км" : "km"}</>
                    : o?.beach ? <>{ru ? "Пляж: " : "Beach "}<strong>{kmText(o.beach.km, ru)}</strong></>
                    : ru ? "Вдали от моря и озёр" : "Inland, far from sea and lakes"}
                </Row>
                {gems.length > 0 && (
                  <Row icon={<Compass className="h-4 w-4" />}>
                    {gems.map((g, i) => <span key={g.name}>{i > 0 && " · "}<strong>{g.name}</strong> {Math.round(g.km)} {ru ? "км" : "km"}</span>)}
                  </Row>
                )}
                {o && (o.eating > 0 || o.shop || o.station) && (
                  <Row icon={o.eating > 0 ? <Coffee className="h-4 w-4" /> : o.shop ? <ShoppingBasket className="h-4 w-4" /> : <TrainFront className="h-4 w-4" />}>
                    {[
                      o.eating > 0 ? (ru ? `${o.eating} кафе и ресторанов в 3 км` : `${o.eating} cafes and restaurants within 3 km`) : null,
                      o.shop ? (ru ? `магазин ${kmText(o.shop.km, true)}` : `shop ${kmText(o.shop.km)}`) : null,
                      o.station ? (ru ? `станция ${kmText(o.station.km, true)}` : `station ${kmText(o.station.km)}`) : null,
                    ].filter(Boolean).join(" · ")}
                  </Row>
                )}
              </ul>
              {note && <p className="mt-3 text-[15px] font-light leading-relaxed text-foreground/80">{note}</p>}
              <div className="mt-4 border-t pt-4">
                <p className="mb-2 font-display text-[17px] italic text-azure">{ru ? "Спросите Argos о жизни здесь" : "Ask Argos about life here"}</p>
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {asks.map((q) => (
                    <button key={q} type="button" onClick={() => openArgos({ text: q })}
                      className="rounded-full border bg-card px-2.5 py-1 text-left text-[13px] hover:border-brand/40 hover:text-brand">{q}</button>
                  ))}
                </div>
                <ArgosComposer tone="light" lang={speechLang(ru ? "ru" : "en")} placeholder={ru ? "Школы, врачи, соседи, зима..." : "Schools, doctors, neighbours, winters..."} onSubmit={(t) => openArgos({ text: t })} />
              </div>
              <p className="mt-3 text-xs text-muted-foreground">{ru ? "Климат: NASA POWER, среднее за 30 лет. Расстояния по прямой." : "Climate: NASA POWER, 30-year average. Straight-line distances."}</p>
            </>
          );
        })()}
      </div>

      {((wiki.data?.intro && !brief.data?.brief) || (wiki.data?.sights.length ?? 0) > 0) && (
        <div className="glass rounded-2xl p-5 md:col-span-2">
          {wiki.data?.intro && !brief.data?.brief && (
            <>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{ru ? "О городе: " : "About "}{wiki.data.intro.title}</p>
              <p className="leading-relaxed">{wiki.data.intro.extract}</p>
              {wiki.data.intro.url && (
                <a href={wiki.data.intro.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm text-brand hover:underline">
                  {ru ? "Подробнее в Википедии" : "More on Wikipedia"} <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </>
          )}
          {(wiki.data?.sights.length ?? 0) > 0 && (
            <>
              <p className="mb-2 mt-5 text-xs font-medium uppercase tracking-wide text-muted-foreground">{ru ? "Что посмотреть в радиусе 10 км" : "Worth knowing within 10 km"}</p>
              <ul className="flex flex-wrap gap-2">
                {wiki.data!.sights.map((p) => (
                  <li key={p.pageid}>
                    <a href={`https://${ru ? "ru" : "en"}.wikipedia.org/?curid=${p.pageid}`} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-sm hover:border-brand/40 hover:text-brand">
                      {p.title} <span className="text-xs text-muted-foreground">{kmText(p.dist / 1000, ru)}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
