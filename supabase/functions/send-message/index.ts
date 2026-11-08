// The buyer approves a message and Argos actually sends it: by email from argos@odysstay.xyz, signed with
// the buyer's name, with replies routed back into the deal. Binding messages need "CONFIRM" typed.
import { adminClient, HttpError, json, requireUser, serve, uuid } from "../_shared/runtime.ts";

const SITE = (Deno.env.get("SITE_URL") || "https://odysstay.xyz").replace(/\/$/, "");
const INBOUND = (Deno.env.get("INBOUND_DOMAIN") ?? "").trim();
const FROM = (Deno.env.get("SEND_FROM_ADDRESS") || "argos@odysstay.xyz").trim();

serve(async (req, body) => {
  const admin = adminClient();
  const user = await requireUser(req, admin);
  const messageId = uuid(body["message_id"], "message_id")!;
  const typed = typeof body["confirm"] === "string" ? body["confirm"] : "";
  const email = typeof body["email"] === "string" ? body["email"].trim().toLowerCase() : "";

  const { data: msg } = await admin.from("messages").select("id, thread_id, status, is_binding, subject, body_original, direction").eq("id", messageId).maybeSingle();
  if (!msg || msg.direction !== "outbound") throw new HttpError(404, "Message not found");
  const { data: thread } = await admin.from("threads").select("id, deal_id, contact_id, subject").eq("id", msg.thread_id).maybeSingle();
  const { data: deal } = thread ? await admin.from("deals").select("id, user_id").eq("id", thread.deal_id).maybeSingle() : { data: null };
  if (!thread || !deal || deal.user_id !== user.id) throw new HttpError(404, "Message not found");
  if (msg.status === "sent") return json({ sent: true, already: true });
  if (!["awaiting_approval", "approved"].includes(msg.status)) throw new HttpError(400, "This message can't be sent.");
  if (msg.is_binding && typed.trim().toUpperCase() !== "CONFIRM") throw new HttpError(400, "Type CONFIRM to send a binding message.");

  // The recipient: the thread's contact, or an address the buyer just gave us.
  let to: string | null = null;
  if (thread.contact_id) {
    const { data: c } = await admin.from("contacts").select("id, email, pec").eq("id", thread.contact_id).maybeSingle();
    if (email && c && !c.email) await admin.from("contacts").update({ email }).eq("id", c.id);
    to = email || c?.email || c?.pec || null;
  } else if (email) {
    const { data: c } = await admin.from("contacts").insert({ kind: "other", name: email.split("@")[0]!, email }).select("id").single();
    if (c) await admin.from("threads").update({ contact_id: c.id }).eq("id", thread.id);
    to = email;
  }
  if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return json({ sent: false, needs_email: true });

  const { data: profile } = await admin.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const name = profile?.full_name?.trim() || (typeof meta["full_name"] === "string" ? meta["full_name"] : "") || "Odysstay";
  const replyTo = INBOUND ? `r-${thread.id}@${INBOUND}` : user.email!;
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) throw new HttpError(503, "Sending is not switched on yet.");
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ from: `${(Deno.env.get("AGENT_NAME_IT") || "Argo").trim()} per ${name.replace(/[<>"]/g, "")} <${FROM}>`, to: [to], reply_to: replyTo, subject: msg.subject || thread.subject || "Richiesta informazioni", text: msg.body_original }),
  });
  const res = await r.json().catch(() => ({}));
  if (!r.ok) throw new HttpError(502, `The email didn't go out: ${res?.message ?? r.status}`);

  const now = new Date().toISOString();
  await admin.from("messages").update({ status: "sent", approved_at: now, approved_by: user.id, sent_at: now, provider_id: res.id ?? null, sent_to: to }).eq("id", msg.id);
  await admin.from("threads").update({ status: "waiting_reply" }).eq("id", thread.id);
  await admin.from("deal_events").insert({ deal_id: deal.id, actor: "agent", action: "message_sent", detail: { message_id: msg.id, to } });
  return json({ sent: true, to, replies_to_deal: !!INBOUND, deal_url: `${SITE}/deals/${deal.id}` });
});
