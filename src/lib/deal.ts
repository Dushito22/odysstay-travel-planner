import { queryOptions } from "@tanstack/react-query";
import { notFound } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import type { FeedRow } from "./feed";

type T = Database["public"]["Tables"];
export type Deal = T["deals"]["Row"];
export type DealTask = T["deal_tasks"]["Row"];
export type Contact = T["contacts"]["Row"];
export type DealThread = T["threads"]["Row"] & { contacts: Contact | null };
export type DealMessage = T["messages"]["Row"];
export type DealQuote = T["quotes"]["Row"] & { contacts: Contact | null };
export type DealEvent = T["deal_events"]["Row"];
export type VaultDoc = T["user_documents"]["Row"];

export type DealWithListing = Deal & { listing: FeedRow | null };

export const STAGES = [
  { value: "interested", label: "Interested" },
  { value: "researching", label: "Researching" },
  { value: "contacting", label: "Contacting" },
  { value: "viewing", label: "Viewing" },
  { value: "preparing_bid", label: "Preparing bid" },
  { value: "submitted", label: "Submitted" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
] as const;

export const CLOSED_DEAL_STAGES = ["won", "lost", "withdrawn"];

export function stageLabel(s: string) {
  const known = STAGES.find((x) => x.value === s);
  if (known) return known.label;
  return s === "withdrawn" ? "Withdrawn" : s.replace(/_/g, " ");
}

export const TASK_STATUSES = [
  { value: "todo", label: "To do" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
  { value: "blocked", label: "Blocked" },
  { value: "skipped", label: "Skipped" },
] as const;

export function taskStatusLabel(s: string) {
  return TASK_STATUSES.find((x) => x.value === s)?.label ?? s.replace(/_/g, " ");
}

export const CONTACT_KINDS = [
  { value: "comune_office", label: "Comune office (town hall)" },
  { value: "notary", label: "Notary" },
  { value: "surveyor", label: "Surveyor (geometra)" },
  { value: "lawyer", label: "Lawyer" },
  { value: "seller", label: "Seller or court sale delegate" },
  { value: "other", label: "Other" },
] as const;

export const REQUEST_PURPOSES = [
  "Ask for the floor plan and cadastral documents",
  "Ask to arrange a viewing",
  "Ask for a renovation quote",
  "Ask for a site inspection quote",
  "Ask how to submit an offer",
] as const;

export function isTaskOverdue(t: Pick<DealTask, "due_at" | "status">, now = new Date()) {
  return !!t.due_at && new Date(t.due_at) < now && t.status !== "done" && t.status !== "skipped";
}

export function needsYouCount(
  messages: Pick<DealMessage, "status">[],
  tasks: Pick<DealTask, "due_at" | "status">[],
  now = new Date(),
) {
  return messages.filter((m) => m.status === "awaiting_approval").length + tasks.filter((t) => isTaskOverdue(t, now)).length;
}

export function groupDeals(deals: DealWithListing[]) {
  const active: DealWithListing[] = [];
  const submitted: DealWithListing[] = [];
  const closed: DealWithListing[] = [];
  for (const d of deals) {
    if (CLOSED_DEAL_STAGES.includes(d.stage)) closed.push(d);
    else if (d.stage === "submitted") submitted.push(d);
    else active.push(d);
  }
  return { active, submitted, closed };
}

/** Binding actions (binding messages, quote acceptance) need the user to type CONFIRM. */
export class ConfirmRequired extends Error {}
export function assertConfirmed(binding: boolean, typed: string) {
  if (binding && typed.trim() !== "CONFIRM") throw new ConfirmRequired("Type CONFIRM to approve this binding action.");
}

/** deals.notes is a text column; we store a JSON object with free text and relevant vault document ids. */
export type DealNotes = { text: string; documents: string[] };

export function parseDealNotes(raw: string | null): DealNotes {
  if (!raw) return { text: "", documents: [] };
  try {
    const j: unknown = JSON.parse(raw);
    if (j && typeof j === "object" && !Array.isArray(j)) {
      const o = j as Record<string, unknown>;
      return {
        text: typeof o["text"] === "string" ? o["text"] : "",
        documents: Array.isArray(o["documents"]) ? o["documents"].filter((x): x is string => typeof x === "string") : [],
      };
    }
  } catch {
    // plain free-text note
  }
  return { text: raw, documents: [] };
}

export function serializeDealNotes(n: DealNotes): string | null {
  if (!n.text.trim() && n.documents.length === 0) return null;
  return JSON.stringify({ text: n.text, documents: n.documents });
}

async function myId() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("signin");
  return data.user.id;
}

async function logEvent(dealId: string, action: string, detail: { [key: string]: Json | undefined } = {}) {
  const { error } = await supabase.from("deal_events").insert({ deal_id: dealId, actor: "user", action, detail });
  if (error) throw error;
}

async function fetchListings(ids: string[]) {
  if (!ids.length) return new Map<string, FeedRow>();
  const { data, error } = await supabase.from("listing_feed").select("*").in("id", ids);
  if (error) throw error;
  return new Map((data ?? []).map((l) => [l.id, l]));
}

export const dealsQuery = queryOptions({
  queryKey: ["deals"],
  queryFn: async (): Promise<DealWithListing[]> => {
    const { data: deals, error } = await supabase.from("deals").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    const byId = await fetchListings([...new Set((deals ?? []).map((d) => d.listing_id))]);
    return (deals ?? []).map((d) => ({ ...d, listing: byId.get(d.listing_id) ?? null }));
  },
});

/** Per-deal "needs you" counts: messages awaiting approval + overdue tasks. */
export const dealsAttentionQuery = queryOptions({
  queryKey: ["deals-attention"],
  queryFn: async (): Promise<Record<string, number>> => {
    const { data: deals, error } = await supabase.from("deals").select("id");
    if (error) throw error;
    const dealIds = (deals ?? []).map((d) => d.id);
    if (!dealIds.length) return {};
    const { data: threads, error: tErr } = await supabase.from("threads").select("id, deal_id").in("deal_id", dealIds);
    if (tErr) throw tErr;
    const threadIds = (threads ?? []).map((t) => t.id);
    const dealOfThread = new Map((threads ?? []).map((t) => [t.id, t.deal_id]));
    const now = new Date().toISOString();
    const [msgs, tasks] = await Promise.all([
      threadIds.length
        ? supabase.from("messages").select("thread_id").in("thread_id", threadIds).eq("status", "awaiting_approval")
        : Promise.resolve({ data: [] as { thread_id: string }[], error: null }),
      supabase.from("deal_tasks").select("deal_id").in("deal_id", dealIds).lt("due_at", now).not("status", "in", "(done,skipped)"),
    ]);
    if (msgs.error) throw msgs.error;
    if (tasks.error) throw tasks.error;
    const byDeal: Record<string, number> = {};
    for (const m of msgs.data ?? []) {
      const d = dealOfThread.get(m.thread_id);
      if (d) byDeal[d] = (byDeal[d] ?? 0) + 1;
    }
    for (const t of tasks.data ?? []) byDeal[t.deal_id] = (byDeal[t.deal_id] ?? 0) + 1;
    return byDeal;
  },
});

export type DealBundle = {
  deal: Deal;
  listing: FeedRow | null;
  tasks: DealTask[];
  threads: DealThread[];
  messages: DealMessage[];
  quotes: DealQuote[];
  events: DealEvent[];
  vaultDocs: VaultDoc[];
  userId: string;
};

export const dealQuery = (id: string) =>
  queryOptions({
    queryKey: ["deal", id],
    queryFn: async (): Promise<DealBundle> => {
      if (!/^[0-9a-f-]{36}$/i.test(id)) throw notFound();
      const userId = await myId();
      const { data: deal, error } = await supabase.from("deals").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      if (!deal) throw notFound();
      const [l, t, th, e, v, q] = await Promise.all([
        fetchListings([deal.listing_id]),
        supabase.from("deal_tasks").select("*").eq("deal_id", id).order("sort"),
        supabase.from("threads").select("*, contacts(*)").eq("deal_id", id).order("last_message_at", { ascending: false, nullsFirst: false }),
        supabase.from("deal_events").select("*").eq("deal_id", id).order("created_at", { ascending: false }),
        supabase.from("user_documents").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
        supabase.from("quotes").select("*, contacts(*)").eq("deal_id", id).order("created_at", { ascending: false }),
      ]);
      for (const r of [t, th, e, v, q]) if (r.error) throw r.error;
      const threadIds = (th.data ?? []).map((x) => x.id);
      const m = threadIds.length
        ? await supabase.from("messages").select("*").in("thread_id", threadIds).order("created_at")
        : { data: [] as DealMessage[], error: null };
      if (m.error) throw m.error;
      return {
        deal,
        listing: l.get(deal.listing_id) ?? null,
        tasks: t.data ?? [],
        threads: (th.data ?? []) as DealThread[],
        messages: m.data ?? [],
        quotes: (q.data ?? []) as DealQuote[],
        events: e.data ?? [],
        vaultDocs: v.data ?? [],
        userId,
      };
    },
  });

export async function setStage(deal: Deal, to: string) {
  if (to === deal.stage) return;
  const { error } = await supabase.from("deals").update({ stage: to }).eq("id", deal.id);
  if (error) throw error;
  await logEvent(deal.id, "stage_changed", { from: deal.stage, to });
}

export class NeedsEmail extends Error {}

/** Approves and actually sends: Argos emails it from argos@odysstay.xyz with replies routed back here.
 * Throws NeedsEmail when we have no address for the recipient yet; pass `email` to send to one. */
export async function approveMessage(msg: DealMessage, _userId: string, typedConfirm: string, email?: string) {
  assertConfirmed(msg.is_binding, typedConfirm);
  const { data, error } = await supabase.functions.invoke("send-message", { body: { message_id: msg.id, confirm: typedConfirm, email } });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const j = ctx ? await ctx.json().catch(() => null) : null;
    throw new Error(j?.error ?? error.message);
  }
  if (data?.needs_email) throw new NeedsEmail("needs email");
  return data as { sent: boolean; to?: string };
}

