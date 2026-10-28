/** Argos: turns what a buyer says ("something in Puglia under 40k, I can do some work") into search filters.
 * Rules, not AI: it runs in the browser, costs nothing and is instant. The AI only writes Argos's reply. */
import { DEFAULT_FILTERS, fetchFeed, type FeedFilters, type FeedRow } from "./feed";

const REGIONS: [string, RegExp][] = [
  ["Sicilia", /sicil|сицил/i],
  ["Puglia", /puglia|apulia|salento|апули/i],
  ["Toscana", /tuscan|toscan|тоскан/i],
  ["Sardegna", /sardini|sardegn|сардин/i],
  ["Calabria", /calabri|калабри/i],
  ["Campania", /campani|amalfi|napl|napoli|кампани|амальфи|неапол/i],
  ["Lazio", /lazio|\brom[ea]\b|рим/i],
  ["Liguria", /liguri|cinque terre|лигури/i],
  ["Piemonte", /piedmont|piemont|пьемонт/i],
  ["Lombardia", /lombard|lake como|lago di como|garda|ломбард/i],
  ["Veneto", /veneto|venic|venezia|венец/i],
  ["Umbria", /umbri|умбри/i],
  ["Marche", /\bmarche\b|le marche|марке/i],
  ["Abruzzo", /abruzz|абруцц/i],
  ["Molise", /molise|молизе/i],
  ["Basilicata", /basilicat|matera|базиликат/i],
  ["Emilia-Romagna", /emilia|romagna|bologna|эмили/i],
  ["Friuli-Venezia Giulia", /friuli|фриули/i],
  ["Trentino-Alto Adige", /trentino|alto adige|dolomit|трентино|доломит/i],
  ["Valle d'Aosta", /aosta|аост/i],
];
const SOUTH = ["Sicilia", "Calabria", "Puglia", "Basilicata", "Campania", "Molise"];
const NORTH = ["Piemonte", "Lombardia", "Veneto", "Liguria", "Friuli-Venezia Giulia", "Trentino-Alto Adige", "Valle d'Aosta", "Emilia-Romagna"];
const CENTRE = ["Toscana", "Umbria", "Marche", "Lazio", "Abruzzo"];

const TYPES: [string, RegExp][] = [
  ["rural_house", /farmhouse|rustic|rustico|casale|masseria|trull|cottage|country ?house|фермер|деревенск|усадьб/i],
  ["house", /\bhouse\b|\bhome\b|villa|casa\b|townhouse|\bдом\b|домик|вилл/i],
  ["apartment", /apartment|\bflat\b|appartament|квартир|апартамент/i],
  ["land", /\bland\b|\bplot\b|terreno|участок|земл/i],
];

export type ArgosSearch = {
  filters: FeedFilters;
  /** What we understood, in plain words, for Argos's reply and the chips under the results. */
  understood: string[];
  /** Things the buyer asked for that we cannot filter on yet, so Argos can say so instead of pretending. */
  notYet: string[];
  oneEuroOnly: boolean;
  courtOnly: boolean;
};

function amount(raw: string, unit: string | undefined): number | null {
  const n = Number(raw.replace(/[.,\s](?=\d{3}\b)/g, "").replace(",", "."));
  if (!Number.isFinite(n)) return null;
  const u = (unit ?? "").toLowerCase();
  if (/^(k|к|тыс|mila|thousand|grand)/.test(u)) return n * 1000;
  if (/^(m|млн|million|milion)/.test(u)) return n * 1_000_000;
  return n;
}

