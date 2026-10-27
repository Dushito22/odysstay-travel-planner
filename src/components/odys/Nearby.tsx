import { useQuery } from "@tanstack/react-query";
import { Coffee, ExternalLink, Landmark, Plane, ShoppingBasket, TrainFront, Umbrella, Car } from "lucide-react";
import type { ReactNode } from "react";

import { AIRPORTS, CITIES, driveMinutes, formatDrive, km, nearest } from "@/lib/places";

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

type WikiPlace = { pageid: number; title: string; dist: number };

/** Notable places within 10 km and a short introduction to the town, from Wikipedia. */
async function fetchWiki(lat: number, lng: number, comune: string | null) {
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

const kmText = (d: number) => (d < 1 ? `${Math.round(d * 1000)} m` : `${d < 10 ? d.toFixed(1) : Math.round(d)} km`);

export function Nearby({ lat, lng, comune }: { lat: number; lng: number; comune: string | null }) {
  const cities = nearest(lat, lng, CITIES, 6);
  const inside = cities[0] && cities[0].km < 4 ? cities[0] : null;
  const around = cities.filter((c) => c !== inside).slice(0, 3);
  const airport = nearest(lat, lng, AIRPORTS, 1)[0]!;
  const rome = km(lat, lng, 41.9028, 12.4964);
  const osm = useQuery({ queryKey: ["nearby-osm", lat, lng], queryFn: () => fetchOsm(lat, lng), staleTime: Infinity, retry: 1 });
  const wiki = useQuery({ queryKey: ["nearby-wiki", lat, lng, comune], queryFn: () => fetchWiki(lat, lng, comune), staleTime: Infinity, retry: 1 });
  const o = osm.data;

  return (
    <div className="mt-6 grid gap-4 md:grid-cols-2">
      <div className="glass rounded-2xl p-5">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Getting around</p>
        <ul className="space-y-3">
          {inside && <Row icon={<Landmark className="h-4 w-4" />}>In <strong>{inside.name}</strong> itself</Row>}
          {around.map((c) => (
            <Row key={c.name} icon={<Car className="h-4 w-4" />}>
              About <strong>{formatDrive(driveMinutes(c.km))}</strong> to {c.name} <span className="text-muted-foreground">({Math.round(c.km)} km)</span>
            </Row>
          ))}
          {rome < 220 && !around.some((c) => c.name === "Rome") && !inside && (
            <Row icon={<Car className="h-4 w-4" />}>About <strong>{formatDrive(driveMinutes(rome))}</strong> to Rome</Row>
          )}
          <Row icon={<Plane className="h-4 w-4" />}>
            {airport.name} airport about <strong>{formatDrive(driveMinutes(airport.km))}</strong> away
          </Row>
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">Drive times are estimates from distance, not a route planner.</p>
      </div>

      <div className="glass rounded-2xl p-5">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Day to day</p>
        {osm.isLoading ? (
          <div className="space-y-3">{[0, 1, 2, 3].map((i) => <div key={i} className="h-6 animate-pulse rounded bg-muted" />)}</div>
        ) : o ? (
          <ul className="space-y-3">
            <Row icon={<Umbrella className="h-4 w-4" />}>
              {o.beach ? <>Nearest beach <strong>{kmText(o.beach.km)}</strong>{o.beach.name ? ` (${o.beach.name})` : ""}</> : "No beach within 40 km"}
            </Row>
            <Row icon={<Coffee className="h-4 w-4" />}>
              {o.eating ? <><strong>{o.eating}</strong> restaurants, cafes and bars within 3 km</> : "No restaurants or cafes mapped within 3 km: very quiet"}
            </Row>
            <Row icon={<ShoppingBasket className="h-4 w-4" />}>
              {o.shop ? <>Grocery shop <strong>{kmText(o.shop.km)}</strong> away</> : "No grocery shop mapped within 10 km"}
              {o.bakery && o.bakery.km < 5 ? <>, bakery {kmText(o.bakery.km)}</> : null}
            </Row>
            <Row icon={<TrainFront className="h-4 w-4" />}>
              {o.station ? <>Train station <strong>{kmText(o.station.km)}</strong>{o.station.name ? ` (${o.station.name})` : ""}</> : "No train station within 25 km"}
            </Row>
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Local details are unavailable right now.</p>
        )}
        <p className="mt-3 text-xs text-muted-foreground">From OpenStreetMap. Straight-line distances.</p>
      </div>

      {(wiki.data?.intro || (wiki.data?.sights.length ?? 0) > 0) && (
        <div className="glass rounded-2xl p-5 md:col-span-2">
          {wiki.data?.intro && (
            <>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">About {wiki.data.intro.title}</p>
              <p className="leading-relaxed">{wiki.data.intro.extract}</p>
              {wiki.data.intro.url && (
                <a href={wiki.data.intro.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm text-brand hover:underline">
                  More on Wikipedia <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </>
          )}
          {(wiki.data?.sights.length ?? 0) > 0 && (
            <>
              <p className="mb-2 mt-5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Worth knowing within 10 km</p>
              <ul className="flex flex-wrap gap-2">
                {wiki.data!.sights.map((p) => (
                  <li key={p.pageid}>
                    <a href={`https://en.wikipedia.org/?curid=${p.pageid}`} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-sm hover:border-brand/40 hover:text-brand">
                      {p.title} <span className="text-xs text-muted-foreground">{kmText(p.dist / 1000)}</span>
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
