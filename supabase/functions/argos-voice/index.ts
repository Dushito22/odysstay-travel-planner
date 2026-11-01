// Argos's voice: turns a reply into speech with ElevenLabs. Returns MP3 bytes.
// Credit is finite, so every caller has a daily allowance of spoken characters (about 15 characters per second
// of speech), and the whole site has a daily ceiling. Past either, the app falls back to the browser's voice.
import { adminClient, corsHeaders, HttpError, serve } from "../_shared/runtime.ts";

const num = (name: string, d: number) => Number(Deno.env.get(name) ?? "") || d;
/** Signed out: about 30 seconds of Argos speaking a day. */
const ANON_DAY = num("VOICE_ANON_DAY", 450);
const FREE_DAY = num("VOICE_FREE_DAY", 1500);
const PRO_DAY = num("VOICE_PRO_DAY", 12000);
/** Everyone together, per day. ElevenLabs Flash costs 0.5 credit a character, so 2,000 a day fits 30,000 credits a month. */
const ALL_DAY = num("VOICE_ALL_DAY", 2000);
/** George: warm, calm, middle-aged, multilingual. Override with ELEVENLABS_VOICE_ID. */
const VOICE = Deno.env.get("ELEVENLABS_VOICE_ID") || "JBFqnCBsd6RMkjVDRZzb";
const MODEL = Deno.env.get("ELEVENLABS_MODEL") || "eleven_flash_v2_5";

async function sha(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(b)).slice(0, 12).map((x) => x.toString(16).padStart(2, "0")).join("");
}

/** What a listener should hear: no citation markers, no markdown, euros said as words. */
function spoken(t: string) {
  return t
    .replace(/\[[^\]]{1,40}\]/g, "")
    .replace(/[*_#>`]/g, "")
    .replace(/€\s?([\d.,]+)\s?k\b/gi, "$1 thousand euros")
    .replace(/€\s?([\d.,]+)/g, "$1 euros")
    .replace(/\s+/g, " ")
    .trim();
}

serve(async (req, body) => {
  const key = Deno.env.get("ELEVENLABS_API_KEY");
  if (!key) throw new HttpError(503, "voice-off");
  const text = spoken(typeof body["text"] === "string" ? body["text"] : "").slice(0, 900);
  if (!text) throw new HttpError(400, "Nothing to say");
  const lang = body["lang"] === "ru" ? "ru" : body["lang"] === "it" ? "it" : "en";

  const admin = adminClient();
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  let who = "", limit = ANON_DAY, signedIn = false;
  if (token) {
    const { data } = await admin.auth.getUser(token);
    if (data.user) {
      signedIn = true;
      who = `u:${data.user.id}`;
      const { data: p } = await admin.from("profiles").select("plan").eq("id", data.user.id).maybeSingle();
      limit = (p?.plan ?? "free") === "free" ? FREE_DAY : PRO_DAY;
    }
  }
  if (!who) {
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0]!.trim() || "unknown";
    who = `v:${await sha(ip + (Deno.env.get("SUPABASE_URL") ?? ""))}`;
  }
  const day = new Date().toISOString().slice(0, 10);
  const { data: mine } = await admin.from("voice_usage").select("chars").eq("day", day).eq("who", who).maybeSingle();
  const used = mine?.chars ?? 0;
  if (used + text.length > limit) throw new HttpError(429, signedIn ? "voice-limit" : "voice-limit-anon");
  const { data: all } = await admin.from("voice_usage").select("chars").eq("day", day);
  if ((all ?? []).reduce((a, r) => a + (r.chars ?? 0), 0) + text.length > ALL_DAY) throw new HttpError(429, "voice-busy");

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_64`, {
    method: "POST",
    headers: { "xi-api-key": key, "content-type": "application/json", accept: "audio/mpeg" },
    body: JSON.stringify({
      text,
      model_id: MODEL,
      language_code: lang,
      voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.15, use_speaker_boost: true, speed: 1.0 },
    }),
  });
  if (!res.ok) {
    console.error("elevenlabs", res.status, await res.text());
    throw new HttpError(502, "voice-failed");
  }
  await admin.from("voice_usage").upsert({ day, who, chars: used + text.length });
  return new Response(await res.arrayBuffer(), {
    headers: { ...corsHeaders, "Content-Type": "application/octet-stream", "Cache-Control": "no-store" },
  });
});
