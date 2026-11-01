import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AgentCitation = {
  type: "fact" | "flag" | "notice" | "grant" | "estimate";
  id: string;
  label: string;
  url: string | null;
  quote?: string | null;
  quote_en?: string | null;
};
export type AgentAction =
  | { type: "draft_message"; contact_kind: string; purpose: string }
  | { type: "add_task"; title: string };
export type AgentMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: AgentCitation[];
  created_at: string;
};

export const INTERIOR_STYLES = [
  { value: "Restored, original character", hint: "Original stone, beams and tiles brought back to life" },
  { value: "Modern Mediterranean", hint: "Lime plaster, clean lines, warm light" },
  { value: "Coastal white and blue", hint: "Whitewash, blue shutters, linen, sea light" },
  { value: "Warm Tuscan", hint: "Ochre walls, terracotta floors, olive wood" },
  { value: "Boutique hotel luxury", hint: "Stone, brass, deep colours, statement lighting" },
  { value: "Japandi calm", hint: "Oak, paper lamps, low furniture, quiet tones" },
  { value: "Minimal Scandinavian", hint: "Pale wood, white walls, very little clutter" },
  { value: "Rustic farmhouse", hint: "Terracotta, timber, open kitchen, copper pots" },
  { value: "Industrial loft", hint: "Exposed brick and steel, big open space" },
  { value: "Custom", hint: "Describe exactly what you want" },
] as const;

export const EXTERIOR_STYLES = [
  { value: "Restored stone and shutters", hint: "Bare stone cleaned, green shutters, terracotta roof" },
  { value: "Lime-washed Mediterranean", hint: "Soft pastel plaster, pergola, bougainvillea" },
  { value: "Tuscan country estate", hint: "Ochre walls, cypresses, gravel drive, lavender" },
  { value: "Puglia white", hint: "Whitewashed walls, blue doors, olive trees, dry-stone walls" },
  { value: "Garden and pool", hint: "Lawn, pool, stone terrace, olive trees" },
  { value: "Alpine chalet", hint: "Wooden balconies, stone base, flower boxes" },
  { value: "Contemporary facade", hint: "Smooth plaster, large steel windows, clean landscaping" },
  { value: "Boutique hotel terrace", hint: "Lit terrace, loungers, lush planting at dusk" },
  { value: "Seaside village", hint: "Coloured facade, wrought-iron balconies, potted lemons" },
  { value: "Custom", hint: "Describe exactly what you want" },
] as const;

export const RENDER_STYLES = INTERIOR_STYLES;

export const STARTER_QUESTIONS = [
  "What are the main risks here?",
  "How do I submit an offer for this one?",
  "What's missing from the notice?",
  "Is this a good price for the area?",
];

/** Calls an edge function and turns its JSON error into a readable message. */
export async function callFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    let message = "Something went wrong. Please try again.";
    const ctx = (error as { context?: unknown }).context;
    if (ctx instanceof Response) {
      try {
        const j = (await ctx.clone().json()) as { error?: string };
        if (j?.error) message = j.error;
      } catch {
        // not JSON
      }
    } else if (error.message) {
      message = error.message;
    }
    throw new Error(message);
  }
  return data as T;
}

function asCitations(
  j: Database["public"]["Tables"]["agent_messages"]["Row"]["citations"],
): AgentCitation[] {
  return Array.isArray(j)
    ? (j as unknown as AgentCitation[]).filter((c) => c && typeof c === "object" && "label" in c)
    : [];
}

/** The latest conversation for this listing (and deal, if given), with its messages. */
export const conversationQuery = (listingId: string, dealId: string | null) =>
  queryOptions({
    queryKey: ["agent-conversation", listingId, dealId],
    queryFn: async (): Promise<{ id: string | null; messages: AgentMessage[] }> => {
      let q = supabase.from("agent_conversations").select("id").eq("listing_id", listingId);
      q = dealId ? q.eq("deal_id", dealId) : q.is("deal_id", null);
      const { data: conv, error } = await q
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!conv) return { id: null, messages: [] };
      const { data: msgs, error: mErr } = await supabase
        .from("agent_messages")
        .select("*")
        .eq("conversation_id", conv.id)
        .order("created_at");
      if (mErr) throw mErr;
      return {
        id: conv.id,
        messages: (msgs ?? []).map((m) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          content: m.content,
          citations: asCitations(m.citations),
          created_at: m.created_at,
        })),
      };
    },
  });

export function askAgent(input: {
  conversation_id: string | null;
  listing_id: string;
  deal_id: string | null;
  message: string;
}) {
  return callFunction<{ conversation_id: string; message: AgentMessage; actions: AgentAction[] }>(
    "agent-chat",
    input,
  );
}

export function draftMessage(input: {
  deal_id: string;
  contact_kind: string;
  purpose: string;
  thread_id?: string;
  contact?: { name: string; organisation?: string; email?: string; pec?: string };
}) {
  return callFunction<{ thread_id: string; message_id: string; is_binding: boolean }>(
    "draft-message",
    input,
  );
}

export function generateRender(listingId: string, style: string, photo?: string, wish?: string, view: "interior" | "exterior" = "interior") {
  return callFunction<{ image: Database["public"]["Tables"]["listing_images"]["Row"] }>("generate-render", {
    listing_id: listingId, style, view, ...(photo ? { photo } : {}), ...(wish?.trim() ? { wish: wish.trim() } : {}),
  });
}

/** Strips the inline citation markers for display; citations are shown as chips instead. */
export function stripMarkers(text: string) {
  return text.replace(/\s?\[(fact|flag|grant):[^\]]+\]|\s?\[(notice|estimate)\]/g, "");
}

export type ListingTranslation = Database["public"]["Tables"]["listing_translations"]["Row"];

/** Cached translation of the official description, made once per listing and language. */
export function translateListing(listingId: string, lang: "en" | "ru") {
  return callFunction<{ translation: ListingTranslation }>("translate-listing", { listing_id: listingId, lang });
}
