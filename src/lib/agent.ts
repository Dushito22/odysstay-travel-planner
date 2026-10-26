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

export const RENDER_STYLES = [
  {
    value: "Restored, original character",
    hint: "Original stone, beams and tiles brought back to life",
  },
  { value: "Modern Mediterranean", hint: "Lime plaster, clean lines, warm light" },
  { value: "Minimal Scandinavian", hint: "Pale wood, white walls, very little clutter" },
  { value: "Rustic farmhouse", hint: "Terracotta, timber, kitchen garden" },
] as const;

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

export function generateRender(listingId: string, style: string, photo?: string) {
  return callFunction<{ image: Database["public"]["Tables"]["listing_images"]["Row"] }>(
    "generate-render",
    photo ? { listing_id: listingId, style, photo } : { listing_id: listingId, style },
  );
}

/** Strips the inline citation markers for display; citations are shown as chips instead. */
export function stripMarkers(text: string) {
  return text.replace(/\s?\[(fact|flag|grant):[^\]]+\]|\s?\[(notice|estimate)\]/g, "");
}
