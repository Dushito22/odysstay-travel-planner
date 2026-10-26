// Answers questions about one listing, grounded only in verified data and the notice text.
import {
  AGENT_SYSTEM,
  buildAgentContext,
  parseAgentReply,
  type FactRow,
  type FlagRow,
  type GrantRow,
} from "../_shared/agent-core.ts";
import {
  adminClient,
  callClaude,
  HttpError,
  json,
  loadListing,
  requireUser,
  serve,
  str,
  uuid,
} from "../_shared/runtime.ts";

serve(async (req, body) => {
  const admin = adminClient();
  const user = await requireUser(req, admin);
  const message = str(body["message"], "message", { max: 2000 });
  let conversationId = uuid(body["conversation_id"], "conversation_id", false);
  let listingId = uuid(body["listing_id"], "listing_id", false);
  let dealId = uuid(body["deal_id"], "deal_id", false);

  // Ownership: conversation and deal must belong to the caller.
  if (conversationId) {
    const { data: c } = await admin
      .from("agent_conversations")
      .select("*")
      .eq("id", conversationId)
      .maybeSingle();
    if (!c || c.user_id !== user.id) throw new HttpError(404, "Conversation not found");
    listingId ??= c.listing_id;
    dealId ??= c.deal_id;
  }
  let deal: { id: string; stage: string; listing_id: string } | null = null;
  if (dealId) {
    const { data: d } = await admin
      .from("deals")
      .select("id, stage, listing_id, user_id")
      .eq("id", dealId)
      .maybeSingle();
    if (!d || d.user_id !== user.id) throw new HttpError(404, "Deal not found");
    deal = d;
    listingId ??= d.listing_id;
  }
  if (!listingId) throw new HttpError(400, "Missing listing_id");

  // Rate limit: 60 questions per user per hour.
  const since = new Date(Date.now() - 3600_000).toISOString();
  const { data: convs } = await admin
    .from("agent_conversations")
    .select("id")
    .eq("user_id", user.id);
  const convIds = (convs ?? []).map((c) => c.id);
  if (convIds.length) {
    const { count } = await admin
      .from("agent_messages")
      .select("id", { count: "exact", head: true })
      .in("conversation_id", convIds)
      .eq("role", "user")
      .gte("created_at", since);
    if ((count ?? 0) >= 60)
      throw new HttpError(
        429,
        "You've asked a lot in the last hour. Please try again a bit later.",
      );
  }

  const bundle = await loadListing(admin, listingId);
  const l = bundle.listing;

  if (!conversationId) {
    const { data: c, error } = await admin
      .from("agent_conversations")
      .insert({
        user_id: user.id,
        listing_id: listingId,
        deal_id: deal?.id ?? null,
        country: l.country ?? "IT",
      })
      .select("id")
      .single();
    if (error) throw error;
    conversationId = c.id;
  }

  const [{ data: profile }, { data: doc }, { data: history }, tasks] = await Promise.all([
    admin
      .from("profiles")
      .select("intent, budget_max_eur, has_codice_fiscale, has_pec, can_move_residency")
      .eq("id", user.id)
      .maybeSingle(),
    l.document_id
      ? admin.from("documents").select("text_content").eq("id", l.document_id).maybeSingle()
      : Promise.resolve({ data: null }),
    admin
      .from("agent_messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(20),
    deal
      ? admin
          .from("deal_tasks")
          .select("title_en, status, due_at")
          .eq("deal_id", deal.id)
          .order("sort")
      : Promise.resolve({ data: [] }),
  ]);

  const { error: insErr } = await admin
    .from("agent_messages")
    .insert({ conversation_id: conversationId, role: "user", content: message });
  if (insErr) throw insErr;

  const context = buildAgentContext({
    listing: l,
    facts: bundle.facts as FactRow[],
    flags: bundle.flags as FlagRow[],
    estimates: bundle.estimates,
    grants: bundle.grants as unknown as GrantRow[],
    noticeText: (doc as { text_content?: string } | null)?.text_content ?? null,
    deal: deal
      ? {
          stage: deal.stage,
          tasks: (tasks.data ?? []) as {
            title_en: string;
            status: string;
            due_at: string | null;
          }[],
        }
      : null,
    profile: profile ?? null,
  });

  const past = (history ?? [])
    .reverse()
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
  const raw = await callClaude(AGENT_SYSTEM + "\n\n" + context, [
    ...past,
    { role: "user", content: message },
  ]);
  const parsed = parseAgentReply(raw, {
    facts: bundle.facts as FactRow[],
    flags: bundle.flags as FlagRow[],
    grants: bundle.grants as unknown as GrantRow[],
    sourceUrl: l.source_url,
  });

  const { data: saved, error: aErr } = await admin
    .from("agent_messages")
    .insert({
      conversation_id: conversationId,
      role: "assistant",
      content: parsed.content,
      citations: parsed.citations,
    })
    .select("id, created_at")
    .single();
  if (aErr) throw aErr;

  return json({
    conversation_id: conversationId,
    message: {
      id: saved.id,
      role: "assistant",
      content: parsed.content,
      citations: parsed.citations,
      created_at: saved.created_at,
    },
    actions: parsed.actions,
  });
});
