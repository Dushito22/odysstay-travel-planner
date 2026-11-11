import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check, Lock, Mic, MessageSquareText, Pause, PhoneOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Wordmark } from "@/components/odys/primitives";
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";
import { callFunction } from "@/lib/agent";
import { chooseLang, speechLang, useLang, type Lang } from "@/lib/i18n";
import { profileQuery, REGIONS, saveProfile, type ProfileUpdate } from "@/lib/profile";
import { signupSource } from "@/lib/source";
import { cn } from "@/lib/utils";
import { canListen, listen, speak, stopSpeaking } from "@/lib/voice";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Welcome | Odysstay" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(profileQuery),
  component: Onboarding,
});

type Step = "lang" | "how" | "prep" | "call" | "q1" | "q2" | "q3" | "review";
type Heard = { intent: string | null; budget_max_eur: number | null; renovation_budget_eur: number | null; preferred_regions: string[]; property_types: string[]; wants_ready: boolean | null };

const C = {
  en: {
    langTitle: <>Ciao. Which language shall <em className="italic text-azure">we speak</em>?</>,
    langSub: "The site, Argos's messages, calls and your weekly picks will all be in it. You can change it any time in your profile.",
    howTitle: <>Tell <em className="italic text-azure">Argos</em> what you're looking for.</>,
    howSub: "Four things: what the house is for, your budget, where, and how much work you'll take on.",
    call: "Talk to Argos", callSub: "A one-minute call. He asks, you answer.", recommended: "Easiest",
    form: "Answer 3 questions", formSub: "Tap through in thirty seconds.",
    skip: "Skip for now",
    prepTitle: "Before we start",
    tips: ["Speak naturally, in your own words. He'll wait while you think.", "You can end the call any time and finish by tapping instead.", "The call isn't recorded or shared. Only your answers are kept."],
    mic: "Allow the microphone", micOk: "Microphone ready", start: "Start the call",
    listening: "Listening…", thinking: "Argos is thinking…", speaking: "Argos is speaking", end: "End call",
    q1: "What's the house for?", q2: "What's your budget?", q3: <>Where in <em className="italic text-azure">Italy</em>?</>,
    q3Sub: "Pick as many as you like, or none for anywhere.",
    intents: [["live", "To live in"], ["holiday_home", "A holiday home"], ["rental_income", "Rental income"], ["renovate_and_sell", "Renovate and sell"], ["not_sure", "Not sure yet"]],
    anywhere: "Anywhere", next: "Continue", back: "Back",
    reviewTitle: <>Here's what <em className="italic text-azure">Argos</em> heard.</>,
    reviewSub: "He'll use this to pick your houses. You can change it later in your profile.",
    labels: { intent: "For", budget: "Budget", where: "Where", work: "Work" },
    ready: "Ready to live in", work: "Some work is fine", any: "Anywhere in Italy", notSaid: "Not said",
    go: "Show me houses", fix: "Change answers",
    noMic: "This browser can't hear you. Answer three quick questions instead.",
  },
  ru: {
    langTitle: <>Ciao. На каком языке <em className="italic text-azure">будем говорить</em>?</>,
    langSub: "На нём будут сайт, сообщения и звонки Argos и ваша еженедельная подборка. Поменять можно в профиле.",
    howTitle: <>Расскажите <em className="italic text-azure">Argos</em>, что вы ищете.</>,
    howSub: "Четыре вещи: для чего дом, бюджет, где и готовы ли вы к ремонту.",
    call: "Поговорить с Argos", callSub: "Звонок на минуту. Он спрашивает, вы отвечаете.", recommended: "Проще всего",
    form: "Ответить на 3 вопроса", formSub: "Тридцать секунд, просто нажимайте.",
    skip: "Пропустить",
    prepTitle: "Перед звонком",
    tips: ["Говорите как обычно, своими словами. Он подождёт, пока вы думаете.", "Звонок можно закончить в любой момент и дальше ответить кнопками.", "Звонок не записывается и никому не передаётся. Сохраняются только ответы."],
    mic: "Разрешить микрофон", micOk: "Микрофон готов", start: "Начать звонок",
    listening: "Слушаю…", thinking: "Argos думает…", speaking: "Argos говорит", end: "Завершить",
    q1: "Для чего вам дом?", q2: "Какой у вас бюджет?", q3: <>Где в <em className="italic text-azure">Италии</em>?</>,
    q3Sub: "Выберите сколько угодно или ничего, если всё равно где.",
    intents: [["live", "Жить"], ["holiday_home", "Для отпуска"], ["rental_income", "Сдавать"], ["renovate_and_sell", "Отремонтировать и продать"], ["not_sure", "Пока не знаю"]],
    anywhere: "Где угодно", next: "Дальше", back: "Назад",
    reviewTitle: <>Вот что услышал <em className="italic text-azure">Argos</em>.</>,
    reviewSub: "По этому он будет подбирать дома. Поменять можно в профиле.",
    labels: { intent: "Для чего", budget: "Бюджет", where: "Где", work: "Ремонт" },
    ready: "Готов к жизни", work: "Ремонт не пугает", any: "Где угодно в Италии", notSaid: "Не сказано",
    go: "Показать дома", fix: "Изменить ответы",
    noMic: "Этот браузер вас не услышит. Ответьте на три вопроса.",
  },
} as const;

