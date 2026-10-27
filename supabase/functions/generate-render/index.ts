// Generates an illustration of how a listing could look. Always labelled as an illustration in the app.
import { RENDER_STYLES, renderPrompt } from "../_shared/agent-core.ts";
import { adminClient, HttpError, json, requireUser, serve, str, uuid } from "../_shared/runtime.ts";

const FREE_DAILY = 3;
/** Official photo hosts of our sources. Only URLs stored on the listing and on these hosts are fetched. */
const PHOTO_HOSTS = [
  "https://resource-pvp.giustizia.it/",
  "https://www.astegiudiziarie.it/",
  "https://www.astetraprivati.it/",
  "https://www.avvisinotarili.notariato.it/",
];

/** Turns an OpenAI failure into a message the user can act on. */
async function openAiReason(res: Response, kind: string) {
  const text = await res.text();
  console.error("openai", kind, res.status, text);
  let msg = "";
  try { msg = JSON.parse(text)?.error?.message ?? ""; } catch { /* not JSON */ }
  if (res.status === 401) return "The image service key is not valid (OPENAI_API_KEY in Supabase).";
  if (/billing|quota|credit|insufficient/i.test(msg) || res.status === 429) return "The image service has no credit left. Add credit at platform.openai.com.";
  if (/verif/i.test(msg)) return "OpenAI requires organisation verification before it allows image generation (platform.openai.com > Settings > Organization).";
  if (/safety|moderation|rejected/i.test(msg)) return "The image service refused this request. Try a different description.";
  return `The image service failed (${res.status}${msg ? `: ${msg.slice(0, 160)}` : ""}).`;
}

serve(async (req, body) => {
  const admin = adminClient();
  const user = await requireUser(req, admin);
  const listingId = uuid(body["listing_id"], "listing_id")!;
  const style = str(body["style"], "style", { max: 60 });
  if (!(RENDER_STYLES as readonly string[]).includes(style))
    throw new HttpError(400, "Unknown style");
  const wish = typeof body["wish"] === "string" ? body["wish"].slice(0, 500) : null;
  if (style === "Custom" && !wish?.trim()) throw new HttpError(400, "Describe what you would like to see");

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new HttpError(500, "Server is missing OPENAI_API_KEY");
  const model = Deno.env.get("OPENAI_IMAGE_MODEL") || "gpt-image-1";

  const { data: profile } = await admin
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .maybeSingle();
  if ((profile?.plan ?? "free") === "free") {
    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);
    const { count } = await admin
      .from("listing_images")
      .select("id", { count: "exact", head: true })
      .eq("created_by", user.id)
      .eq("kind", "render")
      .gte("created_at", dayStart.toISOString());
    if ((count ?? 0) >= FREE_DAILY) {
      throw new HttpError(
        429,
        `The free plan includes ${FREE_DAILY} illustrations a day. Upgrade to Pro for unlimited.`,
      );
    }
  }

  const { data: listing } = await admin
    .from("listings")
    .select("id, property_type, surface_sqm, land_sqm, comune, region, photo_urls")
    .eq("id", listingId)
    .maybeSingle();
  if (!listing) throw new HttpError(404, "Listing not found");

  const { data: original } = await admin
    .from("listing_images")
    .select("storage_path")
    .eq("listing_id", listingId)
    .eq("kind", "original")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  // Official photos are hotlinked from the court portal. Only URLs stored on this listing are used,
  // never a URL from the request, and only from the portal's file host.
  const photos = (Array.isArray(listing.photo_urls) ? listing.photo_urls : [])
    .filter((u): u is string => typeof u === "string" && PHOTO_HOSTS.some((h) => u.startsWith(h)));
  const wanted = typeof body["photo"] === "string" ? body["photo"] : null;
  const officialUrl = wanted && photos.includes(wanted) ? wanted : photos[0] ?? null;

  let file: Blob | null = null;
  if (original) {
    const { data, error } = await admin.storage.from("listing-images").download(original.storage_path);
    if (error || !data) throw new HttpError(500, "Could not read the original photo");
    file = data;
  } else if (officialUrl) {
    const r = await fetch(officialUrl);
    const buf = r.ok ? await r.arrayBuffer() : null;
    if (buf && buf.byteLength > 1000 && buf.byteLength < 20_000_000) {
      const type = /\.png(\?|$)/i.test(officialUrl) ? "image/png" : "image/jpeg";
      file = new Blob([buf], { type });
    }
  }

  let b64: string | undefined;
  let prompt: string;
  if (file) {
    prompt = renderPrompt(listing, style, true, wish);
    const form = new FormData();
    form.append("model", model);
    form.append("prompt", prompt);
    form.append("size", "1536x1024");
    form.append("input_fidelity", "high");
    const ext = file.type === "image/jpeg" ? "jpg" : "png";
    form.append("image", new File([file], `original.${ext}`, { type: file.type || "image/png" }));
    const res = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    if (!res.ok) {
      throw new HttpError(502, await openAiReason(res, "edit"));
    }
    b64 = (await res.json()).data?.[0]?.b64_json;
  } else {
    prompt = renderPrompt(listing, style, false, wish);
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt, size: "1536x1024", n: 1 }),
    });
    if (!res.ok) {
      throw new HttpError(502, await openAiReason(res, "gen"));
    }
    b64 = (await res.json()).data?.[0]?.b64_json;
  }
  if (!b64) throw new HttpError(502, "No image came back. Please try again.");

  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const path = `renders/${user.id}/${listingId}/${Date.now()}.png`;
  const { error: upErr } = await admin.storage
    .from("listing-images")
    .upload(path, bytes, { contentType: "image/png" });
  if (upErr) throw upErr;

  const { data: img, error } = await admin
    .from("listing_images")
    .insert({
      listing_id: listingId,
      kind: "render",
      storage_path: path,
      caption_en: style,
      prompt,
      created_by: user.id,
    })
    .select("*")
    .single();
  if (error) throw error;

  return json({ image: img });
});
