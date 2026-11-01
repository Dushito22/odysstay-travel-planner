import { createFileRoute, Link } from "@tanstack/react-router";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { ArrowLeft, MessageCircle, PanelLeftClose, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";

import { ArgosComposer } from "@/components/odys/ArgosComposer";
import { ListingCard, ListingCardSkeleton } from "@/components/odys/ListingCard";
import { Wordmark } from "@/components/odys/primitives";
import { callFunction } from "@/lib/agent";
import { fallbackReply, parseRequest, runSearch, type ArgosSearch } from "@/lib/argos";
import type { FeedRow } from "@/lib/feed";
import { setLang, speechLang, useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { canSpeak, speak, stopSpeaking } from "@/lib/voice";

export const Route = createFileRoute("/argos")({
  ssr: false,
  validateSearch: zodValidator(z.object({
    q: fallback(z.string(), "").default(""),
    voice: fallback(z.boolean(), false).default(false),
  })),
  head: () => ({ meta: [{ title: "Argos | Odysstay" }, { name: "description", content: "Tell Argos what you want. He finds it in Italy." }] }),
  component: ArgosPage,
});

type Msg = { role: "user" | "argos"; text: string };
type Saved = { q: string; msgs: Msg[]; search: ArgosSearch | null; rows: FeedRow[]; total: number };
const KEY = "odys-argos";

const T = {
  en: {
    hello: "Ciao, I'm Argos. Tell me where you'd like to wake up, what you want to spend and how much work you'll take on. I'll find it and do the Italian.",
    speaks: "Argos speaks", quiet: "Argos is quiet", looking: "Argos is looking…", more: "Tell me more…",
    note: "Argos is an AI agent. Facts come from the official notices, never from guesses.",
    found: "What Argos found", waiting: "Waiting for your dream", open: (n: number) => `${n.toLocaleString("en-GB")} open, best value first`,
    none: "Nothing open yet", empty: "Say it, and houses appear here.", cant: "can't filter yet",
    intro: "Court sales, notary sales, €1 towns and private auctions across Italy, read every day. Tell Argos what you want and the right ones show up here.",
  },
  ru: {
    hello: "Ciao, я Argos. Расскажите, где хотите просыпаться, на какой бюджет рассчитываете и сколько ремонта готовы взять на себя. Найду сам, итальянский беру на себя.",
    speaks: "Argos говорит", quiet: "Argos молчит", looking: "Argos ищет…", more: "Расскажите подробнее…",
    note: "Argos: ИИ-агент. Только факты из официальных объявлений, никаких догадок.",
    found: "Что нашёл Argos", waiting: "Ждём вашу мечту", open: (n: number) => `Открыто ${n.toLocaleString("ru-RU")}, лучшие сначала`,
    none: "Пока ничего", empty: "Скажите, и дома появятся прямо здесь.", cant: "пока без фильтра",
    intro: "Судебные и нотариальные продажи, города с домами за €1 и частные аукционы по всей Италии, каждый день. Расскажите Argos, чего хотите, и подходящие дома появятся здесь.",
  },
};

function ArgosPage() {
  const { q, voice } = Route.useSearch();
  const lang = useLang();
  const t = T[lang];
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [search, setSearch] = useState<ArgosSearch | null>(null);
  const [rows, setRows] = useState<FeedRow[]>([]);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [aloud, setAloud] = useState(voice);
  const started = useRef(false);
  const [chatOpen, setChatOpen] = useState(true);

  // Coming back from a listing restores the conversation and results instead of asking again.
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(KEY) ?? "null") as Saved | null;
      if (saved && saved.q === q && saved.msgs.length) {
        started.current = true;
        setMsgs(saved.msgs); setSearch(saved.search); setRows(saved.rows); setTotal(saved.total);
      }
    } catch { /* storage blocked */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (busy || !msgs.length) return;
    try { sessionStorage.setItem(KEY, JSON.stringify({ q, msgs, search, rows, total } satisfies Saved)); } catch { /* full or blocked */ }
  }, [busy, msgs, search, rows, total, q]);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs.length, busy]);
  useEffect(() => () => stopSpeaking(), []);

  async function handle(text: string, spoken = false) {
    const l = /[а-яё]/i.test(text) ? "ru" : lang;
    if (l !== lang) setLang(l);
    const speakIt = aloud || spoken;
    if (spoken) setAloud(true);
    const history = [...msgs, { role: "user" as const, text }];
    setMsgs(history);
    setBusy(true);
    const s = parseRequest(text, search ?? undefined);
    setSearch(s);
    let found: Awaited<ReturnType<typeof runSearch>> = { rows: [], total: 0, relaxed: null };
    try {
      found = await runSearch(s);
    } catch {
      // keep empty; Argos says so
    }
    setRows(found.rows);
    setTotal(found.total);
    let reply = fallbackReply(s, found.total, found.relaxed, found.rows, l);
    try {
      const r = await callFunction<{ reply: string }>("argos", {
        messages: history.slice(-8),
        language: l === "ru" ? "Russian" : "English",
        understood: s.understood, not_yet: s.notYet, relaxed: found.relaxed, total: found.total,
        top: found.rows.slice(0, 6).map((x) => ({
          comune: x.comune, region: x.region, price_eur: x.price_eur, type: x.property_type, surface_sqm: x.surface_sqm,
          below_court_valuation_pct: x.discount_pct, sale_type: x.sale_type, days_left: x.days_left, has_photos: !!x.hero_image_path,
        })),
      });
      if (r.reply) reply = r.reply;
    } catch {
      // the AI is optional: the search above already ran on our own data
    }
    setMsgs((m) => [...m, { role: "argos", text: reply }]);
    setBusy(false);
    if (speakIt) void speak(reply, speechLang(l));
  }

  useEffect(() => {
    if (q && !started.current) {
      started.current = true;
      void handle(q, voice);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const shown: Msg[] = [{ role: "argos", text: t.hello }, ...msgs];
  return (
    <div className={cn("grid min-h-[100svh] bg-background lg:h-[100svh]", chatOpen && "lg:grid-cols-[minmax(360px,420px)_1fr]")}>
      {!chatOpen && (
        <button type="button" onClick={() => setChatOpen(true)}
          className="fixed bottom-6 left-6 z-40 flex h-12 items-center gap-2 rounded-full bg-azure px-5 text-white shadow-[0_12px_32px_-10px_oklch(0.55_0.15_245/0.7)]">
          <MessageCircle className="h-4 w-4" /> {lang === "ru" ? "Чат с Argos" : "Chat with Argos"}
        </button>
      )}
      <aside className={cn("flex flex-col border-b bg-card lg:h-[100svh] lg:border-b-0 lg:border-r", !chatOpen && "hidden")}>
        <header className="flex items-center justify-between px-5 py-4">
          <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> <Wordmark size="sm" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
              {(["en", "ru"] as const).map((l, i) => (
                <span key={l} className="flex items-center gap-1">
                  {i > 0 && <span aria-hidden>·</span>}
                  <button type="button" onClick={() => setLang(l)} className={cn(lang === l && "text-foreground")}>{l}</button>
                </span>
              ))}
            </div>
            <button type="button" onClick={() => setChatOpen(false)} aria-label={lang === "ru" ? "Скрыть чат" : "Hide chat"}
              className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
              <PanelLeftClose className="h-4 w-4" />
            </button>
            {canSpeak() && (
              <button type="button" onClick={() => { if (aloud) stopSpeaking(); setAloud(!aloud); }} aria-pressed={aloud}
                className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
                {aloud ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />} {aloud ? t.speaks : t.quiet}
              </button>
            )}
          </div>
        </header>
        <div className="flex-1 space-y-4 overflow-y-auto px-5 pb-4 lg:min-h-0">
          {shown.map((m, i) => (
            <div key={i} className={cn("max-w-[92%]", m.role === "user" && "ml-auto")}>
              {m.role === "argos" && <p className="mb-0.5 font-display text-base italic text-azure">Argos</p>}
              <p className={cn("text-[15px] leading-relaxed", m.role === "user" ? "rounded-2xl rounded-br-md bg-foreground px-3.5 py-2.5 text-background" : "font-light")}>{m.text}</p>
            </div>
          ))}
          {busy && <p className="font-display italic text-muted-foreground">{t.looking}</p>}
          <div ref={bottom} />
        </div>
        <div className="space-y-2 border-t p-4">
          <ArgosComposer tone="light" onSubmit={(x, spoken) => void handle(x, spoken)} busy={busy} lang={speechLang(lang)} placeholder={t.more} />
          <p className="text-center text-[11px] text-muted-foreground">{t.note}</p>
        </div>
      </aside>

      <main className="min-w-0 overflow-y-auto px-5 py-6 lg:h-[100svh] lg:px-10 lg:py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{search ? t.found : t.waiting}</p>
            <h1 className="mt-1 text-[32px] font-[200] md:text-[40px]">{busy ? t.looking : search ? (total ? t.open(total) : t.none) : t.empty}</h1>
          </div>
          {search && (
            <div className="flex flex-wrap gap-1.5">
              {[...search.understood, ...search.notYet.map((n) => `${n} (${t.cant})`)].map((u) => (
                <span key={u} className="rounded-full border px-3 py-1 text-[13px]">{u}</span>
              ))}
            </div>
          )}
        </div>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 2xl:grid-cols-3">
          {busy && !rows.length ? Array.from({ length: 6 }, (_, i) => <ListingCardSkeleton key={i} />) : rows.map((r) => <ListingCard key={r.id} row={r} profile={null} />)}
        </div>
        {!search && <p className="mt-6 max-w-lg font-light text-muted-foreground">{t.intro}</p>}
      </main>
    </div>
  );
}