function Onboarding() {
  const { data: p } = useSuspenseQuery(profileQuery);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const lang = useLang();
  const c = C[lang];
  const [step, setStep] = useState<Step>(p?.language ? "how" : "lang");
  const [heard, setHeard] = useState<Heard>({
    intent: p?.intent ?? null, budget_max_eur: p?.budget_max_eur ?? null, renovation_budget_eur: p?.renovation_budget_eur ?? null,
    preferred_regions: p?.preferred_regions ?? [], property_types: p?.property_types ?? [], wants_ready: null,
  });
  const [saving, setSaving] = useState(false);

  async function finish(patch: ProfileUpdate) {
    setSaving(true);
    try {
      await saveProfile({ ...patch, language: lang, onboarded: true, signup_source: signupSource() });
      await qc.invalidateQueries({ queryKey: profileQuery.queryKey });
      navigate({ to: "/discover" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save. Please try again.");
      setSaving(false);
    }
  }
  const save = () => finish({
    intent: heard.intent, budget_max_eur: heard.budget_max_eur, renovation_budget_eur: heard.renovation_budget_eur,
    preferred_regions: heard.preferred_regions, property_types: heard.property_types,
  });

  return (
    <div className="grain relative flex min-h-[100svh] flex-col bg-background">
      <header className="flex items-center justify-between px-5 py-5 sm:px-8">
        <Wordmark size="md" />
        {step !== "lang" && step !== "call" && (
          <button type="button" onClick={() => void finish({})} className="text-[13px] font-light text-foreground/50 hover:text-foreground">{c.skip}</button>
        )}
      </header>
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-5 pb-16">
        {step === "lang" && <LangStep onPick={(l) => { chooseLang(l); setStep("how"); }} />}
        {step === "how" && <HowStep c={c} onCall={() => setStep(canListen() ? "prep" : "q1")} onForm={() => setStep("q1")} />}
        {step === "prep" && <PrepStep c={c} onStart={() => setStep("call")} onBack={() => setStep("how")} />}
        {step === "call" && (
          <CallStep c={c} lang={lang} onDone={(h) => { setHeard((o) => ({ ...o, ...h })); setStep("review"); }} onQuit={() => setStep("q1")} />
        )}
        {step === "q1" && (
          <Question title={c.q1} c={c} onBack={() => setStep("how")} onNext={() => setStep("q2")} canNext={!!heard.intent}>
            <div className="flex flex-wrap gap-2">
              {c.intents.map(([v, label]) => (
                <Pill key={v} active={heard.intent === v} onClick={() => setHeard({ ...heard, intent: v })}>{label}</Pill>
              ))}
            </div>
          </Question>
        )}
        {step === "q2" && (
          <Question title={c.q2} c={c} onBack={() => setStep("q1")} onNext={() => { setHeard({ ...heard, budget_max_eur: heard.budget_max_eur ?? 60000 }); setStep("q3"); }} canNext>
            <div className="font-display text-[44px] leading-none tnum">€{(heard.budget_max_eur ?? 60000).toLocaleString(lang === "ru" ? "ru-RU" : "en-GB")}</div>
            <Slider className="mt-6" value={[heard.budget_max_eur ?? 60000]} min={10000} max={500000} step={5000}
              onValueChange={([v]) => setHeard({ ...heard, budget_max_eur: v ?? 60000 })} aria-label={String(c.q2)} />
          </Question>
        )}
        {step === "q3" && (
          <Question title={c.q3} sub={c.q3Sub} c={c} onBack={() => setStep("q2")} onNext={() => setStep("review")} canNext>
            <div className="flex flex-wrap gap-1.5">
              <Pill small active={!heard.preferred_regions.length} onClick={() => setHeard({ ...heard, preferred_regions: [] })}>{c.anywhere}</Pill>
              {REGIONS.map((r) => (
                <Pill small key={r} active={heard.preferred_regions.includes(r)}
                  onClick={() => setHeard({ ...heard, preferred_regions: heard.preferred_regions.includes(r) ? heard.preferred_regions.filter((x) => x !== r) : [...heard.preferred_regions, r] })}>
                  {r}
                </Pill>
              ))}
            </div>
          </Question>
        )}
        {step === "review" && (
          <div>
            <h1 className="type-h2">{c.reviewTitle}</h1>
            <p className="mt-3 type-body text-foreground/60">{c.reviewSub}</p>
            <dl className="mt-8 divide-y divide-border rounded-[14px] border border-border bg-card">
              <Row k={c.labels.intent} v={c.intents.find(([v]) => v === heard.intent)?.[1] ?? c.notSaid} />
              <Row k={c.labels.budget} v={heard.budget_max_eur ? `€${heard.budget_max_eur.toLocaleString(lang === "ru" ? "ru-RU" : "en-GB")}` : c.notSaid} />
              <Row k={c.labels.where} v={heard.preferred_regions.length ? heard.preferred_regions.join(", ") : c.any} />
              {heard.wants_ready != null && <Row k={c.labels.work} v={heard.wants_ready ? c.ready : c.work} />}
            </dl>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button type="button" disabled={saving} onClick={() => void save()}
                className="inline-flex h-12 items-center gap-2 rounded-full bg-foreground px-6 text-[15px] text-background disabled:opacity-60">
                {c.go} <ArrowRight className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => setStep("q1")} className="text-[14px] font-light text-foreground/60 hover:text-foreground">{c.fix}</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function LangStep({ onPick }: { onPick: (l: Lang) => void }) {
  return (
    <div>
      <h1 className="type-h2">Ciao. Which language shall <em className="italic text-azure">we speak</em>?</h1>
      <p className="mt-3 type-body text-foreground/60">На каком языке будем говорить?</p>
      <div className="mt-8 grid grid-cols-2 gap-3">
        {([["en", "English", "Argos speaks English"], ["ru", "Русский", "Argos говорит по-русски"]] as const).map(([l, name, sub]) => (
          <button key={l} type="button" onClick={() => onPick(l)}
            className="group rounded-[14px] border border-border bg-card p-5 text-left transition-all hover:border-foreground/40 hover:shadow-hover">
            <div className="font-display text-[30px] leading-none">{name}</div>
            <div className="mt-2 text-[13px] font-light text-foreground/55">{sub}</div>
          </button>
        ))}
      </div>
      <NextLanguage />
    </div>
  );
}

/** Asks which language Argos should learn next, and saves the answer. */
function NextLanguage() {
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState("");
  const [sent, setSent] = useState(false);
  async function send() {
    const l = lang.trim().slice(0, 40);
    if (l.length < 2) return;
    const { data } = await supabase.auth.getUser();
    const { error } = await supabase.from("language_requests" as never).insert({ language: l, user_id: data.user?.id } as never);
    if (error) toast.error("Couldn't send it. Try again."); else setSent(true);
  }
  if (sent) return <p className="mt-6 text-[14px] font-light text-foreground/65">Noted. Argos is already practising. Meanwhile, pick English or Russian above.</p>;
  return (
    <div className="mt-6">
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="text-left text-[14px] font-light text-foreground/60 transition-colors hover:text-foreground">
          Argos is learning a new language as we speak. <span className="text-azure underline-offset-4 hover:underline">Which should be next?</span>
          <span className="mt-0.5 block text-[13px] text-foreground/45">Argos учит новые языки. Какой выучить следующим?</span>
        </button>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); void send(); }} className="flex max-w-md gap-2">
          <input autoFocus value={lang} onChange={(e) => setLang(e.target.value)} placeholder="Italiano, Deutsch, 中文, Српски…" maxLength={40}
            className="h-11 min-w-0 flex-1 rounded-full border bg-card px-4 text-[14px] outline-none focus:border-foreground/40" />
          <button type="submit" disabled={lang.trim().length < 2} className="h-11 rounded-full bg-azure px-5 text-[14px] text-white disabled:opacity-40">Teach him</button>
        </form>
      )}
    </div>
  );
}

