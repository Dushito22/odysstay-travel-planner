import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { showDemo, type FeedRow } from "./feed";

/** Highest-scoring open listings, for the landing page and the signed-out preview. */
export const topListingsQuery = (limit: number, withPhotos = false) =>
  queryOptions({
    queryKey: ["top-listings", limit, withPhotos],
    queryFn: async (): Promise<FeedRow[]> => {
      let q = supabase
        .from("listing_feed")
        .select("*")
        .not("status", "in", "(closed,withdrawn)")
        .not("sale_type", "in", "(concession,lease)")
        .order("score", { ascending: false, nullsFirst: false })
        .limit(limit);
      if (withPhotos) q = q.not("hero_image_path", "is", null);
      if (!showDemo) q = q.eq("is_demo", false);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60_000,
  });

/** Live counts for the numbers strip. */
export const sourceCountsQuery = queryOptions({
  queryKey: ["source-counts"],
  queryFn: async () => {
    const count = async (saleType: string) => {
      const { count } = await supabase.from("listing_feed").select("id", { count: "exact", head: true })
        .eq("sale_type", saleType).not("status", "in", "(closed,withdrawn)");
      return count ?? 0;
    };
    const [court, notary, oneEuro, privateSales] = await Promise.all([
      count("auction_judicial"), count("auction_notary"), count("one_euro"), count("sale"),
    ]);
    return { court, notary, oneEuro, privateSales };
  },
  staleTime: 30 * 60_000,
});

export type ExampleFact = Database["public"]["Tables"]["listing_facts"]["Row"] & {
  source_url: string | null;
  comune: string | null;
};

/** One real verified fact to show how sourcing works. Prefers a deadline or price with an English translation. */
export const exampleFactQuery = (listing: FeedRow | undefined) =>
  queryOptions({
    queryKey: ["example-fact", listing?.id ?? null],
    enabled: !!listing?.id,
    queryFn: async (): Promise<ExampleFact | null> => {
      if (!listing?.id) return null;
      const { data, error } = await supabase
        .from("listing_facts")
        .select("*")
        .eq("listing_id", listing.id)
        .in("key", ["deadline", "price_eur", "previous_auction_failed", "occupancy"]);
      if (error) throw error;
      const rank = ["deadline", "price_eur", "previous_auction_failed", "occupancy"];
      const pick = (data ?? []).sort((a, b) => rank.indexOf(a.key) - rank.indexOf(b.key))[0];
      return pick ? { ...pick, source_url: listing.source_url, comune: listing.comune } : null;
    },
    staleTime: 5 * 60_000,
  });

export async function sendMagicLink(email: string, redirect = "/discover") {
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: {
      emailRedirectTo: `${window.location.origin}/login?redirect=${encodeURIComponent(redirect)}`,
    },
  });
  if (error) throw error;
}
