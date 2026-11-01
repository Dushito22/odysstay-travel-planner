import { fallback } from "@tanstack/zod-adapter";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { Profile } from "./profile";

export type FeedRow = Database["public"]["Views"]["listing_feed"]["Row"];

export const feedSearchSchema = z.object({
  sort: fallback(z.string(), "best").optional(),
  regions: fallback(z.array(z.string()), []).default([]),
  types: fallback(z.array(z.string()), []).default([]),
  minPrice: fallback(z.number(), 0).default(0),
  maxPrice: fallback(z.number(), 0).default(0),
  minSurface: fallback(z.number(), 0).default(0),
  minScore: fallback(z.number(), 0).default(0),
  minDiscount: fallback(z.number(), 0).default(0),
  condition: fallback(z.array(z.string()), []).default([]),
  realPhotos: fallback(z.boolean(), false).default(false),
  leases: fallback(z.boolean(), false).default(false),
  oneEuro: fallback(z.boolean(), true).default(true),
  unsold: fallback(z.boolean(), false).default(false),
  hideClosed: fallback(z.boolean(), true).default(true),
  prefs: fallback(z.boolean(), false).default(false),
});

export type FeedSearch = z.infer<typeof feedSearchSchema>;
export type FeedFilters = Omit<FeedSearch, "sort" | "prefs">;

export const DEFAULT_FILTERS: FeedFilters = {
  regions: [], types: [], minPrice: 0, maxPrice: 0, minSurface: 0, minScore: 0, minDiscount: 0, condition: [], realPhotos: false,
  leases: false, oneEuro: true, unsold: false, hideClosed: true,
};

export const SORTS = [
  { value: "best", label: "Best value" },
  { value: "cheapest", label: "Cheapest" },
  { value: "closing", label: "Closing soon" },
  { value: "discount", label: "Furthest below appraisal" },
  { value: "newest", label: "Newest" },
  { value: "foryou", label: "For you" },
];

export const SALE_TYPE_LABELS: Record<string, string> = {
  sale: "Sale", concession: "Concession", lease: "Lease", one_euro: "One-euro scheme",
  auction_judicial: "Court auction", auction_notary: "Notary auction", other: "Other sale",
};

export const TYPE_LABELS: Record<string, string> = {
  house: "House", apartment: "Apartment", building: "Building", rural_house: "Rural house",
  land: "Land", commercial: "Commercial", garage: "Garage", mixed: "Mixed", other: "Other",
};

export function prefsSearch(p: Profile | null): FeedSearch {
  return {
    ...DEFAULT_FILTERS,
    sort: "best",
    regions: p?.preferred_regions ?? [],
    types: p?.property_types ?? [],
    maxPrice: p?.budget_max_eur ?? 0,
    prefs: true,
  };
}

export function allowedSaleTypes(f: Pick<FeedFilters, "leases" | "oneEuro">) {
  const t = ["sale", "auction_judicial", "auction_notary", "other"];
  if (f.leases) t.push("concession", "lease");
  if (f.oneEuro) t.push("one_euro");
  return t;
}

export const showDemo = import.meta.env['VITE_SHOW_DEMO'] === "true";

export const FEED_LIMIT = 600;

/** Server-side order for each sort, so the best rows come back first even when thousands match. */
const SERVER_ORDER: Record<string, { col: string; asc: boolean }> = {
  best: { col: "score", asc: false },
  foryou: { col: "score", asc: false },
  cheapest: { col: "price_eur", asc: true },
  closing: { col: "days_left", asc: true },
  newest: { col: "created_at", asc: false },
  discount: { col: "discount_pct", asc: false },
};

