import { queryOptions } from "@tanstack/react-query";
import { notFound } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { showDemo, type FeedRow } from "./feed";

type T = Database["public"]["Tables"];
export type Fact = T["listing_facts"]["Row"];
export type RedFlag = T["listing_red_flags"]["Row"];
export type ListingImage = T["listing_images"]["Row"];
export type CostEstimate = T["cost_estimates"]["Row"];
export type Grant = T["grants"]["Row"];
export type ListingGrant = T["listing_grants"]["Row"] & { grants: Grant | null };

export type ListingBundle = {
  listing: FeedRow;
  facts: Fact[];
  flags: RedFlag[];
  grants: ListingGrant[];
  deep: DeepDive | null;
};
export type DeepDive = T["deep_dives"]["Row"];

export const FACT_ORDER = [
  "price_eur", "min_offer_eur", "appraisal_eur", "min_raise_eur", "deposit_eur", "deposit", "deadline", "auction_date",
  "surface_sqm", "perizia_surface_sqm", "land_sqm", "property_type", "condition", "year_built", "energy_class",
  "regularisation_cost_eur", "condo_arrears_eur", "occupancy", "sale_type", "previous_auction_failed", "sale_mode",
  "bid_method", "court", "contact", "description",
];

export function orderFacts(facts: Fact[]) {
  const rank = (k: string) => {
    const i = FACT_ORDER.indexOf(k);
    return i === -1 ? FACT_ORDER.length : i;
  };
  return [...facts].sort((a, b) => rank(a.key) - rank(b.key) || a.label_en.localeCompare(b.label_en));
}

const SEV: Record<string, number> = { high: 0, medium: 1, low: 2 };
export function orderFlags(flags: RedFlag[]) {
  return [...flags].sort((a, b) => (SEV[a.severity] ?? 3) - (SEV[b.severity] ?? 3));
}

export function orderImages(images: ListingImage[]) {
  return [...images].sort((a, b) => {
    const ra = a.kind === "render" ? 0 : 1;
    const rb = b.kind === "render" ? 0 : 1;
    return ra - rb || b.created_at.localeCompare(a.created_at);
  });
}

/** Per scenario, prefer the user's own estimate over the default (user_id null). */
export function pickEstimates(rows: CostEstimate[], userId: string | null) {
  const out: Record<string, CostEstimate> = {};
  for (const r of rows) {
    const cur = out[r.scenario];
    if (!cur || (userId && r.user_id === userId && cur.user_id !== userId)) out[r.scenario] = r;
  }
  return ["light", "standard", "full"].map((s) => out[s]).filter((x): x is CostEstimate => !!x);
}

/** Conditional grant deduction: min(max_eur, pct% of renovation), per bound. Only when both are set. */
export function grantDeduction(g: Pick<Grant, "max_eur" | "pct">, renovation: number) {
  if (g.max_eur == null || g.pct == null) return null;
  return Math.min(g.max_eur, (g.pct / 100) * renovation);
}

export function factValue(f: Fact | undefined) {
  if (!f) return null;
  return f.value_text ?? (f.value_num != null ? String(f.value_num) : null);
}

export const listingQuery = (id: string) =>
  queryOptions({
    queryKey: ["listing", id],
    queryFn: async (): Promise<ListingBundle> => {
      if (!/^[0-9a-f-]{36}$/i.test(id)) throw notFound();
      let q = supabase.from("listing_feed").select("*").eq("id", id);
      if (!showDemo) q = q.eq("is_demo", false);
      const [l, f, r, g, d] = await Promise.all([
        q.maybeSingle(),
        supabase.from("listing_facts").select("*").eq("listing_id", id),
        supabase.from("listing_red_flags").select("*").eq("listing_id", id),
        supabase.from("listing_grants").select("*, grants(*)").eq("listing_id", id),
        supabase.from("deep_dives").select("*").eq("listing_id", id).maybeSingle(),
      ]);
      if (l.error) throw l.error;
      if (!l.data) throw notFound();
      return {
        listing: l.data,
        facts: orderFacts(f.data ?? []),
        flags: orderFlags(r.data ?? []),
        grants: (g.data ?? []) as ListingGrant[],
        deep: d.data ?? null,
      };
    },
  });

export const DEFAULT_TASKS: {
  title_en: string; kind: string; url?: "source" | string; due?: boolean; doneIf?: "has_codice_fiscale" | "has_pec";
}[] = [
  { title_en: "Read the full official notice", kind: "step", url: "source" },
  { title_en: "Get your codice fiscale, the Italian tax number", kind: "document", url: "https://www.agenziaentrate.gov.it", doneIf: "has_codice_fiscale" },
  { title_en: "Set up a PEC certified email address if the notice requires it", kind: "document", doneIf: "has_pec" },
  { title_en: "Ask the seller for the floor plan, cadastral records and energy certificate", kind: "step" },
  { title_en: "Book a site visit with a local surveyor, a geometra", kind: "visit" },
  { title_en: "Get a renovation quote", kind: "step" },
  { title_en: "Pay the deposit exactly as the notice requires", kind: "payment", due: true },
  { title_en: "Prepare and submit the offer by the method in the notice", kind: "deadline", due: true },
  { title_en: "Sign the deed at the notary if you win", kind: "signature" },
];

export function buildTasks(
  dealId: string,
  listing: Pick<FeedRow, "source_url" | "deadline_at">,
  profile: { has_codice_fiscale?: boolean; has_pec?: boolean } | null,
) {
  return DEFAULT_TASKS.map((t, i) => ({
    deal_id: dealId,
    title_en: t.title_en,
    kind: t.kind,
    sort: i + 1,
    official_url: t.url === "source" ? listing.source_url : (t.url ?? null),
    due_at: t.due && listing.deadline_at ? listing.deadline_at : null,
    status: t.doneIf && profile?.[t.doneIf] ? "done" : "todo",
  }));
}

export const CLOSED_STAGES = ["won", "lost", "withdrawn"];

export class UpgradeRequired extends Error {}

export async function startDeal(listing: FeedRow): Promise<string> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user || !listing.id) throw new Error("signin");
  const uid = u.user.id;
  const { data: profile } = await supabase.from("profiles").select("plan, has_codice_fiscale, has_pec").eq("id", uid).maybeSingle();
  if ((profile?.plan ?? "free") === "free") {
    const { count, error } = await supabase
      .from("deals").select("id", { count: "exact", head: true })
      .not("stage", "in", `(${CLOSED_STAGES.join(",")})`);
    if (error) throw error;
    if ((count ?? 0) > 0) throw new UpgradeRequired();
  }
  const { data: deal, error: dErr } = await supabase
    .from("deals").insert({ user_id: uid, listing_id: listing.id, stage: "interested" }).select("id").single();
  if (dErr) throw dErr;
  try {
    const { error: tErr } = await supabase.from("deal_tasks").insert(buildTasks(deal.id, listing, profile));
    if (tErr) throw tErr;
    const { error: eErr } = await supabase.from("deal_events").insert({
      deal_id: deal.id, actor: "user", action: "deal_created", detail: { listing_id: listing.id },
    });
    if (eErr) throw eErr;
  } catch (e) {
    await supabase.from("deal_tasks").delete().eq("deal_id", deal.id);
    await supabase.from("deals").delete().eq("id", deal.id);
    throw e;
  }
  return deal.id;
}
