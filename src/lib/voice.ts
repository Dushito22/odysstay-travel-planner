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

/** Reads text aloud in the chosen language, picking the best installed voice for it. */
export function speak(text: string, lang: string) {
  if (!canSpeak()) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const clean = text.replace(/\[[^\]]+\]/g, "").replace(/[*_#>`]/g, "").replace(/€\s?([\d.,]+)/g, "$1 euros");
  const u = new SpeechSynthesisUtterance(clean);
  u.lang = lang;
  const voices = synth.getVoices().filter((v) => v.lang.toLowerCase().startsWith(lang.slice(0, 2).toLowerCase()));
  const best = voices.find((v) => /premium|enhanced|natural|neural|google/i.test(v.name)) ?? voices[0];
  if (best) u.voice = best;
  u.rate = 1.02;
  synth.speak(u);
}

export const stopSpeaking = () => { if (canSpeak()) window.speechSynthesis.cancel(); };
