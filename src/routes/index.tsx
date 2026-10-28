import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Info, MailCheck } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { ArgosComposer } from "@/components/odys/ArgosComposer";
import { ListingCard, ListingCardSkeleton } from "@/components/odys/ListingCard";
import { PublicFooter } from "@/components/odys/PublicShell";
import { SourceQuote, Wordmark } from "@/components/odys/primitives";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { exampleFactQuery, sendMagicLink, sourceCountsQuery, topListingsQuery } from "@/lib/public";

const TITLE = "Odysstay | Tell me about your dream house";
const DESC =
  "Italy sells houses below the court's valuation and nobody tells you where. Argos finds them, reads the Italian, and makes the calls. Sprezzatura, on your behalf.";

/** Invented sample testimonials and similar demo content, for the internal demo only.
 * Set VITE_DEMO_CONTENT=false before any public launch: real reviews only from then on. */
const DEMO_CONTENT = import.meta.env["VITE_DEMO_CONTENT"] !== "false";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "/video/hero-poster.jpg" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const CHIPS = [
  "A stone house under €50k, some work is fine",
  "Show me the €1 houses",
  "Court auctions in Sicily under €30k",
  "Surprise me",
];

const STEPS = [
  { n: "01", title: "Say it.", body: "Budget, region, how much work you'll take on. Out loud, in English or Russian. Argos listens." },
  { n: "02", title: "Argos does Italy.", body: "Every court, notary and town hall notice read. The Italian translated. Emails and calls to delegates, notaries and surveyors, each one approved by you." },
  { n: "03", title: "You pick. You own.", body: "A shortlist, one deal room, one notary, your name on the deed. You never had to be brave on the phone." },
];

const TESTIMONIALS = [
  { quote: "I said 'something in Puglia, under forty, walk to a bar'. Nine days later I was standing in it.", name: "Hannah & Tom", where: "Bristol → Ceglie Messapica" },
  { quote: "Я не говорю по-итальянски ни слова. Argos звонил нотариусу, я пил кофе.", name: "Olga S.", where: "Moscow → Sciacca", en: "I don't speak a word of Italian. Argos called the notary, I drank coffee." },
  { quote: "The court papers were 84 pages. Argos told me the three lines that mattered.", name: "Marco & Lena", where: "Munich → Spoleto" },
  { quote: "Купил дом за 19 тысяч. Друзья думают, что я долго искал.", name: "Dmitri K.", where: "St Petersburg → Agrigento", en: "Bought a house for 19 thousand. My friends think I searched for ages." },
];

const FAQ = [
  { q: "So who actually buys the house?", a: "You do. Argos finds it, reads every document, writes and calls in Italian, and keeps every deadline. You approve each message, and you sign with the notary. We are a technology service, not an estate agency, law firm or notary." },
  { q: "Do I need to speak Italian?", a: "No. Talk to Argos in English or Russian. Everything Italian is translated, with the original one tap away, and every message Argos sends is shown to you in your language first." },
  { q: "Why are these houses so cheap?", a: "Most are sold by courts, notaries and towns, not by agents, so nobody markets them. Most need work and a little love. That's the whole discount." },
  { q: "What about the €1 houses?", a: "Real, with conditions: a renovation within a few years and a deposit of a few thousand euros. Argos shows each town's actual rules and the houses still on offer." },
  { q: "Can foreigners buy property in Italy?", a: "Most nationalities can. It depends on your citizenship and Italy's reciprocity rules. Argos checks it for you, and the notary confirms it before you commit." },
  { q: "What does it cost?", a: "Exploring and talking to Argos is free to start. Pro adds unlimited deals, outreach and calls. Fees to the court, the notary or a surveyor are paid by you, directly to them." },
];

function Index() {
  return (
    <div className="min-h-screen bg-background">
      <Hero />
      <Numbers />
      <Promise />
      <Sprezzatura />
      <Houses />
      <Proof />
      {DEMO_CONTENT && <Voices />}
      <Faq />
      <Final />
      <PublicFooter />
    </div>
  );
}

function HeroVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!still) setSrc(window.innerWidth < 900 ? "/video/hero-720.mp4" : "/video/hero-1080.mp4");
  }, []);
  return (
    <>
      <img src="/video/hero-poster.jpg" alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover" />
      {src && (
        <video
          ref={ref}
          src={src}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,oklch(0.15_0.02_245/0.15),oklch(0.12_0.02_245/0.55))]" />
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/50 to-transparent" />
    </>
  );
}

function Hero() {
  const navigate = useNavigate();
  const [hint, setHint] = useState(false);
  const go = (q: string, spoken = false) => navigate({ to: "/argos", search: { q, ...(spoken ? { voice: true } : {}) } });
  return (
    <section className="relative flex min-h-[100svh] flex-col overflow-hidden bg-foreground text-white">
      <HeroVideo />
      <header className="relative z-10 flex items-center justify-between px-5 py-5 md:px-10 md:py-7">
        <Wordmark className="text-white" />
        <nav className="flex items-center gap-1">
          <Button asChild variant="ghost" size="sm" className="text-white hover:bg-white/10 hover:text-white">
            <Link to="/explore">Browse</Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="text-white hover:bg-white/10 hover:text-white">
            <Link to="/pricing">Pricing</Link>
          </Button>
          <Button asChild size="sm" variant="ghost" className="frost rounded-full text-white hover:bg-white/20 hover:text-white">
            <Link to="/login">Sign in</Link>
          </Button>
        </nav>
      </header>

      <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-5 pb-24 text-center">
        <p className="font-display text-lg italic text-white/80 md:text-xl">sprezzatura, on your behalf.</p>
        <h1 className="mt-3 text-5xl leading-[1.02] md:text-7xl">Tell me about your dream house.</h1>
        <div className="mt-10 w-full">
          <ArgosComposer onSubmit={go} />
        </div>
        <div className="mt-3 flex items-start justify-center gap-2 text-sm text-white/75">
          <p>
            Just talk, like you would to a friend: where, how much, sea or hills, how much work you'll take on.
            I'll find it and do the Italian.
          </p>
          <button type="button" onClick={() => setHint(!hint)} aria-label="How talking to Argos works" className="mt-0.5 shrink-0 text-white/70 hover:text-white">
            <Info className="h-4 w-4" />
          </button>
        </div>
        {hint && (
          <div className="frost mt-4 w-full max-w-xl rounded-2xl p-4 text-left text-sm leading-relaxed text-white/90">
            <p className="font-medium text-white">I'm Argos. Talk to me like this:</p>
            <ul className="mt-2 space-y-1 text-white/80">
              <li>"Somewhere in Sicily under 30k. A house, not a flat. I can renovate."</li>
              <li>"Дом у моря на юге, до 50 тысяч, можно с ремонтом."</li>
              <li>"Show me the €1 towns in Sardinia."</li>
            </ul>
            <p className="mt-2 text-white/70">Tap the mic and speak, or type. I'll show real houses while we talk.</p>
          </div>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {CHIPS.map((c) => (
            <button key={c} type="button" onClick={() => go(c)}
              className="frost rounded-full px-4 py-2 text-sm text-white/90 transition-colors hover:bg-white/20">
              {c}
            </button>
          ))}
        </div>
        <Link to="/explore" className="mt-8 inline-flex items-center gap-1.5 text-sm text-white/75 underline-offset-4 hover:text-white hover:underline">
          Rather browse? See every listing <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <p className="relative z-10 pb-5 text-center text-xs tracking-wide text-white/55">
        Argos, your AI agent in Italy · powered by Claude and GPT
      </p>
    </section>
  );
}

function Numbers() {
  const c = useQuery(sourceCountsQuery).data;
  const fmt = (n: number | undefined, fallback: string) => (n ? n.toLocaleString("en-GB") : fallback);
  const items = [
    { n: fmt(c?.court, "16,000"), label: "court sales open now" },
    { n: fmt(c?.notary, "99"), label: "notary and public-body sales" },
    { n: fmt(c?.oneEuro, "73"), label: "towns selling houses for €1" },
    { n: c?.privateSales ? c.privateSales.toLocaleString("en-GB") : "New", label: "private auctions, added daily" },
  ];
  return (
    <section className="border-b">
      <div className="mx-auto max-w-6xl px-5 py-16 md:py-20">
        <h2 className="max-w-3xl text-4xl leading-[1.05] md:text-6xl">
          Italy sells houses below the court's valuation. <span className="italic text-muted-foreground">Nobody tells you where.</span>
        </h2>
        <dl className="mt-12 grid grid-cols-2 gap-y-10 md:grid-cols-4">
          {items.map((i) => (
            <div key={i.label} className="border-l border-brass/60 pl-5">
              <dt className="font-display text-5xl tnum md:text-6xl">{i.n}</dt>
              <dd className="mt-2 text-sm text-muted-foreground">{i.label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function Promise() {
  return (
    <section id="how" className="scroll-mt-8">
      <div className="mx-auto grid max-w-6xl gap-12 px-5 py-20 md:grid-cols-[1fr_1.4fr] md:py-28">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">How it works</p>
          <h2 className="mt-4 text-5xl leading-[1.02] md:text-6xl">Ten phone calls. <span className="italic">One shrug.</span></h2>
          <p className="mt-6 max-w-sm leading-relaxed text-muted-foreground">
            Behind the curtain: courts, town halls, a geometra, a notary, a deadline at noon on a Tuesday.
            In front of it: you, unbothered.
          </p>
        </div>
        <ol className="divide-y border-y">
          {STEPS.map((s) => (
            <li key={s.n} className="grid grid-cols-[3rem_1fr] gap-4 py-7">
              <span className="font-display text-2xl text-brass tnum">{s.n}</span>
              <div>
                <h3 className="text-3xl">{s.title}</h3>
                <p className="mt-2 max-w-lg leading-relaxed text-muted-foreground">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Sprezzatura() {
  return (
    <section className="bg-card">
      <div className="mx-auto max-w-6xl px-5 py-20 md:py-28">
        <div className="ml-auto max-w-2xl border-y border-foreground/15 py-10 md:mr-16">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <p className="font-display text-5xl italic md:text-6xl">sprezzatura</p>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">/sprets-ah-TOO-rah/ · noun · Italian</p>
          </div>
          <p className="mt-6 text-xl leading-relaxed">The art of making the difficult look effortless.</p>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            Castiglione, 1528. Back then it took a household of servants. Now it takes Argos.
          </p>
          <p className="mt-8 text-right font-display text-lg italic text-muted-foreground">Buying a house in Italy, apparently without effort.</p>
        </div>
      </div>
    </section>
  );
}

function Houses() {
  const q = useQuery(topListingsQuery(6, true));
  if (q.isSuccess && q.data.length === 0) return null;
  return (
    <section className="mx-auto max-w-6xl px-5 py-20 md:py-28">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <h2 className="text-5xl leading-[1.02] md:text-6xl">The house you'll swear you found by accident.</h2>
          <p className="mt-4 max-w-xl text-lg text-muted-foreground">
            Real ones, open for offers today. Most need work and a little love. That's the whole discount.
          </p>
        </div>
        <Button asChild variant="outline" size="lg">
          <Link to="/explore">See them all <ArrowRight /></Link>
        </Button>
      </div>
      <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {q.isLoading
          ? Array.from({ length: 3 }, (_, i) => <ListingCardSkeleton key={i} />)
          : (q.data ?? []).slice(0, 6).map((r) => <ListingCard key={r.id} row={r} profile={null} />)}
      </div>
    </section>
  );
}

function Proof() {
  const top = useQuery(topListingsQuery(3));
  const fact = useQuery(exampleFactQuery(top.data?.[0]));
  const f = fact.data;
  return (
    <section className="bg-cypress text-white">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-20 md:grid-cols-2 md:py-28">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/60">No source, no fact</p>
          <h2 className="mt-4 text-5xl leading-[1.02] md:text-6xl">If the notice doesn't say it, we don't either.</h2>
          <p className="mt-6 max-w-md leading-relaxed text-white/75">
            Every price, size and deadline links to the line it came from, with the translation beside it.
            If the document is silent, Argos says so. An agent that guesses is worse than no agent.
          </p>
        </div>
        <div className="rounded-3xl bg-card p-7 text-foreground md:p-9">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            {f ? `${f.comune ?? "Live example"} · ${f.label_en}` : "Example · Offer deadline"}
          </p>
          <div className="mt-3 font-display text-4xl">
            {f ? (
              <SourceQuote quote={f.quote} quoteEn={f.quote_en} page={f.page} sourceUrl={f.source_url}>
                {f.value_text ?? f.value_num}
              </SourceQuote>
            ) : "17 July 2026, 12:00"}
          </div>
          <blockquote lang="it" className="mt-6 border-l-2 border-terra pl-4 text-sm leading-relaxed">
            “{f ? f.quote : "Le offerte dovranno pervenire entro e non oltre le ore 12:00 del 17 luglio 2026."}”
          </blockquote>
          <p className="mt-2 pl-4 text-sm text-muted-foreground">
            {f ? f.quote_en : "Offers must arrive no later than 12:00 on 17 July 2026."}
          </p>
        </div>
      </div>
    </section>
  );
}

function Voices() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-20 md:py-28">
      <h2 className="text-5xl leading-[1.02] md:text-6xl">They barely tried.</h2>
      <div className="mt-12 grid gap-px overflow-hidden rounded-3xl border bg-border md:grid-cols-2">
        {TESTIMONIALS.map((t) => (
          <figure key={t.name} className="bg-card p-8">
            <blockquote className="font-display text-2xl leading-snug md:text-3xl">“{t.quote}”</blockquote>
            {t.en && <p className="mt-3 text-sm italic text-muted-foreground">{t.en}</p>}
            <figcaption className="mt-6 text-sm">
              <span className="font-medium">{t.name}</span>
              <span className="text-muted-foreground"> · {t.where}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section className="border-t">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 md:grid-cols-[1fr_1.6fr] md:py-28">
        <h2 className="text-5xl leading-[1.02] md:text-6xl">Fair questions.</h2>
        <Accordion type="single" collapsible>
          {FAQ.map((f) => (
            <AccordionItem key={f.q} value={f.q}>
              <AccordionTrigger className="text-left font-display text-2xl font-normal hover:no-underline">{f.q}</AccordionTrigger>
              <AccordionContent className="text-base leading-relaxed text-muted-foreground">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}

function Final() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setState("busy");
    setError(null);
    try {
      await sendMagicLink(email);
      setState("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the link. Please try again.");
      setState("idle");
    }
  }
  return (
    <section className="relative overflow-hidden bg-foreground text-white">
      <img src="/video/hero-poster.jpg" alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover opacity-40" />
      <div className="relative mx-auto max-w-4xl px-5 py-24 text-center md:py-32">
        <h2 className="text-5xl leading-[1.02] md:text-7xl">Your house is in an Italian PDF somewhere.</h2>
        <p className="mx-auto mt-5 max-w-xl text-lg text-white/80">Argos is already reading it. Free to start, no password, no card.</p>
        {state === "sent" ? (
          <p className="mt-10 inline-flex items-center gap-2 text-lg"><MailCheck className="h-5 w-5" /> Check your inbox for the sign-in link.</p>
        ) : (
          <form onSubmit={submit} className="frost mx-auto mt-10 flex max-w-md items-center gap-2 rounded-full p-1.5">
            <Input type="email" required autoComplete="email" aria-label="Email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com" className="h-11 border-0 bg-transparent text-white shadow-none placeholder:text-white/60 focus-visible:ring-0" />
            <Button type="submit" size="lg" className="rounded-full bg-white text-foreground hover:bg-white/90" disabled={state === "busy"}>
              {state === "busy" ? "Sending" : "Get started"}
            </Button>
          </form>
        )}
        {error && <p className="mt-3 text-sm text-white/80">{error}</p>}
      </div>
    </section>
  );
}
