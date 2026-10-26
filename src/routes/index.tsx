import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, FileSearch, Languages, MailCheck, Send, ShieldCheck } from "lucide-react";
import { useState, type FormEvent } from "react";

import hero from "@/assets/hero-villa.jpg";
import { ListingCard, ListingCardSkeleton } from "@/components/odys/ListingCard";
import { PublicFooter } from "@/components/odys/PublicShell";
import { SourceQuote, Wordmark } from "@/components/odys/primitives";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { exampleFactQuery, sendMagicLink, topListingsQuery } from "@/lib/public";

const TITLE = "Odysstay | Italy's hidden property, found and explained";
const DESC =
  "Thousands of Italian homes are sold every year by courts and town halls through notices most buyers never see. Odysstay finds them, explains them line by line, and helps you bid.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:image", content: hero },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const SOURCES = [
  "Court sales, Portale Vendite Pubbliche",
  "Comune notice boards",
  "Gazzetta Ufficiale",
];

const STEPS = [
  {
    icon: FileSearch,
    title: "Found",
    body: "We read official sources every day: every court-ordered sale in Italy, town hall notice boards and the national gazette. Most of it never reaches the property portals.",
  },
  {
    icon: Languages,
    title: "Explained",
    body: "Every fact is quoted from the original Italian and translated. Red flags, renovation ranges and grants you may qualify for, in plain English.",
  },
  {
    icon: Send,
    title: "Handled",
    body: "Your agent drafts messages in Italian to the sale delegate, the comune or a surveyor. You approve every message. Replies, quotes and deadlines land in one deal room.",
  },
];

const AUDIENCES = [
  { title: "Live there", body: "A home in a village or small town, at a fraction of city prices." },
  {
    title: "Holiday home",
    body: "A place to come back to every summer, bought without an agent's mark-up.",
  },
  {
    title: "Rental income",
    body: "Buildings and flats public bodies want to sell, often below market.",
  },
  {
    title: "Renovate and sell",
    body: "Stone houses and unsold lots with the numbers laid out before you bid.",
  },
];

const FAQ = [
  {
    q: "Is Odysstay an estate agency?",
    a: "No. Odysstay is a technology service. We are not an estate agency, law firm or notary. We find and explain public notices and help you organise the process. Always confirm with a qualified professional before committing.",
  },
  {
    q: "Do I need to speak Italian?",
    a: "No. Every notice is explained in English, with the original Italian one tap away. Your agent drafts formal Italian messages, and you see an English translation before you approve anything.",
  },
  {
    q: "Can foreigners buy property in Italy?",
    a: "Many can. It depends on your citizenship and on reciprocity rules between Italy and your country. Check your situation with a notary before you commit.",
  },
  {
    q: "What does it cost?",
    a: "Exploring is free, including full listing pages and one active deal. Pro is €29 a month for unlimited deals, drafting and illustrations. Fees to the comune, notary or surveyor are paid by you directly to them.",
  },
  {
    q: "What about the €1 houses?",
    a: "We track the calls published by comuni and show what they really involve: the renovation commitment, the guarantee and the deadlines, so you can judge the total cost before applying.",
  },
];

function Index() {
  return (
    <div className="min-h-screen">
      <Hero />
      <SourcesStrip />
      <LiveListings />
      <HowItWorks />
      <Trust />
      <Audiences />
      <Faq />
      <SignUp />
      <PublicFooter />
    </div>
  );
}

