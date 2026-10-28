// Receives listings the owner saw on Idealista or Immobiliare: from the Odysstay capture extension (pages
// open in his own browser) and from the Gmail script (the portals' own alert emails). Never fetches the portals.
// Authenticated with a personal capture token; only its SHA-256 hash is stored (capture_tokens).
import { adminClient, HttpError, json, serve } from "../_shared/runtime.ts";

const SOURCES = new Set(["idealista", "immobiliare"]);
type In = {
  id?: unknown; url?: unknown; title?: unknown; price?: unknown; sqm?: unknown; rooms?: unknown;
  place?: unknown; photo?: unknown; description?: unknown;
};

async function sha256(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join("");
}
const s = (v: unknown, max = 500) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const n = (v: unknown) => {
  const x = typeof v === "number" ? v : Number(String(v ?? "").replace(/[^\d,]/g, "").replace(",", "."));
  return Number.isFinite(x) && x > 0 ? x : null;
};
const norm = (x: string) => x.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z' ]/g, " ").replace(/\s+/g, " ").trim();

const TYPE_RULES: [string, RegExp][] = [
  ["rural_house", /rustic|casale|colonic|masseria|trull|cascina|baita|podere|rural|casolare/i],
  ["house", /villa|villett|casa indipendente|terratetto|casa semi|bifamiliare|schiera|casa\b/i],
  ["apartment", /appartament|attico|mansard|bilocal|trilocal|monolocal|quadrilocal|loft/i],
  ["land", /terren/i],
  ["garage", /box|garage|posto auto/i],
  ["commercial", /negozio|ufficio|capannone|locale commerciale|magazzino/i],
];

let comuni: { name: string; key: string; province: string; region: string }[] | null = null;

serve(async (req, body) => {
  const admin = adminClient();
  const token = req.headers.get("x-capture-token") ?? "";
  if (token.length < 20) throw new HttpError(401, "Missing capture token");
  const { data: ok } = await admin.from("capture_tokens").select("label").eq("token_sha256", await sha256(token)).maybeSingle();
  if (!ok) throw new HttpError(401, "Unknown capture token");

  const source = s(body["source"], 20);
  if (!SOURCES.has(source)) throw new HttpError(400, "Unknown source");
  const context = s(body["context"], 300);
  const items = (Array.isArray(body["listings"]) ? body["listings"] : []).slice(0, 200) as In[];

  if (!comuni) {
    const all: { name: string; province: string; region: string }[] = [];
    for (let from = 0; ; from += 1000) {
      const { data } = await admin.from("comuni").select("name,province,region").range(from, from + 999);
      if (!data?.length) break;
      all.push(...data);
      if (data.length < 1000) break;
    }
    comuni = all.map((c) => ({ ...c, key: norm(c.name) }));
  }
  const byKey = new Map<string, { name: string; province: string; region: string }[]>();
  for (const c of comuni) byKey.set(c.key, [...(byKey.get(c.key) ?? []), c]);
  const findComune = (texts: string[]) => {
    for (const t of texts) {
      // Try the pieces after commas and dashes first ("Via Roma, Ceglie Messapica"), then the whole string.
      const parts = t.split(/[,|–-]/).map((p) => norm(p)).filter(Boolean).reverse();
      for (const p of [...parts, norm(t)]) {
        const hit = byKey.get(p);
        if (hit?.length === 1) return hit[0];
        const words = p.split(" ");
        for (let len = Math.min(4, words.length); len >= 1; len--) {
          for (let i = words.length - len; i >= 0; i--) {
            const h = byKey.get(words.slice(i, i + len).join(" "));
            if (h?.length === 1 && h[0]!.key.length >= 4) return h[0];
          }
        }
      }
    }
    return null;
  };

  const rows = [];
  const facts: Record<string, Record<string, unknown>[]> = {};
  for (const it of items) {
    const url = s(it.url, 400);
    const id = s(it.id, 40) || (url.match(/\/(?:immobile|annunci)\/(\d+)/)?.[1] ?? "");
    if (!id || !/^https:\/\/(www\.)?(idealista\.it|immobiliare\.it)\//.test(url)) continue;
    const title = s(it.title, 200);
    const price = n(it.price);
    const sqm = n(it.sqm);
    const place = s(it.place, 200);
    const desc = s(it.description, 1500);
    const c = findComune([place, title, context]);
    const kind = TYPE_RULES.find(([, rx]) => rx.test(`${title} ${desc}`))?.[0] ?? "house";
    const photo = s(it.photo, 600);
    const ext = `${source}:${id}`;
    rows.push({
      external_id: ext, country: "IT", region: c?.region ?? null, province: c?.province ?? null, comune: c?.name ?? null,
      address: place || null, title_en: title || `${kind === "apartment" ? "Apartment" : "House"} in ${c?.name ?? "Italy"}`,
      summary_en: desc ? desc.slice(0, 600) : null, property_type: kind, sale_type: "sale",
      price_eur: price, surface_sqm: sqm && sqm >= 15 && sqm <= 3000 && kind !== "land" ? sqm : null,
      land_sqm: kind === "land" ? sqm : null, occupancy: "unknown", status: "active",
      sale_mode: "Private sale through an agency or owner", photo_urls: /^https:\/\//.test(photo) ? [photo] : [],
      hero_image_path: /^https:\/\//.test(photo) ? photo : null,
      contacts: [{ role: `Listing on ${source === "idealista" ? "Idealista" : "Immobiliare.it"}`, name: null, url }],
      attachments: [], is_demo: false,
    });
    facts[ext] = [
      ...(price ? [{ key: "price_eur", label_en: "Asking price", value_text: `€${price.toLocaleString("en-GB")}`, value_num: price,
        quote: `${s(it.price as string, 40) || price}`, quote_en: `Asking price on ${source}: €${price.toLocaleString("en-GB")}`, verified: true }] : []),
      ...(sqm ? [{ key: "surface_sqm", label_en: "Surface", value_text: `${sqm} m²`, value_num: sqm, quote: `${sqm} m²`, quote_en: `${sqm} m²`, verified: true }] : []),
      ...(desc ? [{ key: "description", label_en: "Description", value_text: desc.slice(0, 400), value_num: null, quote: desc.slice(0, 1000),
        quote_en: "Description from the listing, in Italian", verified: true }] : []),
    ];
  }
  if (!rows.length) return json({ saved: 0 });
  // Documents keep the link to the original listing, like every other source.
  const docs = rows.map((r) => ({ source_id: source, url: (r.contacts[0] as { url: string }).url, part: "", status: "extracted", language: "it",
    title: r.title_en, meta: { external_id: r.external_id, captured_at: new Date().toISOString() } }));
  const { data: d, error: de } = await admin.from("documents").upsert(docs, { onConflict: "url,part" }).select("id,url");
  if (de) throw de;
  const docId = new Map((d ?? []).map((x) => [x.url, x.id]));
  const clean = rows.map((r) => ({ ...r, document_id: docId.get((r.contacts[0] as { url: string }).url) ?? null }));
  const { data: saved, error } = await admin.from("listings").upsert(clean, { onConflict: "external_id" }).select("id,external_id");
  if (error) throw error;
  const ids = (saved ?? []).map((x) => x.id);
  if (ids.length) {
    await admin.from("listing_facts").delete().in("listing_id", ids);
    const all = (saved ?? []).flatMap((x) => (facts[x.external_id] ?? []).map((f) => ({ listing_id: x.id, ...f })));
    if (all.length) await admin.from("listing_facts").insert(all);
  }
  return json({ saved: ids.length, placed: clean.filter((r) => r.comune).length });
});
