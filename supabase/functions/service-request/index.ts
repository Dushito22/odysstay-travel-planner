// A buyer orders a Deal Check or the purchase service. Saves the request with a payment reference,
// emails the owner, and for a Deal Check returns how to pay: bank transfer or stablecoins, with
// details kept in server secrets so they never sit in the public site code.
// action "claim": the buyer says they've paid (optionally with a transaction id); the owner is emailed.
import { adminClient, HttpError, json, requireUser, serve } from "../_shared/runtime.ts";

const KINDS = ["deal_check", "remote_purchase", "search_purchase"] as const;
const NAMES: Record<string, string> = { deal_check: "Deal Check (€290)", remote_purchase: "Remote purchase", search_purchase: "Search + purchase" };
const OWNER = Deno.env.get("OWNER_EMAIL") || "gyurovik@gmail.com";
const SITE = (Deno.env.get("SITE_URL") || "https://odysstay.xyz").replace(/\/$/, "");
const DEAL_CHECK_EUR = 290;
const env = (k: string) => (Deno.env.get(k) ?? "").trim();

async function tellOwner(subject: string, text: string) {
  const key = env("RESEND_API_KEY");
  if (!key) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ from: env("DROP_FROM") || "Argos at Odysstay <argos@odysstay.xyz>", to: [OWNER], subject, text }),
  }).catch((e) => console.error("owner email", e));
}

/** Euros to US dollars at today's ECB rate, for the stablecoin amount. */
async function usdPerEur() {
  try {
    const r = await fetch("https://api.frankfurter.app/latest?from=EUR&to=USD");
    const j = await r.json();
    const v = Number(j?.rates?.USD);
    return v > 0.5 && v < 2 ? v : 1.1;
  } catch { return 1.1; }
}

async function payment() {
  const bank = {
    name: env("PAY_NAME"),
    eur: env("PAY_EUR_IBAN") ? { iban: env("PAY_EUR_IBAN"), bic: env("PAY_EUR_BIC") } : null,
    gbp: env("PAY_GBP_ACCOUNT") || null,
    usd: env("PAY_USD_ACCOUNT") || null,
  };
  const crypto = { usdt_tron: env("PAY_USDT_TRON") || null, usdc_base: env("PAY_USDC_BASE") || null };
  if (!bank.eur && !bank.gbp && !bank.usd && !crypto.usdt_tron && !crypto.usdc_base) return null;
  const rate = await usdPerEur();
  return { amount_eur: DEAL_CHECK_EUR, amount_usd: Math.ceil(DEAL_CHECK_EUR * rate), bank, crypto };
}

const newRef = () => `ODY-${crypto.getRandomValues(new Uint8Array(3)).reduce((s, b) => s + b.toString(16).padStart(2, "0"), "").toUpperCase().slice(0, 5)}`;

serve(async (req, body) => {
  const admin = adminClient();
  const user = await requireUser(req, admin);

  if (body["action"] === "claim") {
    const id = String(body["id"] ?? "");
    const note = typeof body["note"] === "string" ? body["note"].trim().slice(0, 300) : "";
    const { data: r } = await admin.from("purchase_requests").select("id, kind, payment_ref, user_id").eq("id", id).maybeSingle();
    if (!r || r.user_id !== user.id) throw new HttpError(404, "Order not found.");
    await admin.from("purchase_requests").update({ paid_claimed_at: new Date().toISOString(), paid_note: note || null }).eq("id", id);
    await tellOwner(`Paid? ${r.payment_ref} from ${user.email}`, `${user.email} says they paid ${NAMES[r.kind]}.\nReference: ${r.payment_ref}${note ? `\nTransaction / note: ${note}` : ""}\n\nCheck your account, then mark it paid: ${SITE}/admin`);
    return json({ ok: true });
  }

  const kind = String(body["kind"] ?? "");
  if (!(KINDS as readonly string[]).includes(kind)) throw new HttpError(400, "Unknown service.");
  const listingId = typeof body["listing_id"] === "string" ? body["listing_id"] : null;
  const note = typeof body["note"] === "string" ? body["note"].slice(0, 1000) : null;

  const { data: existing } = await admin.from("purchase_requests").select("id, status, payment_ref").eq("user_id", user.id).eq("kind", kind)
    .filter("listing_id", listingId ? "eq" : "is", listingId ?? null).maybeSingle();
  let id = existing?.id as string | undefined;
  let ref = existing?.payment_ref as string | null | undefined;
  if (existing && !ref) {
    ref = newRef();
    await admin.from("purchase_requests").update({ payment_ref: ref }).eq("id", existing.id);
  }
  if (!id) {
    ref = newRef();
    const { data, error } = await admin.from("purchase_requests").insert({ user_id: user.id, kind, listing_id: listingId, note, payment_ref: ref }).select("id").single();
    if (error) throw new HttpError(500, error.message);
    id = data.id as string;
    const { data: l } = listingId ? await admin.from("listings").select("comune, region, price_eur").eq("id", listingId).maybeSingle() : { data: null };
    const house = l ? `${l.comune}, ${l.region}, €${Number(l.price_eur ?? 0).toLocaleString("en-GB")}` : "no house picked";
    await tellOwner(`New request: ${NAMES[kind]} from ${user.email}`,
      `${NAMES[kind]}\nReference: ${ref}\nBuyer: ${user.email}\nHouse: ${house}${listingId ? `\n${SITE}/listing/${listingId}` : ""}${note ? `\nNote: ${note}` : ""}\n\nAll requests: ${SITE}/admin`);
  }
  const pay = kind === "deal_check" && existing?.status !== "paid" ? await payment() : null;
  return json({ id, ref, already: !!existing, paid: existing?.status === "paid", pay });
});
