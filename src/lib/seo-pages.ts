/** English landing pages Google can send people to: houses for sale by region and budget, court auctions, €1 homes.
 *  /houses/<slug>, e.g. tuscany, tuscany-under-50000, court-auctions-sicily, one-euro-houses, italy-under-30000. */
export const SEO_REGIONS: { slug: string; region: string; name: string; blurb: string }[] = [
  { slug: "tuscany", region: "Toscana", name: "Tuscany", blurb: "Cypress roads, hill towns and stone farmhouses. Tuscany is the dearest region on our list, but village houses in the Lunigiana, the Casentino and the Maremma hills still sell for less than a flat in most capitals." },
  { slug: "sicily", region: "Sicilia", name: "Sicily", blurb: "Baroque towns like Modica and Ragusa, sea on three sides and some of the lowest prices per square metre in Italy, plus a steady flow of court auctions." },
  { slug: "puglia", region: "Puglia", name: "Puglia", blurb: "Whitewashed towns, trulli and masserie, olive groves down to two seas. The Salento and the Valle d'Itria are where most foreign buyers look." },
  { slug: "liguria", region: "Liguria", name: "Liguria", blurb: "The Italian Riviera: villages stacked above the sea and, a few kilometres inland from Genoa, stone houses at a fraction of coastal prices." },
  { slug: "sardinia", region: "Sardegna", name: "Sardinia", blurb: "An island of granite villages and empty beaches. Inland towns are cheap, and several run €1-house schemes." },
  { slug: "calabria", region: "Calabria", name: "Calabria", blurb: "The toe of Italy: mountains, two coasts and some of the cheapest houses in the country, many within sight of the sea." },
  { slug: "abruzzo", region: "Abruzzo", name: "Abruzzo", blurb: "Mountains an hour from Rome and an Adriatic coast. Hill-town houses in Abruzzo are among the best value in central Italy." },
  { slug: "piedmont", region: "Piemonte", name: "Piedmont", blurb: "Wine hills of the Langhe and Monferrato, Alpine valleys and old brick farmhouses, with prices well below Tuscany for a similar landscape." },
  { slug: "umbria", region: "Umbria", name: "Umbria", blurb: "Green, quiet and central: medieval towns between Rome and Florence, with country houses cheaper than in Tuscany next door." },
  { slug: "marche", region: "Marche", name: "Le Marche", blurb: "Rolling hills between the Apennines and the Adriatic, walled towns and farmhouses that cost a third of their Tuscan equivalents." },
  { slug: "lombardy", region: "Lombardia", name: "Lombardy", blurb: "Lakes Como, Garda and Iseo and the Alpine valleys above them. Lake villages are dear, the valleys much less so." },
  { slug: "basilicata", region: "Basilicata", name: "Basilicata", blurb: "Matera's cave town, hill villages and a short coast on two seas. The cheapest region per square metre on Odysstay right now." },
  { slug: "molise", region: "Molise", name: "Molise", blurb: "Italy's least-known region: mountain villages, a short coast and very low prices, with some towns paying people to move in." },
  { slug: "campania", region: "Campania", name: "Campania", blurb: "Naples, the Amalfi Coast and the Cilento. The coast is costly; the Cilento and inland Irpinia are not." },
  { slug: "lazio", region: "Lazio", name: "Lazio", blurb: "The countryside around Rome: lake towns, the Sabine hills and the Tuscia, all within reach of the capital." },
  { slug: "veneto", region: "Veneto", name: "Veneto", blurb: "Prosecco hills, Palladian villas and the Dolomites, with Venice an hour away." },
  { slug: "emilia-romagna", region: "Emilia-Romagna", name: "Emilia-Romagna", blurb: "Bologna, Parma and Modena, and Apennine villages above them where stone houses are cheap." },
  { slug: "friuli", region: "Friuli-Venezia Giulia", name: "Friuli-Venezia Giulia", blurb: "Italy's north-east corner by Slovenia and Austria. A surprise: one of the cheapest regions per square metre, with ready-to-live houses in the hills." },
  { slug: "trentino", region: "Trentino-Alto Adige", name: "Trentino-Alto Adige", blurb: "Dolomite valleys and lakes, with mountain houses that are cheaper than most people expect." },
  { slug: "aosta-valley", region: "Valle d'Aosta", name: "Aosta Valley", blurb: "Italy's smallest region, under Mont Blanc and the Matterhorn: stone-roofed rural houses in Alpine villages." },
];

export const BANDS = [30000, 50000, 100000] as const;

export type SeoPage = { slug: string; title: string; h1: string; intro: string; region?: string | undefined; regionName?: string | undefined; max?: number | undefined; kind: "sale" | "auction" | "one_euro" };

const eur = (n: number) => `€${n.toLocaleString("en-US")}`;

export function seoPage(slug: string): SeoPage | null {
  if (slug === "one-euro-houses") {
    return { slug, kind: "one_euro", title: "€1 houses in Italy: the towns selling now", h1: "€1 houses in Italy",
      intro: "Towns that sell abandoned houses for a symbolic euro, if you renovate within a few years. These are the notices open right now, with what the town asks in return. Expect a deposit, a renovation plan and a deadline." };
  }
  const auction = slug.match(/^court-auctions-(.+)$/);
  if (auction) {
    const r = SEO_REGIONS.find((x) => x.slug === auction[1]);
    if (auction[1] !== "italy" && !r) return null;
    const where = r ? r.name : "Italy";
    return { slug, kind: "auction", region: r?.region, regionName: r?.name, title: `Court auctions in ${where}: houses below valuation`,
      h1: `Court auctions in ${where}`,
      intro: `Houses sold by Italian courts, usually well under the court expert's valuation, with mortgages and liens cleared on transfer. Each one shows the starting price, the minimum offer, the valuation and the sale date.${r ? ` ${r.blurb}` : ""}` };
  }
  const m = slug.match(/^(.+?)(?:-under-(\d+))?$/);
  if (!m) return null;
  const max = m[2] ? Number(m[2]) : undefined;
  if (max && !(BANDS as readonly number[]).includes(max)) return null;
  const r = SEO_REGIONS.find((x) => x.slug === m[1]);
  if (m[1] !== "italy" && !r) return null;
  const where = r ? r.name : "Italy";
  const h1 = `Houses for sale in ${where}${max ? ` under ${eur(max)}` : ""}`;
  return { slug, kind: "sale", region: r?.region, regionName: r?.name, max, title: `${h1}, with the real cost`, h1,
    intro: `${r ? `${r.blurb} ` : ""}Every house here comes with real photos, a deal score against the official values for its area, and the full cost of buying added up: tax, notary, agency and surveyor.` };
}

export function allSeoSlugs() {
  const out = ["italy", ...BANDS.map((b) => `italy-under-${b}`), "court-auctions-italy", "one-euro-houses"];
  for (const r of SEO_REGIONS) out.push(r.slug, ...BANDS.map((b) => `${r.slug}-under-${b}`), `court-auctions-${r.slug}`);
  return out;
}