function Hero() {
  return (
    <div className="p-3 md:p-4">
      <section className="relative flex min-h-[calc(100svh-1.5rem)] flex-col overflow-hidden rounded-3xl md:min-h-[calc(100svh-2rem)]">
        <img
          src={hero}
          alt="Stone farmhouse on an Italian hillside at golden hour"
          width={1600}
          height={1104}
          fetchPriority="high"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-foreground/20 to-foreground/10" />
        <header className="relative z-10 flex items-center justify-between p-5 text-background md:p-8">
          <Wordmark className="text-background" />
          <nav className="flex items-center gap-2">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="text-background hover:bg-background/10 hover:text-background"
            >
              <Link to="/pricing">Pricing</Link>
            </Button>
            <Button asChild variant="secondary" size="sm">
              <Link to="/login">Sign in</Link>
            </Button>
          </nav>
        </header>
        <div className="relative z-10 mt-auto max-w-4xl p-6 text-background md:p-12">
          <p className="mb-5 text-sm font-medium uppercase tracking-[0.2em] text-background/75">
            Public notices, decoded
          </p>
          <h1 className="text-5xl leading-[1.02] md:text-7xl">
            Italy's hidden property market, in English.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-background/80">
            Thousands of homes are sold every year by Italian courts and town halls,
            through notices most buyers never see. Odysstay finds them, explains them line by line,
            and helps you bid.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Button asChild size="lg" variant="secondary">
              <Link to="/explore">
                Explore listings <ArrowRight />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="ghost"
              className="text-background hover:bg-background/10 hover:text-background"
            >
              <a href="#how">How it works</a>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

function SourcesStrip() {
  return (
    <section aria-label="Sources we read" className="mx-auto max-w-6xl px-5 py-10">
      <p className="text-center text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
        We read
      </p>
      <ul className="mt-4 flex flex-wrap justify-center gap-x-8 gap-y-3 text-sm font-medium text-muted-foreground">
        {SOURCES.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
    </section>
  );
}

function LiveListings() {
  const q = useQuery(topListingsQuery(3));
  if (q.isSuccess && q.data.length === 0) return null;
  return (
    <section className="mx-auto max-w-6xl px-5 py-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl md:text-4xl">Open right now</h2>
          <p className="mt-2 text-muted-foreground">
            The highest-scoring notices still taking offers.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/explore">
            See more <ArrowRight />
          </Link>
        </Button>
      </div>
      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {q.isLoading
          ? Array.from({ length: 3 }, (_, i) => <ListingCardSkeleton key={i} />)
          : (q.data ?? []).map((r) => <ListingCard key={r.id} row={r} profile={null} />)}
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-8 bg-muted/40 py-20">
      <div className="mx-auto max-w-6xl px-5">
        <h2 className="max-w-2xl text-3xl md:text-4xl">From an Italian PDF to a signed deed</h2>
        <div className="mt-12 grid gap-10 md:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, body }, i) => (
            <div key={title}>
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-foreground text-background">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-sm text-muted-foreground tnum">0{i + 1}</span>
              </div>
              <h3 className="mt-5 text-2xl font-semibold">{title}</h3>
              <p className="mt-3 leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Trust() {
  const top = useQuery(topListingsQuery(3));
  const fact = useQuery(exampleFactQuery(top.data?.[0]));
  const f = fact.data;
  return (
    <section className="mx-auto max-w-6xl px-5 py-20">
      <div className="grid items-center gap-10 md:grid-cols-2">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-success-soft px-3 py-1 text-sm font-medium text-success">
            <ShieldCheck className="h-4 w-4" /> No source, no fact
          </span>
          <h2 className="mt-5 text-3xl md:text-4xl">
            If the notice doesn't say it, we tell you that.
          </h2>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            Every price, size and deadline on Odysstay links to the exact sentence in the official
            Italian notice, with a translation. Facts we can't find in the original are never shown.
            Gaps are marked as not stated.
          </p>
        </div>
        <div className="rounded-3xl border bg-card p-6 md:p-8">
          {f ? (
            <>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {f.comune ?? "Live example"} · {f.label_en}
              </p>
              <div className="mt-3 text-3xl font-semibold">
                <SourceQuote
                  quote={f.quote}
                  quoteEn={f.quote_en}
                  page={f.page}
                  sourceUrl={f.source_url}
                >
                  {f.value_text ?? f.value_num}
                </SourceQuote>
              </div>
              <blockquote
                lang="it"
                className="mt-6 border-l-2 border-foreground pl-4 text-sm leading-relaxed"
              >
                “{f.quote}”
              </blockquote>
              {f.quote_en && (
                <p className="mt-2 pl-4 text-sm text-muted-foreground">{f.quote_en}</p>
              )}
            </>
          ) : (
            <>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Example · Offer deadline
              </p>
              <p className="mt-3 text-3xl font-semibold">17 July 2026</p>
              <blockquote
                lang="it"
                className="mt-6 border-l-2 border-foreground pl-4 text-sm leading-relaxed"
              >
                “Le offerte dovranno pervenire entro e non oltre le ore 12:00 del 17 luglio 2026.”
              </blockquote>
              <p className="mt-2 pl-4 text-sm text-muted-foreground">
                Offers must arrive no later than 12:00 on 17 July 2026.
              </p>
              <p className="mt-6 text-xs text-muted-foreground">
                Illustrative example of how a sourced fact appears.
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function Audiences() {
  return (
    <section className="bg-muted/40 py-20">
      <div className="mx-auto max-w-6xl px-5">
        <h2 className="text-3xl md:text-4xl">Who it's for</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {AUDIENCES.map((a) => (
            <div key={a.title} className="rounded-2xl border bg-card p-6">
              <h3 className="text-lg font-semibold">{a.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{a.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section className="mx-auto max-w-3xl px-5 py-20">
      <h2 className="text-3xl md:text-4xl">Questions</h2>
      <Accordion type="single" collapsible className="mt-8">
        {FAQ.map((f) => (
          <AccordionItem key={f.q} value={f.q}>
            <AccordionTrigger className="text-left text-base">{f.q}</AccordionTrigger>
            <AccordionContent className="leading-relaxed text-muted-foreground">
              {f.a}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}

function SignUp() {
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
    <section className="px-3 pb-16 md:px-4">
      <div className="mx-auto max-w-6xl rounded-3xl bg-foreground px-6 py-16 text-center text-background md:px-12">
        <h2 className="text-3xl md:text-5xl">Find your house in Italy.</h2>
        <p className="mx-auto mt-4 max-w-xl text-background/75">
          Free to explore. Sign in with your email, no password needed.
        </p>
        {state === "sent" ? (
          <p className="mt-8 inline-flex items-center gap-2 text-lg">
            <MailCheck className="h-5 w-5" /> Check your inbox for the sign-in link.
          </p>
        ) : (
          <form onSubmit={submit} className="mx-auto mt-8 flex max-w-md flex-col gap-3 sm:flex-row">
            <Input
              type="email"
              required
              autoComplete="email"
              aria-label="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="h-11 border-background/20 bg-background text-foreground"
            />
            <Button type="submit" size="lg" variant="secondary" disabled={state === "busy"}>
              {state === "busy" ? "Sending" : "Get started"}
            </Button>
          </form>
        )}
        {error && <p className="mt-3 text-sm text-background/80">{error}</p>}
      </div>
    </section>
  );
}
