import { ImageResponse } from "@vercel/og";
import { createElement as h } from "react";

/** The picture a house link shows when pasted on Reddit, Facebook, Telegram, X or WhatsApp: the house photo,
 *  the town, the price and what it really costs, in the site's type. 1200x630, cached a day at the edge. */
const TYPE: Record<string, string> = { house: "House", rural_house: "Country house", apartment: "Apartment", building: "Whole building", land: "Land", mixed: "Property" };
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";

let fonts: Promise<{ name: string; data: ArrayBuffer; weight: 400 | 600; style: "normal" }[]> | null = null;
function loadFonts(origin: string) {
  fonts ??= Promise.all([
    ["Editorial", "og-editorial.ttf", 400], ["Montreal", "og-montreal.ttf", 400], ["Montreal", "og-montreal-semibold.ttf", 600],
  ].map(async ([name, file, weight]) => ({
    name: name as string, weight: weight as 400 | 600, style: "normal" as const,
    data: await fetch(`${origin}/fonts/${file}`).then((r) => { if (!r.ok) throw new Error(`font ${file}`); return r.arrayBuffer(); }),
  }))).catch((e) => { fonts = null; throw e; });
  return fonts;
}

const eur = (n: number) => `€${Math.round(n).toLocaleString("en-US")}`;

export async function ogCard(request: Request, id: string) {
  const base = (import.meta.env["VITE_SUPABASE_URL"] as string | undefined)?.replace(/\/$/, "");
  const key = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string | undefined;
  const origin = new URL(request.url).origin;
  if (!base || !key || !/^[0-9a-f-]{36}$/.test(id)) return new Response("no", { status: 400 });
  const r = await fetch(`${base}/rest/v1/listing_feed?id=eq.${id}&select=comune,region,price_eur,surface_sqm,property_type,sale_type,discount_pct,hero_image_path`, {
    headers: { apikey: key, authorization: `Bearer ${key}` },
  });
  type Row = { comune?: string; region?: string; price_eur?: number; surface_sqm?: number; property_type?: string; sale_type?: string; discount_pct?: number; hero_image_path?: string | null };
  const l = ((await r.json().catch(() => [])) as Row[])[0];
  if (!l) return new Response("not found", { status: 404 });

  let photo: string | null = null;
  const hp = l.hero_image_path ?? null;
  if (hp) {
    const url = /^https?:\/\//.test(hp) ? hp : `${base}/storage/v1/object/public/listing-images/${hp}`;
    const img = await fetch(url, { headers: { "user-agent": UA, referer: "https://www.immobiliare.it/" } }).catch(() => null);
    if (img?.ok) {
      const type = img.headers.get("content-type") ?? "image/jpeg";
      if (/jpe?g|png/.test(type)) photo = `data:${type};base64,${Buffer.from(await img.arrayBuffer()).toString("base64")}`;
    }
  }
  const price = Number(l.price_eur ?? 0);
  const auction = String(l.sale_type ?? "").startsWith("auction");
  const kind = auction ? "Court auction" : l.sale_type === "one_euro" ? "€1 house" : TYPE[l.property_type ?? ""] ?? "House";
  const facts = [kind, l.surface_sqm ? `${Math.round(l.surface_sqm)} m²` : null, auction && l.discount_pct ? `${Math.round(l.discount_pct)}% under appraisal` : null].filter(Boolean).join("  ·  ");

  const azure = "#1f4fd1";
  const el = h("div", { style: { width: 1200, height: 630, display: "flex", background: "#f6f7f9", fontFamily: "Montreal" } },
    h("div", { style: { width: 700, height: 630, display: "flex", background: "#dfe5ee" } },
      photo ? h("img", { src: photo, width: 700, height: 630, style: { objectFit: "cover" } }) : null),
    h("div", { style: { flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "56px 52px 48px" } },
      h("div", { style: { display: "flex", flexDirection: "column" } },
        h("div", { style: { fontSize: 26, color: "#5b6472" } }, String(l.region ?? "Italy")),
        h("div", { style: { fontFamily: "Editorial", fontSize: (l.comune?.length ?? 0) > 16 ? 58 : 72, lineHeight: 1.02, color: "#11161f", marginTop: 10 } }, String(l.comune ?? "")),
        h("div", { style: { fontSize: 25, color: "#5b6472", marginTop: 22 } }, facts)),
      h("div", { style: { display: "flex", flexDirection: "column" } },
        h("div", { style: { fontFamily: "Montreal", fontWeight: 600, fontSize: 64, color: "#11161f" } }, price ? eur(price) : "Price on request"),
        h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 26 } },
          h("div", { style: { fontSize: 24, color: azure } }, "odysstay.xyz"),
          h("div", { style: { fontSize: 20, color: "#8a93a1" } }, "Real cost added up. An agent that speaks Italian.")))));
  const out = new ImageResponse(el, { width: 1200, height: 630, fonts: await loadFonts(origin) });
  const png = await out.arrayBuffer();
  return new Response(png, { headers: { "content-type": "image/png", "cache-control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800" } });
}
