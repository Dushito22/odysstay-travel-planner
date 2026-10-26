// Drafts a formal Italian email for a deal. It always waits for the user's approval.
import {
  buildDraftContext,
  CONTACT_KINDS,
  DRAFT_SYSTEM,
  ensureDisclosure,
  parseDraft,
  type FactRow,
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
  const dealId = uuid(body["deal_id"], "deal_id")!;
  const purpose = str(body["purpose"], "purpose", { max: 600 });
  const kindIn = str(body["contact_kind"], "contact_kind", { max: 40 });
  const contactKind = CONTACT_KINDS.includes(kindIn) ? kindIn : "other";
  let threadId = uuid(body["thread_id"], "thread_id", false);
  const contactIn = (
    body["contact"] && typeof body["contact"] === "object" ? body["contact"] : null
  ) as Record<string, unknown> | null;

  const { data: deal } = await admin
    .from("deals")
    .select("id, user_id, listing_id")
    .eq("id", dealId)
    .maybeSingle();
  if (!deal || deal.user_id !== user.id) throw new HttpError(404, "Deal not found");

  // Rate limit: 30 drafts per user per day.
  const { count } = await admin
    .from("deal_events")
    .select("id", { count: "exact", head: true })
    .eq("action", "drafted_message")
    .gte("created_at", new Date(Date.now() - 86400_000).toISOString())
    .in(
      "deal_id",
      ((await admin.from("deals").select("id").eq("user_id", user.id)).data ?? []).map((d) => d.id),
    );
  if ((count ?? 0) >= 30)
    throw new HttpError(429, "Daily drafting limit reached. Try again tomorrow.");

  let history: { direction: string; body_original: string }[] = [];
  let existingContactId: string | null = null;
  if (threadId) {
    const { data: t } = await admin
      .from("threads")
      .select("id, deal_id, contact_id")
      .eq("id", threadId)
      .maybeSingle();
    if (!t || t.deal_id !== dealId) throw new HttpError(404, "Conversation not found");
    existingContactId = t.contact_id;
    const { data: msgs } = await admin
      .from("messages")
      .select("direction, body_original")
      .eq("thread_id", threadId)
      .neq("direction", "note")
      .order("created_at");
    history = msgs ?? [];
  }

  const [{ data: profile }, bundle] = await Promise.all([
    admin.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    loadListing(admin, deal.listing_id),
  ]);
  const fullName = profile?.full_name?.trim();
  if (!fullName)
    throw new HttpError(
      400,
      "Add your full name in your profile first. Messages are sent on your behalf.",
    );

  // Contact: reuse by email, otherwise create one when details were given.
  let contactId = existingContactId;
  let contact: { name?: string | null; organisation?: string | null } | null = null;
  if (contactIn && typeof contactIn["name"] === "string" && contactIn["name"].trim()) {
    const email =
      typeof contactIn["email"] === "string" ? contactIn["email"].trim().toLowerCase() : null;
    const pec = typeof contactIn["pec"] === "string" ? contactIn["pec"].trim().toLowerCase() : null;
    const organisation =
      typeof contactIn["organisation"] === "string" ? contactIn["organisation"].trim() : null;
    const name = (contactIn["name"] as string).trim().slice(0, 200);
    if (email) {
      const { data: found } = await admin
        .from("contacts")
        .select("id")
        .eq("email", email)
        .maybeSingle();
      if (found) contactId = found.id;
    }
    if (!contactId) {
      const { data: c, error } = await admin
        .from("contacts")
        .insert({
          kind: contactKind,
          name,
          organisation,
          email,
          pec,
          comune: bundle.listing.comune,
          region: bundle.listing.region,
        })
        .select("id")
        .single();
      if (error) throw error;
      contactId = c.id;
    }
    contact = { name, organisation };
  } else if (contactId) {
    const { data: c } = await admin
      .from("contacts")
      .select("name, organisation")
      .eq("id", contactId)
      .maybeSingle();
    contact = c ?? null;
  }

  const context = buildDraftContext({
    listing: bundle.listing,
    facts: bundle.facts as FactRow[],
    fullName,
    contactKind,
    purpose,
    contact,
    history,
  });
  const raw = await callClaude(DRAFT_SYSTEM, [{ role: "user", content: context }], 1500);
  const draft = parseDraft(raw);
  const bodyIt = ensureDisclosure(draft.body_it, fullName);

  if (!threadId) {
    const { data: t, error } = await admin
      .from("threads")
      .insert({
        deal_id: dealId,
        contact_id: contactId,
        channel: "email",
        subject: draft.subject,
        purpose_en: purpose,
        status: "needs_you",
      })
      .select("id")
      .single();
    if (error) throw error;
    threadId = t.id;
  } else {
    await admin
      .from("threads")
      .update({ status: "needs_you", ...(contactId ? { contact_id: contactId } : {}) })
      .eq("id", threadId);
  }

  // Replace any placeholder draft left in this thread.
  await admin
    .from("messages")
    .delete()
    .eq("thread_id", threadId)
    .eq("status", "draft")
    .eq("direction", "outbound");

  const { data: msg, error: mErr } = await admin
    .from("messages")
    .insert({
      thread_id: threadId,
      direction: "outbound",
      status: "awaiting_approval",
      is_binding: draft.is_binding,
      language: "it",
      subject: draft.subject,
      body_original: bodyIt,
      body_en: draft.body_en,
      attachments: [],
      ai_generated: true,
    })
    .select("id")
    .single();
  if (mErr) throw mErr;

  await admin.from("deal_events").insert({
    deal_id: dealId,
    actor: "agent",
    action: "drafted_message",
    detail: { thread_id: threadId, message_id: msg.id, purpose, binding: draft.is_binding },
  });

  return json({ thread_id: threadId, message_id: msg.id, is_binding: draft.is_binding });
});