export function parseRequest(text: string, previous?: ArgosSearch): ArgosSearch {
  const t = ` ${text.toLowerCase()} `;
  const prev = previous?.filters ?? DEFAULT_FILTERS;
  const f: FeedFilters = { ...DEFAULT_FILTERS, ...prev, regions: [...prev.regions], types: [...prev.types] };
  const understood: string[] = [];
  const notYet: string[] = [];

  // Budget: the largest money amount mentioned ("under 40k", "€50,000", "до 30 тысяч").
  const oneEuroOnly = /(1|one|un|один) ?(€|euro|евро)|€ ?1\b|case a 1|1 ?€ ?house/i.test(t);
  let best: number | null = null;
  for (const m of t.matchAll(/(?:€|eur|euro|евро)?\s?(\d{1,3}(?:[.,\s]\d{3})+|\d+(?:[.,]\d+)?)\s?(k\b|к\b|тыс\w*|mila|thousand|grand|m\b|млн|million)?\s?(?:€|eur\w*|евро)?/gi)) {
    const v = amount(m[1]!, m[2]);
    if (v != null && v >= 1000 && v <= 5_000_000 && (best == null || v > best)) best = v;
  }
  if (best) {
    f.maxPrice = Math.round(best);
    understood.push(`up to €${f.maxPrice.toLocaleString("en-GB")}`);
  }

  const regions = REGIONS.filter(([, rx]) => rx.test(t)).map(([r]) => r);
  if (/\bsouth|\bsud\b|юг/i.test(t)) regions.push(...SOUTH);
  if (/\bnorth|\bnord\b|север/i.test(t)) regions.push(...NORTH);
  if (/\bcentral|\bcentre|\bcenter|\bcentro\b|центр/i.test(t)) regions.push(...CENTRE);
  if (regions.length) {
    f.regions = [...new Set(regions)];
    understood.push(f.regions.length > 3 ? `${f.regions.length} regions` : f.regions.join(", "));
  }

  const types = TYPES.filter(([, rx]) => rx.test(t)).map(([k]) => k);
  if (types.length && !(types.length === 1 && types[0] === "house" && /\bhome\b/.test(t) && !/\bhouse\b|villa|casa/.test(t))) {
    if (types.includes("house")) types.push("rural_house");
    f.types = [...new Set(types)];
    understood.push(f.types.map((x) => ({ house: "houses", rural_house: "farmhouses", apartment: "apartments", land: "land" }[x] ?? x)).join(", "));
  }

  const courtOnly = /court|auction|asta|tribunal|аукцион|торг/i.test(t);
  if (courtOnly) understood.push("court and notary auctions");
  if (oneEuroOnly) {
    f.oneEuro = true;
    understood.push("€1 house towns");
  }
  if (/\bsea\b|coast|beach|mare\b|море|побереж|пляж/i.test(t)) notYet.push("by the sea");
  if (/garden|giardino|сад/i.test(t)) notYet.push("a garden");
  if (/view|vista|вид/i.test(t)) notYet.push("a view");
  if (/ready|move.?in|no work|без ремонта|готов/i.test(t)) understood.push("ready to live in, if possible");
  if (/renovat|project|some work|wreck|ristruttur|ремонт/i.test(t)) understood.push("happy to renovate");
  return { filters: f, understood, notYet, oneEuroOnly, courtOnly };
}

/** Runs the search on our own data (no AI, no cost). Relaxes type, then region, if nothing matches. */
export async function runSearch(s: ArgosSearch): Promise<{ rows: FeedRow[]; total: number; relaxed: string | null }> {
  const pick = (rows: FeedRow[]) => {
    let r = rows;
    if (s.oneEuroOnly) r = r.filter((x) => x.sale_type === "one_euro");
    else if (s.courtOnly) r = r.filter((x) => x.sale_type === "auction_judicial" || x.sale_type === "auction_notary");
    // Real photos first: people choose with their eyes.
    return [...r].sort((a, b) => Number(!!b.hero_image_path) - Number(!!a.hero_image_path) || (b.score ?? 0) - (a.score ?? 0));
  };
  const first = await fetchFeed(s.filters, "best");
  let rows = pick(first.rows);
  if (rows.length) return { rows: rows.slice(0, 30), total: s.oneEuroOnly || s.courtOnly ? rows.length : first.total, relaxed: null };
  if (s.filters.types.length) {
    const r = await fetchFeed({ ...s.filters, types: [] }, "best");
    rows = pick(r.rows);
    if (rows.length) return { rows: rows.slice(0, 30), total: rows.length, relaxed: "any kind of property" };
  }
  if (s.filters.regions.length) {
    const r = await fetchFeed({ ...s.filters, types: [], regions: [] }, "best");
    rows = pick(r.rows);
    if (rows.length) return { rows: rows.slice(0, 30), total: rows.length, relaxed: "anywhere in Italy" };
  }
  return { rows: [], total: 0, relaxed: null };
}

/** The reply when the AI is unavailable: short, honest, in Argos's voice. */
export function fallbackReply(s: ArgosSearch, n: number, relaxed: string | null, rows: FeedRow[]): string {
  if (!n) return "Nothing open matches that yet. Loosen one thing, the budget or the region, and I'll look again.";
  const what = s.understood.length ? s.understood.join(", ") : "everything open";
  const photo = rows.filter((r) => r.hero_image_path).length;
  const lead = relaxed ? `Nothing exact, so I widened it to ${relaxed}. ` : "";
  const sea = s.notYet.length ? ` I can't filter for ${s.notYet.join(" or ")} yet, so check the map on each one.` : "";
  return `${lead}${n.toLocaleString("en-GB")} open for ${what}. The best ones are on the right${photo ? ", with photos first" : ""}. Most need work and a little love.${sea} Tap one and I'll read the court papers for you.`;
}
