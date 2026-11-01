/** Voice with the browser's own speech engines: free, on-device or provider-side depending on the browser.
 * Works in Safari and Chrome. Firefox has no speech recognition, so the mic button hides there. */

export const VOICE_LANGS = [
  { code: "en-GB", label: "English" },
  { code: "ru-RU", label: "Русский" },
  { code: "it-IT", label: "Italiano" },
] as const;

type Rec = {
  lang: string; interimResults: boolean; continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null;
  start(): void; stop(): void;
};

function Recognition(): (new () => Rec) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const canListen = () => !!Recognition();
export const canSpeak = () => typeof window !== "undefined" && "speechSynthesis" in window;

/** Listens until the speaker pauses. onText gets the running transcript; onDone the final one. */
export function listen(lang: string, onText: (t: string) => void, onDone: (t: string) => void, onError: (e: string) => void) {
  const R = Recognition();
  if (!R) { onError("Voice input is not supported in this browser. Try Safari or Chrome."); return () => {}; }
  const rec = new R();
  rec.lang = lang;
  rec.interimResults = true;
  rec.continuous = false;
  let text = "";
  rec.onresult = (e) => {
    text = Array.from(e.results).map((r) => r[0]?.transcript ?? "").join(" ").trim();
    onText(text);
  };
  rec.onerror = (e) => onError(e.error === "not-allowed" ? "Allow microphone access to talk to the agent." : `Voice input stopped (${e.error}).`);
  rec.onend = () => onDone(text);
  rec.start();
  return () => rec.stop();
}

/** The browser's own voice: the fallback when Argos's real voice is unavailable or used up. */
function speakBrowser(text: string, lang: string): Promise<void> {
  return new Promise((done) => {
    if (!canSpeak()) { done(); return; }
    const synth = window.speechSynthesis;
    synth.cancel();
    const clean = text.replace(/\[[^\]]+\]/g, "").replace(/[*_#>`]/g, "").replace(/€\s?([\d.,]+)/g, "$1 euros");
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = lang;
    const voices = synth.getVoices().filter((v) => v.lang.toLowerCase().startsWith(lang.slice(0, 2).toLowerCase()));
    const best = voices.find((v) => /premium|enhanced|natural|neural|google/i.test(v.name)) ?? voices[0];
    if (best) u.voice = best;
    u.rate = 1.02;
    u.onend = () => done();
    u.onerror = () => done();
    synth.speak(u);
  });
}

let audio: HTMLAudioElement | null = null;
let generation = 0;

export type VoiceResult = "voice" | "browser" | "limit" | "limit-anon" | "stopped";

/** Says a reply in Argos's own voice (ElevenLabs). Resolves when he has finished speaking.
 * Falls back to the browser voice when the voice service is off, busy or the daily allowance is used. */
export async function speak(text: string, lang: string): Promise<VoiceResult> {
  stopSpeaking();
  const mine = ++generation;
  const short = lang.slice(0, 2).toLowerCase();
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data, error } = await supabase.functions.invoke("argos-voice", { body: { text, lang: short } });
    if (mine !== generation) return "stopped";
    if (error) {
      let code = "";
      const ctx = (error as { context?: unknown }).context;
      if (ctx instanceof Response) { try { code = ((await ctx.clone().json()) as { error?: string }).error ?? ""; } catch { /* not JSON */ } }
      if (code === "voice-limit-anon") return "limit-anon";
      await speakBrowser(text, lang);
      return code === "voice-limit" ? "limit" : "browser";
    }
    const blob = data instanceof Blob ? data : new Blob([data as ArrayBuffer], { type: "audio/mpeg" });
    const url = URL.createObjectURL(new Blob([blob], { type: "audio/mpeg" }));
    await new Promise<void>((done) => {
      audio = new Audio(url);
      audio.onended = () => done();
      audio.onerror = () => done();
      audio.onpause = () => done();
      audio.play().catch(() => done());
    });
    URL.revokeObjectURL(url);
    return mine === generation ? "voice" : "stopped";
  } catch {
    if (mine !== generation) return "stopped";
    await speakBrowser(text, lang);
    return "browser";
  }
}

export const stopSpeaking = () => {
  generation++;
  if (audio) { audio.pause(); audio = null; }
  if (canSpeak()) window.speechSynthesis.cancel();
};

/** Argos can always speak: his own voice, or the browser's. */
export const canVoice = () => typeof window !== "undefined" && ("Audio" in window || canSpeak());