type Copy = (typeof C)[Lang];

function HowStep({ c, onCall, onForm }: { c: Copy; onCall: () => void; onForm: () => void }) {
  const mic = typeof window !== "undefined" && canListen();
  return (
    <div>
      <h1 className="type-h2">{c.howTitle}</h1>
      <p className="mt-3 type-body text-foreground/60">{c.howSub}</p>
      <div className="mt-8 grid gap-3">
        {mic && (
          <button type="button" onClick={onCall}
            className="flex items-center gap-4 rounded-[14px] bg-azure p-5 text-left text-white shadow-[0_14px_40px_-18px_oklch(0.52_0.13_245/0.9)] transition-transform hover:-translate-y-0.5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/15"><Mic className="h-5 w-5" /></span>
            <span className="flex-1">
              <span className="flex items-center gap-2 text-[17px]">{c.call}<span className="whitespace-nowrap rounded-full bg-white/20 px-2 py-0.5 text-[11px]">{c.recommended}</span></span>
              <span className="mt-0.5 block text-[14px] font-light text-white/80">{c.callSub}</span>
            </span>
            <ArrowRight className="h-4 w-4" />
          </button>
        )}
        <button type="button" onClick={onForm}
          className="flex items-center gap-4 rounded-[14px] border border-border bg-card p-5 text-left transition-colors hover:border-foreground/40">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted"><MessageSquareText className="h-5 w-5" /></span>
          <span className="flex-1">
            <span className="block text-[17px]">{c.form}</span>
            <span className="mt-0.5 block text-[14px] font-light text-foreground/60">{c.formSub}</span>
          </span>
          <ArrowRight className="h-4 w-4 text-foreground/40" />
        </button>
        {!mic && <p className="text-[13px] font-light text-foreground/50">{c.noMic}</p>}
      </div>
    </div>
  );
}

