import { createFileRoute, Link } from "@tanstack/react-router";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { ArrowLeft, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";

import { ArgosComposer } from "@/components/odys/ArgosComposer";
import { ListingCard, ListingCardSkeleton } from "@/components/odys/ListingCard";
import { Wordmark } from "@/components/odys/primitives";
import { callFunction } from "@/lib/agent";
import { fallbackReply, parseRequest, runSearch, type ArgosSearch } from "@/lib/argos";
import type { FeedRow } from "@/lib/feed";
import { cn } from "@/lib/utils";
import { canSpeak, speak, stopSpeaking, VOICE_LANGS } from "@/lib/voice";

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

const langOf = (text: string, current: string) => (/[а-яё]/i.test(text) ? "ru-RU" : /[àèìòù]|\b(una|casa|vorrei|cerco)\b/i.test(text) ? "it-IT" : current === "ru-RU" ? "en-GB" : current);

function ArgosPage() {
  const { q, voice } = Route.useSearch();
  const [msgs, setMsgs] = useState<Msg[]>([{
    role: "argos",
    text: "Ciao, I'm Argos. Tell me where you'd like to wake up, what you want to spend and how much work you'll take on. I'll find it and do the Italian.",
  }]);
  const [search, setSearch] = useState<ArgosSearch | null>(null);
  const [rows, setRows] = useState<FeedRow[]>([]);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [aloud, setAloud] = useState(voice);
  const [lang, setLang] = useState("en-GB");
  const started = useRef(false);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs.length, busy]);
  useEffect(() => () => stopSpeaking(), []);

  async function handle(text: string, spoken = false) {
    const l = langOf(text, lang);
    setLang(l);
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
    let reply = fallbackReply(s, found.total, found.relaxed, found.rows);
    try {
      const r = await callFunction<{ reply: string }>("argos", {
        messages: history.slice(-8),
        understood: s.understood,
        not_yet: s.notYet,
        relaxed: found.relaxed,
        total: found.total,
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
    if (speakIt && canSpeak()) speak(reply, l);
  }

  useEffect(() => {
    if (q && !started.current) {
      started.current = true;
      void handle(q, voice);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="grid min-h-[100svh] bg-background lg:h-[100svh] lg:grid-cols-[minmax(380px,460px)_1fr]">
      <aside className="flex flex-col border-b bg-card lg:h-[100svh] lg:border-b-0 lg:border-r">
        <header className="flex items-center justify-between px-5 py-4">
          <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> <Wordmark className="text-2xl text-foreground" />
          </Link>
          {canSpeak() && (
            <button type="button" onClick={() => { if (aloud) stopSpeaking(); setAloud(!aloud); }}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-pressed={aloud}>
              {aloud ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />} {aloud ? "Argos speaks" : "Argos is quiet"}
            </button>
          )}
        </header>
        <div className="flex-1 space-y-5 overflow-y-auto px-5 pb-4 lg:min-h-0">
          {msgs.map((m, i) => (
            <div key={i} className={cn("max-w-[92%]", m.role === "user" ? "ml-auto" : "")}>
              {m.role === "argos" && <p className="mb-1 font-display text-lg italic text-brand">Argos</p>}
              <p className={cn("leading-relaxed", m.role === "user" ? "rounded-3xl rounded-br-md bg-foreground px-4 py-3 text-background" : "text-[1.05rem]")}>
                {m.text}
              </p>
            </div>
          ))}
          {busy && <p className="font-display text-lg italic text-muted-foreground">Argos is looking…</p>}
          <div ref={bottom} />
        </div>
        <div className="space-y-2 border-t p-4">
          <div className="flex gap-1.5">
            {VOICE_LANGS.map((v) => (
              <button key={v.code} type="button" onClick={() => setLang(v.code)}
                className={cn("rounded-full px-2.5 py-1 text-xs", lang === v.code ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>
                {v.label}
              </button>
            ))}
          </div>
          <ArgosComposer tone="light" onSubmit={(t, spoken) => void handle(t, spoken)} busy={busy} lang={lang}
            placeholder="Tell me more…" />
          <p className="text-center text-[11px] text-muted-foreground">Argos is an AI agent. Facts come from the official notices, never from guesses.</p>
        </div>
      </aside>

      <main className="min-w-0 overflow-y-auto px-5 py-6 lg:h-[100svh] lg:px-10 lg:py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{search ? "What Argos found" : "Waiting for your dream"}</p>
            <h1 className="mt-1 text-4xl md:text-5xl">
              {search ? (total ? `${total.toLocaleString("en-GB")} open, best first` : "Nothing open yet") : "Say it, and houses appear here."}
            </h1>
          </div>
          {search && (
            <div className="flex flex-wrap gap-2">
              {[...search.understood, ...search.notYet.map((n) => `${n} (can't filter yet)`)].map((u) => (
                <span key={u} className="rounded-full border bg-card px-3 py-1 text-sm">{u}</span>
              ))}
            </div>
          )}
        </div>
        <div className="mt-8 grid gap-8 sm:grid-cols-2 2xl:grid-cols-3">
          {busy && !rows.length
            ? Array.from({ length: 6 }, (_, i) => <ListingCardSkeleton key={i} />)
            : rows.map((r) => <ListingCard key={r.id} row={r} profile={null} />)}
        </div>
        {!search && (
          <p className="mt-6 max-w-lg text-muted-foreground">
            Court sales, notary sales, €1 towns and private auctions across Italy, read every day. Tell Argos what you want and the right ones show up here.
          </p>
        )}
      </main>
    </div>
  );
}
