import { useQuery } from "@tanstack/react-query";
import { Coffee, ExternalLink, Landmark, Plane, ShoppingBasket, TrainFront, Umbrella, Car } from "lucide-react";
import type { ReactNode } from "react";

import { callFunction } from "@/lib/agent";
import { useLang } from "@/lib/i18n";
import { AIRPORTS, CITIES, driveMinutes, formatDrive, km, nearest, ruPlace } from "@/lib/places";

type OsmEl = { lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> };

/** One Overpass query for everyday life and the sea. Free, public OpenStreetMap data. */
async function fetchOsm(lat: number, lng: number) {
  const q = `[out:json][timeout:20];(
    nwr["natural"="beach"](around:40000,${lat},${lng});
    nwr["amenity"~"^(restaurant|cafe|bar|pub|ice_cream)$"](around:3000,${lat},${lng});
    nwr["shop"~"^(supermarket|convenience|bakery)$"](around:10000,${lat},${lng});
    nwr["railway"="station"](around:25000,${lat},${lng});
  );out center 300;`;
  const r = await fetch("https://overpass-api.de/api/interpreter", { method: "POST", body: new URLSearchParams({ data: q }) });
  if (!r.ok) throw new Error(`overpass ${r.status}`);
  const els: OsmEl[] = (await r.json()).elements ?? [];
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

type Near = { km: number; name?: string } | null;
type Brief = { brief: string; facts: Partial<Record<"beach" | "shop" | "bakery" | "station" | "hospital" | "pharmacy" | "school", Near>> & { eating?: number }; sources: { title: string; url: string | null }[] };

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
      {(brief.isLoading || brief.data) && (
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
        {osm.isLoading && !o ? (
          <div className="space-y-3">{[0, 1, 2, 3].map((i) => <div key={i} className="h-6 animate-pulse rounded bg-muted" />)}</div>
        ) : o ? (
          <ul className="space-y-3">
            <Row icon={<Umbrella className="h-4 w-4" />}>
              {o.beach ? (ru ? <>Ближайший пляж: <strong>{kmText(o.beach.km, true)}</strong>{o.beach.name ? ` (${o.beach.name})` : ""}</> : <>Nearest beach <strong>{kmText(o.beach.km)}</strong>{o.beach.name ? ` (${o.beach.name})` : ""}</>) : ru ? "Пляжей в радиусе 40 км нет" : "No beach within 40 km"}
            </Row>
            <Row icon={<Coffee className="h-4 w-4" />}>
              {o.eating ? (ru ? <>Ресторанов, кафе и баров в радиусе 3 км: <strong>{o.eating}</strong></> : <><strong>{o.eating}</strong> restaurants, cafes and bars within 3 km</>) : ru ? "В радиусе 3 км нет ни ресторанов, ни кафе: место очень тихое" : "No restaurants or cafes mapped within 3 km: very quiet"}
            </Row>
            <Row icon={<ShoppingBasket className="h-4 w-4" />}>
              {o.shop ? (ru ? <>Продуктовый магазин: <strong>{kmText(o.shop.km, true)}</strong></> : <>Grocery shop <strong>{kmText(o.shop.km)}</strong> away</>) : ru ? "Продуктовых магазинов в радиусе 10 км нет" : "No grocery shop mapped within 10 km"}
              {o.bakery && o.bakery.km < 5 ? <>, {ru ? "пекарня" : "bakery"} {kmText(o.bakery.km, ru)}</> : null}
            </Row>
            <Row icon={<TrainFront className="h-4 w-4" />}>
              {o.station ? (ru ? <>Железнодорожная станция: <strong>{kmText(o.station.km, true)}</strong>{o.station.name ? ` (${o.station.name})` : ""}</> : <>Train station <strong>{kmText(o.station.km)}</strong>{o.station.name ? ` (${o.station.name})` : ""}</>) : ru ? "Станций в радиусе 25 км нет" : "No train station within 25 km"}
            </Row>
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{ru ? "Сведения о местной жизни сейчас недоступны." : "Local details are unavailable right now."}</p>
        )}
        <p className="mt-3 text-xs text-muted-foreground">{ru ? "Данные OpenStreetMap. Расстояния по прямой." : "From OpenStreetMap. Straight-line distances."}</p>
      </div>

      {((wiki.data?.intro && !brief.data) || (wiki.data?.sights.length ?? 0) > 0) && (
        <div className="glass rounded-2xl p-5 md:col-span-2">
          {wiki.data?.intro && !brief.data && (
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