export async function rejectMessage(msg: DealMessage) {
  const { error } = await supabase.from("messages").update({ status: "rejected" }).eq("id", msg.id);
  if (error) throw error;
  const { data: thread } = await supabase.from("threads").select("deal_id").eq("id", msg.thread_id).single();
  if (thread) await logEvent(thread.deal_id, "message_rejected", { message_id: msg.id });
}

export async function saveMessageBody(id: string, bodyOriginal: string) {
  const { error } = await supabase.from("messages").update({ body_original: bodyOriginal }).eq("id", id);
  if (error) throw error;
}

export async function markMessageSent(msg: DealMessage) {
  const { error } = await supabase
    .from("messages")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", msg.id);
  if (error) throw error;
  const { data: thread } = await supabase.from("threads").select("deal_id").eq("id", msg.thread_id).single();
  if (thread) await logEvent(thread.deal_id, "message_marked_sent", { message_id: msg.id });
}

export async function addNote(threadId: string, text: string) {
  const { error } = await supabase.from("messages").insert({
    thread_id: threadId,
    direction: "note",
    status: "sent",
    is_binding: false,
    language: "en",
    body_original: text,
    body_en: text,
    attachments: [],
    ai_generated: false,
  });
  if (error) throw error;
}

/** Placeholder until AI drafting ships: creates an open thread with a draft message. */
export async function createRequest(dealId: string, recipientKind: string, purpose: string) {
  const { data: thread, error } = await supabase
    .from("threads")
    .insert({ deal_id: dealId, channel: "email", subject: purpose, purpose_en: purpose, status: "open" })
    .select("id")
    .single();
  if (error) throw error;
  const { error: mErr } = await supabase.from("messages").insert({
    thread_id: thread.id,
    direction: "outbound",
    status: "draft",
    is_binding: false,
    language: "it",
    subject: purpose,
    body_original: "Draft being prepared...",
    attachments: [{ recipient_kind: recipientKind }],
    ai_generated: false,
  });
  if (mErr) throw mErr;
  await logEvent(dealId, "request_created", { thread_id: thread.id, purpose, recipient_kind: recipientKind });
  return thread.id;
}

