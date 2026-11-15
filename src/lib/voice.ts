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
    synthText = clean.length; synthAt = 0;
    u.onstart = () => onStartCb?.();
    u.onboundary = (e) => { synthAt = e.charIndex; };
    u.onend = () => done();
    u.onerror = () => done();
    synth.speak(u);
  });
}

let audio: HTMLAudioElement | null = null;
let generation = 0;
/** Paused by the person talking over Argos (not stopped): playback waits to be resumed or dropped. */
let held = false;
let onStartCb: (() => void) | null = null;
let synthText = 0, synthAt = 0;
/** One audio element for the whole call. iPhones only let a page play sound from an element the person
 *  started with a tap, so the call button plays a moment of silence through it and every reply reuses it. */
let player: HTMLAudioElement | null = null;
let silence: string | null = null;
function silentWav() {
  if (silence) return silence;
  const n = 1600, b = new ArrayBuffer(44 + n * 2), v = new DataView(b);
  const w = (o: number, t: string) => { for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); };
  w(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); w(8, "WAVE"); w(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
  v.setUint16(22, 1, true); v.setUint32(24, 16000, true); v.setUint32(28, 32000, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, "data"); v.setUint32(40, n * 2, true);
  silence = URL.createObjectURL(new Blob([b], { type: "audio/wav" }));
  return silence;
}
/** Call this inside the tap that starts a call or turns the voice on. */
export function unlockAudio() {
  try {
    if (!player) player = new Audio();
    player.src = silentWav();
    void player.play().catch(() => {});
    if (canSpeak()) { const u = new SpeechSynthesisUtterance(" "); u.volume = 0; window.speechSynthesis.speak(u); }
  } catch { /* nothing to unlock */ }
}

export type VoiceResult = "voice" | "browser" | "limit" | "limit-anon" | "stopped";

/** Says a reply in Argos's own voice (ElevenLabs). Resolves when he has finished speaking.
 * Falls back to the browser voice when the voice service is off, busy or the daily allowance is used. */
export async function speak(text: string, lang: string, onStart?: () => void): Promise<VoiceResult> {
  stopSpeaking();
  onStartCb = onStart ?? null;
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
    // Ends only when the clip ends or we stop it: phones fire "pause" on small audio interruptions.
    const played = await new Promise<boolean>((done) => {
      const a = player ?? new Audio();
      audio = a;
      a.onended = () => done(true);
      a.onerror = () => done(false);
      a.onpause = () => { if (mine !== generation) done(true); else if (!held && !a.ended) void a.play().catch(() => done(true)); };
      a.onplaying = () => { const cb = onStartCb; onStartCb = null; cb?.(); };
      a.src = url;
      a.play().catch(() => done(false));
    });
    URL.revokeObjectURL(url);
    if (mine !== generation) return "stopped";
    // Blocked or broken audio: say it with the browser's voice rather than stay silent.
    if (!played) { await speakBrowser(text, lang); return "browser"; }
    return "voice";
  } catch {
    if (mine !== generation) return "stopped";
    await speakBrowser(text, lang);
    return "browser";
  }
}

export const stopSpeaking = () => {
  generation++;
  held = false;
  onStartCb = null;
  if (audio) { audio.onpause = null; audio.pause(); audio = null; }
  if (canSpeak()) window.speechSynthesis.cancel();
};

/** Argos can always speak: his own voice, or the browser's. */
export const canVoice = () => typeof window !== "undefined" && ("Audio" in window || canSpeak());


/** Someone started talking over Argos: pause him and say how far into the reply he got (0..1). */
export function holdSpeaking(): number | null {
  if (audio && !audio.paused) {
    held = true;
    const d = audio.duration;
    const r = d && Number.isFinite(d) ? audio.currentTime / d : 0.5;
    audio.pause();
    return r;
  }
  if (canSpeak() && window.speechSynthesis.speaking) {
    held = true;
    window.speechSynthesis.pause();
    return synthText ? synthAt / synthText : 0.5;
  }
  return null;
}

/** It was only an "ага": carry on from where he stopped. */
export function resumeSpeaking() {
  held = false;
  if (audio) void audio.play().catch(() => {});
  else if (canSpeak()) window.speechSynthesis.resume();
}

// ---- Hearing the person while Argos talks (barge-in) ----
// One microphone stream for the whole call, with the phone's echo cancellation, so Argos's own voice
// from the speaker is mostly removed and what is left is the person.
let mic: MediaStream | null = null;
let actx: AudioContext | null = null;

export async function openMic() {
  if (mic || typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return;
  try {
    mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    actx = new AC();
  } catch { mic = null; actx = null; }
}

export function closeMic() {
  mic?.getTracks().forEach((t) => t.stop());
  mic = null;
  void actx?.close().catch(() => {});
  actx = null;
}

/** Calls onSpeech once the person has clearly been talking for about a third of a second. The first moment
 *  of each watch measures how loud Argos's own leftover echo is, so his voice alone never triggers it. */
export function watchVoice(onSpeech: () => void): () => void {
  if (!mic || !actx) return () => {};
  void actx.resume().catch(() => {});
  const src = actx.createMediaStreamSource(mic);
  const an = actx.createAnalyser();
  an.fftSize = 1024;
  src.connect(an);
  const buf = new Float32Array(an.fftSize);
  const t0 = performance.now();
  let floor = 0, loud = 0, last = t0, stopped = false;
  const id = window.setInterval(() => {
    if (stopped) return;
    an.getFloatTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i]! * buf[i]!;
    const rms = Math.sqrt(sum / buf.length);
    const now = performance.now(), dt = now - last;
    last = now;
    if (now - t0 < 700) { floor = Math.max(floor, rms); return; }
    const th = Math.max(0.03, floor * 2.2);
    loud = rms > th ? loud + dt : Math.max(0, loud - dt * 0.6);
    if (loud > 330) { stopped = true; window.clearInterval(id); onSpeech(); }
  }, 40);
  return () => { stopped = true; window.clearInterval(id); try { src.disconnect(); } catch { /* gone */ } };
}

/** Listens once and resolves with what was said ("" for nothing). */
export function listenOnce(lang: string, onText: (t: string) => void): Promise<string> {
  return new Promise((done) => {
    let finished = false;
    listen(lang, onText, (t) => { if (!finished) { finished = true; done(t); } }, () => { if (!finished) { finished = true; done(""); } });
  });
}