export async function fetchFeed(f: FeedFilters, sort = "best"): Promise<{ rows: FeedRow[]; total: number }> {
  const o = SERVER_ORDER[sort] ?? SERVER_ORDER["best"]!;
  let q = supabase.from("listing_feed").select("*", { count: "estimated" });
  // People choose with their eyes: on the default sorts, listings with real photos lead.
  if (sort === "best" || sort === "foryou") q = q.order("has_real_photo", { ascending: false, nullsFirst: false });
  q = q.order(o.col, { ascending: o.asc, nullsFirst: false }).limit(FEED_LIMIT);
  if (sort === "closing") q = q.gt("days_left", 0);
  if (f.minDiscount > 0) q = q.gte("discount_pct", f.minDiscount);
  if (!showDemo) q = q.eq("is_demo", false);
  if (f.regions.length) q = q.in("region", f.regions);
  if (f.types.length) q = q.in("property_type", f.types);
  if (f.condition.length) q = q.in("condition", f.condition);
  if (f.realPhotos) q = q.not("hero_image_path", "is", null).not("hero_image_path", "ilike", "%giustizia.it%").not("hero_image_path", "ilike", "%astegiudiziarie%").not("hero_image_path", "ilike", "%astetraprivati%");
  if (f.minPrice > 0) q = q.gte("price_eur", f.minPrice);
  if (f.maxPrice > 0) q = q.lte("price_eur", f.maxPrice);
  // Shares of a cellar, 15 m² "houses", €900 lots: never what a buyer means.
  q = q.eq("is_scrap", false);
  if (f.minSurface > 0) q = q.gte("surface_sqm", f.minSurface);
  if (f.minScore > 0) q = q.gte("score", f.minScore);
  if (f.unsold) q = q.eq("previous_auction_failed", true);
  if (f.hideClosed) q = q.not("status", "in", "(closed,withdrawn)");
  q = q.or(`sale_type.in.(${allowedSaleTypes(f).join(",")}),sale_type.is.null`);
  const { data, error, count } = await q;
  if (error) throw error;
  return { rows: data ?? [], total: count ?? data?.length ?? 0 };
}

export function forYouScore(r: FeedRow, p: Profile | null) {
  let s = r.score ?? 0;
  if (inRegions(r, p)) s += 10;
  const b = budgetFit(r, p);
  if (b === "within") s += 10;
  if (b === "over") s -= 30;
  return s;
}

export function inRegions(r: FeedRow, p: Profile | null) {
  return !!r.region && !!p?.preferred_regions?.includes(r.region);
}

export function budgetFit(r: FeedRow, p: Profile | null): "within" | "over" | null {
  if (r.price_eur == null || !p?.budget_max_eur) return null;
  return r.price_eur <= p.budget_max_eur ? "within" : "over";
}

const num = (v: number | null | undefined, d: number) => (v == null ? d : v);

export function sortFeed(rows: FeedRow[], sort: string, p: Profile | null) {
  const r = [...rows];
  switch (sort) {
    case "cheapest":
      return r.sort((a, b) => num(a.price_eur, Infinity) - num(b.price_eur, Infinity));
    case "closing":
      return r
        .filter((x) => (x.days_left ?? 0) > 0)
        .sort((a, b) => num(a.days_left, Infinity) - num(b.days_left, Infinity));
    case "discount":
      return r.sort((a, b) => num(b.discount_pct, -1) - num(a.discount_pct, -1));
    case "newest":
      return r.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
    case "foryou":
      return r.sort((a, b) => Number(!!b.has_real_photo) - Number(!!a.has_real_photo) || forYouScore(b, p) - forYouScore(a, p));
    default:
      return r.sort((a, b) => Number(!!b.has_real_photo) - Number(!!a.has_real_photo) || num(b.score, -1) - num(a.score, -1));
  }
}

/** "Under €50k" means a €30k to €50k house to a buyer, not a €4k field. Below about 60% of the
 * ceiling the stock is mostly plots, shares and ruins, so a stated ceiling becomes a band. */
export function budgetBand(max: number): { minPrice: number; maxPrice: number } {
  if (max < 20000) return { minPrice: 0, maxPrice: max };
  return { minPrice: Math.round((max * 0.6) / 5000) * 5000, maxPrice: max };
}

/** Court inspection photos are low-resolution scanned pages, not listing photos. */
export function isCourtPhoto(u: string | null | undefined) {
  return !!u && /giustizia\.it|astegiudiziarie|astetraprivati|notariato\.it/i.test(u);
}

export const CONDITION_LABELS: Record<string, string> = {
  ruin: "Brave souls only", needs_work: "Needs some love", ready: "Just add you",
};

export function photoUrls(r: Pick<FeedRow, "photo_urls">): string[] {
  return Array.isArray(r.photo_urls) ? r.photo_urls.filter((u): u is string => typeof u === "string") : [];
}

export function filtersOf(s: FeedSearch): FeedFilters {
  const { sort: _s, prefs: _p, ...f } = s;
  return f;
}

/** Storage path in 'listing-images', or a full URL for official photos hotlinked from the source. */
export function renderUrl(path: string | null | undefined) {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  return supabase.storage.from("listing-images").getPublicUrl(path).data.publicUrl;
}