export async function updateTask(id: string, patch: Partial<Pick<DealTask, "status" | "due_at" | "detail_en" | "official_url" | "sort" | "title_en">>) {
  const { error } = await supabase.from("deal_tasks").update(patch).eq("id", id);
  if (error) throw error;
}

export async function addTask(dealId: string, title: string, sort: number) {
  const { error } = await supabase.from("deal_tasks").insert({ deal_id: dealId, title_en: title, kind: "step", status: "todo", sort });
  if (error) throw error;
}

/** Adds a task at the end of the plan. */
export async function appendTask(dealId: string, title: string) {
  const { data, error } = await supabase
    .from("deal_tasks").select("sort").eq("deal_id", dealId).order("sort", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  await addTask(dealId, title, (data?.sort ?? 0) + 1);
}

/** Swap the sort values of two tasks to move one up or down. */
export async function moveTask(a: DealTask, b: DealTask) {
  const r1 = await supabase.from("deal_tasks").update({ sort: b.sort }).eq("id", a.id);
  if (r1.error) throw r1.error;
  const r2 = await supabase.from("deal_tasks").update({ sort: a.sort }).eq("id", b.id);
  if (r2.error) throw r2.error;
}

export async function setQuoteStatus(dealId: string, quote: DealQuote, status: "accepted" | "declined", typedConfirm: string) {
  assertConfirmed(status === "accepted", typedConfirm);
  const { error } = await supabase.from("quotes").update({ status }).eq("id", quote.id);
  if (error) throw error;
  await logEvent(dealId, status === "accepted" ? "quote_accepted" : "quote_declined", { quote_id: quote.id });
}

export async function updateDealSettings(dealId: string, patch: Partial<Pick<Deal, "autonomy" | "max_bid_eur" | "notes">>) {
  const { error } = await supabase.from("deals").update(patch).eq("id", dealId);
  if (error) throw error;
}

export async function withdrawDeal(deal: Deal) {
  const { error } = await supabase.from("deals").update({ stage: "withdrawn" }).eq("id", deal.id);
  if (error) throw error;
  await logEvent(deal.id, "stage_changed", { from: deal.stage, to: "withdrawn" });
}

export async function toggleDealDocument(deal: Deal, docId: string) {
  const notes = parseDealNotes(deal.notes);
  const has = notes.documents.includes(docId);
  const next: DealNotes = { ...notes, documents: has ? notes.documents.filter((x) => x !== docId) : [...notes.documents, docId] };
  await updateDealSettings(deal.id, { notes: serializeDealNotes(next) });
}

// ---------- Inbox ----------

export type InboxItem = {
  kind: "approval" | "inbound" | "overdue_task" | "deadline";
  dealId: string;
  dealLabel: string;
  title: string;
  detail: string | null;
  date: string;
  binding?: boolean;
};

export const inboxQuery = queryOptions({
  queryKey: ["inbox"],
  queryFn: async (): Promise<InboxItem[]> => {
    const { data: deals, error } = await supabase.from("deals").select("id, listing_id, stage").order("created_at", { ascending: false });
    if (error) throw error;
    if (!deals?.length) return [];
    const dealIds = deals.map((d) => d.id);
    const listings = await fetchListings([...new Set(deals.map((d) => d.listing_id))]);
    const labelOf = (dealId: string) => {
      const d = deals.find((x) => x.id === dealId);
      const l = d ? listings.get(d.listing_id) : null;
      return l?.comune ?? "Deal";
    };
    const { data: threads, error: tErr } = await supabase.from("threads").select("id, deal_id, subject").in("deal_id", dealIds);
    if (tErr) throw tErr;
    const threadById = new Map((threads ?? []).map((t) => [t.id, t]));
    const threadIds = (threads ?? []).map((t) => t.id);

    const now = new Date();
    const nowIso = now.toISOString();
    const in14 = new Date(now.getTime() - 14 * 86400000).toISOString();
    const in7 = new Date(now.getTime() + 7 * 86400000).toISOString();

    const [approvals, inbound, overdue, dueSoon] = await Promise.all([
      threadIds.length
        ? supabase.from("messages").select("*").in("thread_id", threadIds).eq("status", "awaiting_approval")
        : Promise.resolve({ data: [] as DealMessage[], error: null }),
      threadIds.length
        ? supabase.from("messages").select("*").in("thread_id", threadIds).eq("direction", "inbound").gte("created_at", in14)
        : Promise.resolve({ data: [] as DealMessage[], error: null }),
      supabase.from("deal_tasks").select("*").in("deal_id", dealIds).lt("due_at", nowIso).not("status", "in", "(done,skipped)"),
      supabase.from("deal_tasks").select("*").in("deal_id", dealIds).gte("due_at", nowIso).lte("due_at", in7).not("status", "in", "(done,skipped)"),
    ]);
    for (const r of [approvals, inbound, overdue, dueSoon]) if (r.error) throw r.error;

    const items: InboxItem[] = [];
    for (const m of approvals.data ?? []) {
      const t = threadById.get(m.thread_id);
      if (!t) continue;
      items.push({
        kind: "approval", dealId: t.deal_id, dealLabel: labelOf(t.deal_id), binding: m.is_binding,
        title: m.subject ?? t.subject ?? "Message awaiting approval",
        detail: "Review and approve this message", date: m.created_at,
      });
    }
    for (const m of inbound.data ?? []) {
      const t = threadById.get(m.thread_id);
      if (!t) continue;
      items.push({
        kind: "inbound", dealId: t.deal_id, dealLabel: labelOf(t.deal_id),
        title: m.subject ?? t.subject ?? "New reply",
        detail: m.body_en ?? m.body_original.slice(0, 140), date: m.created_at,
      });
    }
    for (const task of overdue.data ?? []) {
      items.push({
        kind: "overdue_task", dealId: task.deal_id, dealLabel: labelOf(task.deal_id),
        title: task.title_en, detail: "Task is past due", date: task.due_at!,
      });
    }
    for (const task of dueSoon.data ?? []) {
      items.push({
        kind: "deadline", dealId: task.deal_id, dealLabel: labelOf(task.deal_id),
        title: task.title_en, detail: "Task due soon", date: task.due_at!,
      });
    }
    for (const d of deals) {
      if (CLOSED_DEAL_STAGES.includes(d.stage)) continue;
      const l = listings.get(d.listing_id);
      if (l?.deadline_at && l.deadline_at >= nowIso.slice(0, 10) && l.deadline_at <= in7.slice(0, 10)) {
        items.push({
          kind: "deadline", dealId: d.id, dealLabel: labelOf(d.id),
          title: "Offer deadline", detail: "The notice deadline is within 7 days", date: l.deadline_at,
        });
      }
    }
    return items.sort((a, b) => b.date.localeCompare(a.date));
  },
});

/** Count for the Inbox nav badge: approvals + overdue tasks. */
export const inboxCountQuery = queryOptions({
  queryKey: ["inbox-count"],
  queryFn: async (): Promise<number> => {
    const { data: deals, error } = await supabase.from("deals").select("id");
    if (error) throw error;
    const dealIds = (deals ?? []).map((d) => d.id);
    if (!dealIds.length) return 0;
    const { data: threads, error: tErr } = await supabase.from("threads").select("id").in("deal_id", dealIds);
    if (tErr) throw tErr;
    const threadIds = (threads ?? []).map((t) => t.id);
    const now = new Date().toISOString();
    const [msgs, tasks] = await Promise.all([
      threadIds.length
        ? supabase.from("messages").select("id", { count: "exact", head: true }).in("thread_id", threadIds).eq("status", "awaiting_approval")
        : Promise.resolve({ count: 0, error: null }),
      supabase.from("deal_tasks").select("id", { count: "exact", head: true }).in("deal_id", dealIds).lt("due_at", now).not("status", "in", "(done,skipped)"),
    ]);
    if (msgs.error) throw msgs.error;
    if (tasks.error) throw tasks.error;
    return (msgs.count ?? 0) + (tasks.count ?? 0);
  },
});
