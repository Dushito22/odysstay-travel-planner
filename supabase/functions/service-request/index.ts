// A buyer orders a Deal Check or the purchase service. Saves the request and emails the owner
// straight away, so nobody waits on us noticing it in the admin page.
import { adminClient, json, requireUser, serve, HttpError } from "../_shared/runtime.ts";

const KINDS = ["deal_check", "remote_purchase", "search_purchase"] as const;
const NAMES: Record<string, string> = { deal_check: "Deal Check (€290)", remote_purchase: "Remote purchase", search_purchase: "Search + purchase" };
const OWNER = Deno.env.get("OWNER_EMAIL") || "gyurovik@gmail.com";
const SITE = (Deno.env.get("SITE_URL") || "https://odysstay.xyz").replace(/\/$/, "");

serve(async (req, body) => {
  const admin = adminClient();
  const user = await requireUser(req, admin);
  const kind = String(body["kind"] ?? "");
  if (!(KINDS as readonly string[]).includes(kind)) throw new HttpError(400, "Unknown service.");
  const listingId = typeof body["listing_id"] === "string" ? body["listing_id"] : null;
  const note = typeof body["note"] === "string" ? body["note"].slice(0, 1000) : null;

  const { data: existing } = await admin.from("purchase_requests").select("id, status").eq("user_id", user.id).eq("kind", kind)
    .filter("listing_id", listingId ? "eq" : "is", listingId ?? null).maybeSingle();
  let id = existing?.id as string | undefined;
  if (!id) {
    const { data, error } = await admin.from("purchase_requests").insert({ user_id: user.id, kind, listing_id: listingId, note }).select("id").single();
    if (error) throw new HttpError(500, error.message);
    id = data.id as string;

    const { data: l } = listingId
      ? await admin.from("listings").select("comune, region, price_eur").eq("id", listingId).maybeSingle()
      : { data: null };
    const key = Deno.env.get("RESEND_API_KEY");
    if (key) {
      const house = l ? `${l.comune}, ${l.region}, €${Number(l.price_eur ?? 0).toLocaleString("en-GB")}` : "no house picked";
      await fetch("https://api.resend.com/emails", {
        method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
        body: JSON.stringify({
          from: Deno.env.get("DROP_FROM") || "Argos at Odysstay <argos@odysstay.xyz>", to: [OWNER],
          subject: `New request: ${NAMES[kind]} from ${user.email}`,
          text: `${NAMES[kind]}\nBuyer: ${user.email}\nHouse: ${house}${listingId ? `\n${SITE}/listing/${listingId}` : ""}${note ? `\nNote: ${note}` : ""}\n\nAll requests: ${SITE}/admin`,
        }),
      }).catch((e) => console.error("owner email", e));
    }
  }
  return json({ id, already: !!existing });
});
