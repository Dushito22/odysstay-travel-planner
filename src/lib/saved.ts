import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { DEFAULT_FILTERS, showDemo, TYPE_LABELS, type FeedRow, type FeedSearch } from "./feed";

export type SavedListing = {
  listing_id: string;
  note: string | null;
  created_at: string;
  listing: FeedRow | null;
};
export type SavedSearch = Database["public"]["Tables"]["saved_searches"]["Row"];

export const savedListingsQuery = queryOptions({
  queryKey: ["saved-listings"],
  queryFn: async (): Promise<SavedListing[]> => {
    const { data, error } = await supabase
      .from("saved_listings")
      .select("listing_id, note, created_at");
    if (error) throw error;
    const ids = (data ?? []).map((s) => s.listing_id);
    let rows: FeedRow[] = [];
    if (ids.length) {
      let q = supabase.from("listing_feed").select("*").in("id", ids);
      if (!showDemo) q = q.eq("is_demo", false);
      const r = await q;
      if (r.error) throw r.error;
      rows = r.data ?? [];
    }
    const byId = new Map(rows.map((r) => [r.id, r]));
    return (data ?? [])
      .map((s) => ({ ...s, listing: byId.get(s.listing_id) ?? null }))
      .sort((a, b) => {
        // Soonest open deadline first, then listings without a deadline, then closed ones.
        const da = a.listing?.deadline_at ?? "9999";
        const db = b.listing?.deadline_at ?? "9999";
        const today = new Date().toISOString().slice(0, 10);
        const ca = da < today ? 1 : 0;
        const cb = db < today ? 1 : 0;
        return ca - cb || da.localeCompare(db);
      });
  },
});

export async function saveListingNote(listingId: string, note: string) {
  const { error } = await supabase
    .from("saved_listings")
    .update({ note: note.trim() || null })
    .eq("listing_id", listingId);
  if (error) throw error;
}

export async function unsaveListing(listingId: string) {
  const { error } = await supabase.from("saved_listings").delete().eq("listing_id", listingId);
  if (error) throw error;
}

export const savedSearchesQuery = queryOptions({
  queryKey: ["saved-searches"],
  queryFn: async (): Promise<SavedSearch[]> => {
    const { data, error } = await supabase
      .from("saved_searches")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
});

export async function setSearchNotify(id: string, on: boolean) {
  const { error } = await supabase.from("saved_searches").update({ notify_email: on }).eq("id", id);
  if (error) throw error;
}

export async function deleteSearch(id: string) {
  const { error } = await supabase.from("saved_searches").delete().eq("id", id);
  if (error) throw error;
}

const PLURAL: Record<string, string> = {
  house: "houses",
  apartment: "apartments",
  building: "buildings",
  rural_house: "rural houses",
  land: "land",
  commercial: "commercial",
  garage: "garages",
  mixed: "mixed use",
  other: "other",
};

const eur = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

/** Saved filters back into a /discover search. Unknown keys are dropped. */
export function searchFromFilters(j: Json): FeedSearch {
  const f = (j && typeof j === "object" && !Array.isArray(j) ? j : {}) as Record<string, unknown>;
  const arr = (v: unknown) =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
  return {
    sort: typeof f["sort"] === "string" ? f["sort"] : "best",
    regions: arr(f["regions"]),
    types: arr(f["types"]),
    maxPrice: num(f["maxPrice"]),
    minSurface: num(f["minSurface"]),
    minScore: num(f["minScore"]),
    leases: bool(f["leases"], DEFAULT_FILTERS.leases),
    oneEuro: bool(f["oneEuro"], DEFAULT_FILTERS.oneEuro),
    unsold: bool(f["unsold"], DEFAULT_FILTERS.unsold),
    hideClosed: bool(f["hideClosed"], DEFAULT_FILTERS.hideClosed),
    prefs: false,
  };
}

/** e.g. "Sardegna, Sicilia · under €80,000 · houses" */
export function summarizeFilters(j: Json): string {
  const s = searchFromFilters(j);
  const parts: string[] = [];
  parts.push(s.regions.length ? s.regions.join(", ") : "All of Italy");
  if (s.maxPrice > 0) parts.push(`under ${eur.format(s.maxPrice)}`);
  if (s.types.length)
    parts.push(s.types.map((t) => PLURAL[t] ?? (TYPE_LABELS[t] ?? t).toLowerCase()).join(", "));
  if (s.minSurface > 0) parts.push(`${s.minSurface} m² or more`);
  if (s.minScore > 0) parts.push(`score ${s.minScore}+`);
  if (s.unsold) parts.push("previously unsold");
  if (s.leases) parts.push("incl. concessions and leases");
  if (!s.oneEuro) parts.push("no one-euro schemes");
  return parts.join(" · ");
}