function PrepStep({ c, onStart, onBack }: { c: Copy; onStart: () => void; onBack: () => void }) {
  const [ok, setOk] = useState(false);
  async function ask() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      s.getTracks().forEach((t) => t.stop());
      setOk(true);
    } catch {
      toast.error("Microphone blocked. Allow it in your browser settings.");
    }
  }
  const icons = [Mic, Pause, Lock];
  return (
    <div>
      <button type="button" onClick={onBack} className="mb-6 inline-flex items-center gap-1.5 text-[13px] font-light text-foreground/50 hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" />{c.back}</button>
      <h1 className="type-h2">{c.prepTitle}</h1>
      <ul className="mt-8 space-y-4 rounded-[14px] border border-border bg-card p-5">
        {c.tips.map((t, i) => {
          const Icon = icons[i] ?? Mic;
          return (
            <li key={t} className="flex items-start gap-3.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-azure-soft text-azure"><Icon className="h-4 w-4" /></span>
              <span className="pt-1.5 text-[15px] font-light leading-snug">{t}</span>
            </li>
          );
        })}
      </ul>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        {!ok ? (
          <button type="button" onClick={() => void ask()} className="inline-flex h-12 items-center gap-2 rounded-full border border-foreground/20 px-6 text-[15px]">
            <Mic className="h-4 w-4" /> {c.mic}
          </button>
        ) : (
          <span className="inline-flex h-12 items-center gap-2 px-2 text-[15px] text-success"><Check className="h-4 w-4" /> {c.micOk}</span>
        )}
        <button type="button" disabled={!ok} onClick={onStart}
          className="inline-flex h-12 items-center gap-2 rounded-full bg-azure px-6 text-[15px] text-white transition-opacity disabled:opacity-35">
          {c.start} <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

type Turn = { role: "user" | "argos"; text: string };

function CallStep({ c, lang, onDone, onQuit }: { c: Copy; lang: Lang; onDone: (h: Partial<Heard>) => void; onQuit: () => void }) {
  const [state, setState] = useState<"thinking" | "speaking" | "listening">("thinking");
  const [line, setLine] = useState("");
  const [partial, setPartial] = useState("");
  const turns = useRef<Turn[]>([]);
  const live = useRef(true);
  const stop = useRef<(() => void) | null>(null);
  const misses = useRef(0);
  const last = useRef<Partial<Heard>>({});

  const turn = useCallback(async (said: string | null) => {
    if (said) turns.current.push({ role: "user", text: said });
    setState("thinking");
    let r: { reply: string; done: boolean; profile: Partial<Heard> };
    try {
      r = await callFunction("onboard", { lang, messages: turns.current });
    } catch {
      live.current = false;
      onQuit();
      return;
    }
    if (!live.current) return;
    last.current = r.profile ?? last.current;
    turns.current.push({ role: "argos", text: r.reply });
    setLine(r.reply);
    setState("speaking");
    await speak(r.reply, speechLang(lang));
    if (!live.current) return;
    if (r.done) { live.current = false; onDone(last.current); return; }
    hear();
  }, [lang]); // eslint-disable-line react-hooks/exhaustive-deps

  const hear = useCallback(() => {
    if (!live.current) return;
    setState("listening");
    setPartial("");
    stop.current = listen(speechLang(lang), setPartial, (heard) => {
      stop.current = null;
      if (!live.current) return;
      if (!heard.trim()) {
        misses.current += 1;
        if (misses.current >= 3) { live.current = false; onQuit(); return; }
        hear();
        return;
      }
      misses.current = 0;
      setPartial("");
      void turn(heard);
    }, (err) => {
      // Silence and interruptions end the turn on their own (onDone with nothing); only real failures end the call.
      if (/no-speech|aborted/.test(err)) return;
      live.current = false;
      onQuit();
    });
  }, [lang, turn]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    live.current = true;
    void turn(null);
    return () => { live.current = false; stop.current?.(); stopSpeaking(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function end() {
    live.current = false;
    stop.current?.();
    stopSpeaking();
    const h = last.current;
    if (h.intent || h.budget_max_eur || h.preferred_regions?.length) onDone(h); else onQuit();
  }

  const label = state === "listening" ? c.listening : state === "speaking" ? c.speaking : c.thinking;
  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative flex h-56 w-56 items-center justify-center sm:h-64 sm:w-64">
        <span className={cn("absolute inset-0 rounded-full bg-azure-soft transition-transform duration-700",
          state === "speaking" ? "animate-pulse scale-100" : state === "listening" ? "scale-90" : "scale-75 opacity-70")} />
        <span className="relative flex h-36 w-36 items-center justify-center rounded-full border border-azure/30 bg-background sm:h-40 sm:w-40">
          <span className="font-display text-[34px] italic text-azure">Argos</span>
        </span>
        {state === "listening" && <span className="absolute inset-6 animate-ping rounded-full border border-azure/30" />}
      </div>
      <p className="mt-6 text-[13px] uppercase tracking-[0.12em] text-foreground/50">{label}</p>
      <p className="mt-3 min-h-[3.5rem] max-w-md text-[19px] font-light leading-snug sm:text-[21px]">{state === "listening" && partial ? partial : line}</p>
      <button type="button" onClick={end}
        className="mt-10 inline-flex h-12 items-center gap-2 rounded-full bg-[oklch(0.58_0.17_27)] px-6 text-[15px] text-white">
        <PhoneOff className="h-4 w-4" /> {c.end}
      </button>
    </div>
  );
}

function Question({ title, sub, c, children, onBack, onNext, canNext }: {
  title: ReactNode; sub?: string; c: Copy; children: ReactNode; onBack: () => void; onNext: () => void; canNext: boolean;
}) {
  return (
    <div>
      <button type="button" onClick={onBack} className="mb-6 inline-flex items-center gap-1.5 text-[13px] font-light text-foreground/50 hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" />{c.back}</button>
      <h1 className="type-h2">{title}</h1>
      {sub && <p className="mt-3 type-body text-foreground/60">{sub}</p>}
      <div className="mt-8">{children}</div>
      <button type="button" disabled={!canNext} onClick={onNext}
        className="mt-10 inline-flex h-12 items-center gap-2 rounded-full bg-foreground px-6 text-[15px] text-background transition-opacity disabled:opacity-30">
        {c.next} <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function Pill({ active, onClick, children, small = false }: { active: boolean; onClick: () => void; children: ReactNode; small?: boolean }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick}
      className={cn("rounded-full border font-light transition-colors",
        small ? "h-8 px-3 text-[13px]" : "h-11 px-5 text-[15px]",
        active ? "border-foreground bg-foreground text-background" : "border-foreground/15 bg-card hover:border-foreground/40")}>
      {children}
    </button>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-5 py-3.5">
      <dt className="text-[13px] text-foreground/55">{k}</dt>
      <dd className="text-right text-[15px]">{v}</dd>
    </div>
  );
}
