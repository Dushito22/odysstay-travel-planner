// Generates an illustration of how a listing could look. Always labelled as an illustration in the app.
import { RENDER_STYLES, renderPrompt } from "../_shared/agent-core.ts";
import { adminClient, HttpError, json, requireUser, serve, str, uuid } from "../_shared/runtime.ts";

const FREE_DAILY = 3;

serve(async (req, body) => {
  const admin = adminClient();
  const user = await requireUser(req, admin);
  const listingId = uuid(body["listing_id"], "listing_id")!;
  const style = str(body["style"], "style", { max: 60 });
  if (!(RENDER_STYLES as readonly string[]).includes(style))
    throw new HttpError(400, "Unknown style");

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
    .select("id, property_type, surface_sqm, land_sqm, comune, region")
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

  let b64: string | undefined;
  let prompt: string;
  if (original) {
    prompt = renderPrompt(listing, style, true);
    const { data: file, error } = await admin.storage
      .from("listing-images")
      .download(original.storage_path);
    if (error || !file) throw new HttpError(500, "Could not read the original photo");
    const form = new FormData();
    form.append("model", model);
    form.append("prompt", prompt);
    form.append("size", "1536x1024");
    form.append("image", new File([file], "original.png", { type: file.type || "image/png" }));
    const res = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    if (!res.ok) {
      console.error("openai edit", res.status, await res.text());
      throw new HttpError(502, "The illustration service is unavailable. Please try again.");
    }
    b64 = (await res.json()).data?.[0]?.b64_json;
  } else {
    prompt = renderPrompt(listing, style, false);
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt, size: "1536x1024", n: 1 }),
    });
    if (!res.ok) {
      console.error("openai gen", res.status, await res.text());
      throw new HttpError(502, "The illustration service is unavailable. Please try again.");
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
