import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { telegramStatusQuery, useConnectTelegram } from "@/components/odys/TelegramConnect";
import { useSignedIn } from "@/lib/signed-in";
import { MessageCircle, Phone, PhoneOff, Volume2, VolumeX, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { ArgosComposer } from "@/components/odys/ArgosComposer";
import { satelliteUrl } from "@/components/odys/ListingCard";
import { formatEur } from "@/components/odys/primitives";
import { callFunction } from "@/lib/agent";
import { parseRequest, runSearch } from "@/lib/argos";
import { isCourtPhoto, renderUrl, type FeedRow } from "@/lib/feed";
import { speechLang, useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { canListen, listen, speak, stopSpeaking } from "@/lib/voice";

type Msg = { role: "user" | "argos"; text: string; rows?: FeedRow[] };
type Mode = "chat" | "call";
type CallState = "idle" | "listening" | "thinking" | "speaking" | "ended";

/** Open Argos from anywhere: openArgos({ mode: "call" }) or openArgos({ text: "Is anyone living there?" }). */
export function openArgos(detail: { mode?: Mode; text?: string } = {}) {
  window.dispatchEvent(new CustomEvent("argos:open", { detail }));
}

const T = {
  en: {
    chat: "Chat with Argos", call: "Call Argos", sub: "Your agent in Italy · always on",
    hello: "Ciao, I'm Argos. Ask me anything: a house, a town, how buying works here. Or tell me what you're dreaming of and I'll find it.",
    helloListing: (c: string) => `Ciao. Ask me anything about this house in ${c}, or about buying in Italy in general. I've read what the listing says.`,
    callHello: "Ciao, Argos here. What can I do for you?",
    chips: ["Find me a stone house under €50k", "How do court auctions work?", "What does buying cost on top of the price?"],
    chipsListing: ["What will it really cost me?", "Is anyone living there?", "Can I see it before I buy?"],
    ask: "Ask anything…", thinking: "Argos is thinking…", start: "Start the call", end: "End call",
    idle: "Talk to Argos like you would on the phone. He listens, answers out loud and keeps the notes.",
    listening: "Listening…", speaking: "Argos is speaking", ended: "Call ended",
    noMic: "Calls need the microphone in Chrome or Safari. Chat works everywhere.",
    anonLimit: "That was your free call time for today. Sign in and keep talking, it's free.",
    signIn: "Sign in", limit: "Argos's own voice is used up for today, so you'll hear your browser's voice.",
    didntCatch: "I didn't catch that. Tap the call button when you're ready.", see: "Open",
    error: "I couldn't reach my notes just now. Try again in a moment.",
  },
  ru: {
    chat: "Написать Argos", call: "Позвонить Argos", sub: "Ваш агент в Италии · всегда на связи",
    hello: "Ciao, я Argos. Спрашивайте что угодно: про дом, город, как здесь всё устроено с покупкой. Или расскажите, о чём мечтаете, и я найду.",
    helloListing: (c: string) => `Ciao. Спрашивайте что угодно про этот дом в ${c} или про покупку в Италии вообще. Объявление я уже прочитал.`,
    callHello: "Ciao, это Argos. Чем помочь?",
    chips: ["Найди каменный дом до €50 тыс.", "Как устроены судебные аукционы?", "Сколько стоит покупка сверх цены?"],
    chipsListing: ["Сколько это будет стоить на самом деле?", "Там кто-то живёт?", "Можно посмотреть до покупки?"],
    ask: "Спросите что угодно…", thinking: "Argos думает…", start: "Начать звонок", end: "Завершить",
    idle: "Говорите с Argos как по телефону. Он слушает, отвечает голосом и всё записывает.",
    listening: "Слушаю…", speaking: "Argos говорит", ended: "Звонок завершён",
    noMic: "Для звонка нужен микрофон в Chrome или Safari. Чат работает везде.",
    anonLimit: "Бесплатное время звонка на сегодня закончилось. Войдите и продолжайте, это бесплатно.",
    signIn: "Войти", limit: "Собственный голос Argos на сегодня закончился, дальше звучит голос браузера.",
    didntCatch: "Не расслышал. Нажмите кнопку звонка, когда будете готовы.", see: "Открыть",
    error: "Не получилось связаться, попробуйте ещё раз через минуту.",
  },
};

const HIDE_ON = /^\/(argos|login|onboarding)(\/|$)/;

function thumb(r: FeedRow) {
  if (r.has_real_photo && r.hero_image_path) return renderUrl(r.hero_image_path);
  if (r.lat != null && r.lng != null) return satelliteUrl(r.lat, r.lng, 160, 160);
  return r.hero_image_path && !isCourtPhoto(r.hero_image_path) ? renderUrl(r.hero_image_path) : null;
}

export function ArgosDock() {
  const lang = useLang();
  const t = T[lang];
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const listingId = pathname.match(/^\/listing\/([0-9a-f-]{36})/i)?.[1] ?? null;
  const [comune, setComune] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("chat");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const [aloud, setAloud] = useState(false);
  const [call, setCall] = useState<CallState>("idle");
  const [partial, setPartial] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [anonOut, setAnonOut] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const stopListen = useRef<(() => void) | null>(null);
  const inCall = useRef(false);
  const misses = useRef(0);
  const bottom = useRef<HTMLDivElement>(null);
  const msgsRef = useRef<Msg[]>([]);
  msgsRef.current = msgs;

  // The town of the listing on screen, for the greeting.
  useEffect(() => {
    setComune(null);
    if (!listingId) return;
    void import("@/integrations/supabase/client").then(({ supabase }) =>
      supabase.from("listing_feed").select("comune").eq("id", listingId).maybeSingle().then(({ data }) => setComune(data?.comune ?? null)));
  }, [listingId]);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs.length, busy, partial]);
  useEffect(() => {
    if (call === "idle" || call === "ended") return;
    const id = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [call]);

  const ask = useCallback(async (text: string, how: Mode): Promise<string> => {
    const history = [...msgsRef.current, { role: "user" as const, text }];
    setMsgs(history);
    setBusy(true);
    // A search request runs on our own data first, so Argos talks about real houses.
    const s = parseRequest(text);
    const searching = !listingId && (s.understood.length > 0 || /find|show|search|looking for|найд|покаж|ищу|подбер/i.test(text));
    let found: Awaited<ReturnType<typeof runSearch>> | null = null;
    if (searching) { try { found = await runSearch(s); } catch { found = null; } }
    let reply = t.error;
    try {
      const r = await callFunction<{ reply: string }>("argos", {
        messages: history.slice(-10).map((m) => ({ role: m.role, text: m.text })),
        language: lang === "ru" ? "Russian" : "English",
        mode: how,
        listing_id: listingId,
        understood: searching ? s.understood : [], not_yet: searching ? s.notYet : [], relaxed: found?.relaxed ?? null, total: found?.total ?? 0,
        top: (found?.rows ?? []).slice(0, 6).map((x) => ({
          comune: x.comune, region: x.region, price_eur: x.price_eur, type: x.property_type, surface_sqm: x.surface_sqm,
          condition: x.condition, sale_type: x.sale_type, days_left: x.days_left, has_photos: !!x.has_real_photo,
        })),
      });
      if (r.reply) reply = r.reply;
    } catch (e) {
      if (e instanceof Error && e.message) reply = e.message;
    }
    setMsgs((m) => [...m, { role: "argos", text: reply, ...(found?.rows.length ? { rows: found.rows.slice(0, 3) } : {}) }]);
    setBusy(false);
    return reply;
  }, [lang, listingId, t.error]);

  // Phone call: listen, think, speak, listen again.
  const listenTurn = useCallback(() => {
    if (!inCall.current) return;
    setCall("listening");
    setPartial("");
    stopListen.current = listen(speechLang(lang), setPartial, async (heard) => {
      stopListen.current = null;
      if (!inCall.current) return;
      setPartial("");
      if (!heard.trim()) {
        misses.current += 1;
        if (misses.current >= 4) { inCall.current = false; setCall("ended"); setNote(t.didntCatch); return; }
        listenTurn();
        return;
      }
      misses.current = 0;
      setCall("thinking");
      const reply = await ask(heard, "call");
      if (!inCall.current) return;
      setCall("speaking");
      const how = await speak(reply, speechLang(lang));
      if (how === "limit-anon") { inCall.current = false; setAnonOut(true); setCall("ended"); return; }
      if (how === "limit") setNote(t.limit);
      if (how === "stopped" || !inCall.current) return;
      listenTurn();
    }, (err) => { inCall.current = false; setCall("ended"); setNote(err); });
  }, [ask, lang, t.didntCatch, t.limit]);

  const startCall = useCallback(async () => {
    setNote(null);
    setAnonOut(false);
    setSeconds(0);
    misses.current = 0;
    inCall.current = true;
    // On a call, a short hello: the long one took most of the first fifteen seconds.
    const hello = msgsRef.current.length ? null : t.callHello;
    if (hello) {
      setMsgs([{ role: "argos", text: hello }]);
      setCall("speaking");
      const how = await speak(hello, speechLang(lang));
      if (how === "limit-anon") { inCall.current = false; setAnonOut(true); setCall("ended"); return; }
      if (!inCall.current) return;
    }
    listenTurn();
  }, [comune, lang, listenTurn, listingId, t]);

  const endCall = useCallback(() => {
    inCall.current = false;
    stopListen.current?.();
    stopListen.current = null;
    stopSpeaking();
    setPartial("");
    setCall("ended");
  }, []);

  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<{ mode?: Mode; text?: string }>).detail ?? {};
      setOpen(true);
      setMode(d.mode ?? "chat");
      if (d.mode === "call") void startCall();
      else if (d.text) void ask(d.text, "chat").then((r) => { if (aloud) void speak(r, speechLang(lang)); });
    };
    window.addEventListener("argos:open", on);
    return () => window.removeEventListener("argos:open", on);
  }, [ask, aloud, lang, startCall]);

  useEffect(() => () => endCall(), [endCall]);
  if (HIDE_ON.test(pathname)) return null;

  const greeting = listingId && comune ? t.helloListing(comune) : t.hello;
  const chips = listingId ? t.chipsListing : t.chips;
  const shown: Msg[] = msgs.length ? msgs : [{ role: "argos", text: greeting }];
  const mmss = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  async function sendChat(text: string, spoken: boolean) {
    const reply = await ask(text, "chat");
    if (aloud || spoken) void speak(reply, speechLang(lang));
  }

  return (
    <>
      {!open && (
        <div className={`fixed bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] right-3 z-50 items-center gap-1.5 md:flex md:bottom-6 md:right-6 ${listingId || pathname === "/" ? "hidden" : "flex"}`}>
          <button type="button" onClick={() => { setOpen(true); setMode("chat"); }}
            className="flex h-11 items-center gap-2 rounded-full border border-foreground/10 bg-background/90 px-3.5 text-[15px] sm:h-12 sm:px-4 shadow-[0_12px_32px_-12px_oklch(0.3_0.04_250/0.45)] backdrop-blur-xl transition-transform hover:-translate-y-0.5">
            <MessageCircle className="h-4 w-4 text-azure" />
            <span className="hidden sm:inline">{t.chat}</span>
          </button>
          <button type="button" aria-label={t.call} onClick={() => { setOpen(true); setMode("call"); void startCall(); }}
            className="group flex h-11 items-center gap-2 rounded-full bg-azure px-3.5 text-[15px] sm:h-12 sm:px-4 text-white shadow-[0_12px_32px_-10px_oklch(0.55_0.15_245/0.7)] transition-transform hover:-translate-y-0.5">
            <span className="relative flex h-5 w-5 items-center justify-center">
              <span className="absolute inset-0 animate-ping rounded-full bg-white/30" />
              <Phone className="relative h-4 w-4" />
            </span>
            <span className="hidden sm:inline">{t.call}</span>
          </button>
        </div>
      )}

      {open && (
        <div role="dialog" aria-label="Argos"
          className="fixed inset-x-2 bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-50 flex h-[min(620px,calc(100svh-7rem))] flex-col overflow-hidden rounded-[18px] border border-foreground/10 bg-background/95 shadow-[0_30px_80px_-30px_oklch(0.25_0.04_250/0.55)] backdrop-blur-xl md:inset-x-auto md:bottom-6 md:right-6 md:w-[400px]">
          <header className="flex items-center justify-between gap-3 border-b border-foreground/10 px-4 py-3">
            <div>
              <p className="font-display text-[22px] italic leading-none text-azure">Argos</p>
              <p className="mt-1 text-[12px] font-light text-muted-foreground">
                {t.sub} · <TelegramLink />
              </p>
            </div>
            <div className="flex items-center gap-1">
              <div className="flex rounded-full bg-muted p-0.5 text-[13px]">
                {(["chat", "call"] as const).map((m) => (
                  <button key={m} type="button" onClick={() => { if (m === "chat" && inCall.current) endCall(); setMode(m); }}
                    className={cn("flex items-center gap-1 rounded-full px-3 py-1 transition-colors", mode === m ? "bg-background shadow-sm" : "text-muted-foreground")}>
                    {m === "chat" ? <MessageCircle className="h-3.5 w-3.5" /> : <Phone className="h-3.5 w-3.5" />}
                    {m === "chat" ? (lang === "ru" ? "Чат" : "Chat") : (lang === "ru" ? "Звонок" : "Call")}
                  </button>
                ))}
              </div>
              <button type="button" aria-label="Close" onClick={() => { endCall(); setOpen(false); }}
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
          </header>

          {mode === "chat" ? (
            <>
              <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
                {shown.map((m, i) => (
                  <div key={i} className={cn("max-w-[90%]", m.role === "user" && "ml-auto")}>
                    <p className={cn("text-[15px] leading-relaxed", m.role === "user" ? "rounded-2xl rounded-br-md bg-foreground px-3.5 py-2.5 text-background" : "font-light")}>{m.text}</p>
                    {m.rows && (
                      <div className="mt-2 space-y-1.5">
                        {m.rows.map((r) => (
                          <Link key={r.id} to="/listing/$id" params={{ id: r.id! }}
                            className="flex items-center gap-3 rounded-xl border border-foreground/10 bg-card p-2 transition-colors hover:border-azure/40">
                            {thumb(r) ? <img src={thumb(r)!} alt="" referrerPolicy="no-referrer" className="h-12 w-12 shrink-0 rounded-lg object-cover" /> : <span className="h-12 w-12 shrink-0 rounded-lg bg-muted" />}
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-display text-[17px]">{r.comune}</span>
                              <span className="block text-[12px] text-muted-foreground tnum">{r.price_eur != null ? formatEur(r.price_eur) : ""}{r.region ? ` · ${r.region}` : ""}</span>
                            </span>
                            <span className="pr-1 text-[12px] text-azure">{t.see}</span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {busy && <p className="font-display italic text-muted-foreground">{t.thinking}</p>}
                {!msgs.length && (
                  <div className="flex flex-wrap gap-1.5">
                    {chips.map((c) => (
                      <button key={c} type="button" onClick={() => void sendChat(c, false)}
                        className="rounded-full border border-foreground/12 px-3 py-1.5 text-left text-[13px] font-light hover:border-foreground/30">{c}</button>
                    ))}
                  </div>
                )}
                <div ref={bottom} />
              </div>
              <div className="border-t border-foreground/10 p-3">
                <ArgosComposer tone="light" busy={busy} lang={speechLang(lang)} placeholder={t.ask} onSubmit={(x, spoken) => void sendChat(x, spoken)} />
                <button type="button" onClick={() => { if (aloud) stopSpeaking(); setAloud(!aloud); }} aria-pressed={aloud}
                  className="mx-auto mt-2 flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground">
                  {aloud ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
                  {aloud ? (lang === "ru" ? "Argos отвечает голосом" : "Argos answers out loud") : (lang === "ru" ? "Включить голос Argos" : "Turn on Argos's voice")}
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center overflow-hidden px-5 pb-5 pt-6">
              <div className="relative flex h-40 w-40 items-center justify-center">
                <span className={cn("absolute inset-0 rounded-full bg-gradient-to-br from-[oklch(0.78_0.09_235)] to-[oklch(0.55_0.15_250)] opacity-25",
                  (call === "listening" || call === "speaking") && "animate-ping [animation-duration:2.2s]")} />
                <span className={cn("absolute inset-4 rounded-full bg-gradient-to-br from-[oklch(0.82_0.07_230)] to-[oklch(0.52_0.16_250)] shadow-[0_20px_50px_-15px_oklch(0.5_0.16_250/0.7)] transition-transform duration-500",
                  call === "speaking" && "scale-105", call === "thinking" && "animate-pulse")} />
                <span className="relative font-display text-[28px] italic text-white">Argos</span>
              </div>
              <p className="mt-5 font-display text-[22px]">
                {call === "listening" ? t.listening : call === "thinking" ? t.thinking : call === "speaking" ? t.speaking : call === "ended" ? t.ended : t.call}
              </p>
              {(call !== "idle") && <p className="mt-1 text-[13px] text-muted-foreground tnum">{mmss}</p>}
              <div className="mt-4 w-full flex-1 space-y-2 overflow-y-auto text-[14px] font-light">
                {call === "idle" && !msgs.length && <p className="text-center text-muted-foreground">{canListen() ? t.idle : t.noMic}</p>}
                {msgs.slice(-4).map((m, i) => (
                  <p key={i} className={cn(m.role === "user" ? "text-right text-foreground/60" : "text-foreground/85")}>{m.text}</p>
                ))}
                {partial && <p className="text-right italic text-foreground/50">{partial}</p>}
                {note && <p className="text-center text-[13px] text-muted-foreground">{note}</p>}
                {anonOut && (
                  <div className="rounded-xl bg-azure-soft/60 p-3 text-center">
                    <p>{t.anonLimit}</p>
                    <Link to="/login" search={{ redirect: pathname }} className="mt-2 inline-block rounded-full bg-foreground px-4 py-1.5 text-[13px] text-background">{t.signIn}</Link>
                  </div>
                )}
                <div ref={bottom} />
              </div>
              {call === "idle" || call === "ended" ? (
                <button type="button" disabled={!canListen()} onClick={() => void startCall()}
                  className="mt-4 flex h-14 items-center gap-2 rounded-full bg-azure px-7 text-white shadow-[0_14px_36px_-12px_oklch(0.55_0.15_245/0.7)] disabled:opacity-40">
                  <Phone className="h-5 w-5" /> {t.start}
                </button>
              ) : (
                <button type="button" onClick={endCall}
                  className="mt-4 flex h-14 items-center gap-2 rounded-full bg-[oklch(0.58_0.19_25)] px-7 text-white">
                  <PhoneOff className="h-5 w-5" /> {t.end}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}

/** Signed in and not yet linked: connect, so Telegram chats land in the account. Otherwise a plain link to the bot. */
function TelegramLink() {
  const ru = useLang() === "ru";
  const signedIn = useSignedIn();
  const status = useQuery({ ...telegramStatusQuery, enabled: !!signedIn });
  const connect = useConnectTelegram();
  if (signedIn && status.data && !status.data.connected) {
    return <button type="button" onClick={() => connect.mutate()} className="text-azure hover:underline">{ru ? "Подключить Telegram" : "Connect Telegram"}</button>;
  }
  return <a href="https://t.me/odysstay_bot" target="_blank" rel="noreferrer" className="text-azure hover:underline">Telegram</a>;
}
