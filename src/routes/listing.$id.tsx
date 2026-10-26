import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import {
  ClientOnly, createFileRoute, Link, useNavigate, useRouter, type ErrorComponentProps,
} from "@tanstack/react-router";
import {
  AlertTriangle, ArrowLeft, ExternalLink, FileText, Lock, MapPin, MessageCircle, Sparkles,
} from "lucide-react";
import { lazy, Suspense, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { AgentChatButton } from "@/components/odys/AgentChat";
import { GenerateRender } from "@/components/odys/GenerateRender";
import { CardImage, SaveButton } from "@/components/odys/ListingCard";
import {
  DeadlinePill, formatEur, IllustrationLabel, LEGAL_LINE, Money, NotStated, ScoreBadge, SourceQuote, Wordmark,
} from "@/components/odys/primitives";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { renderUrl, SALE_TYPE_LABELS, TYPE_LABELS } from "@/lib/feed";
import {
  factValue, grantDeduction, listingQuery, orderImages, pickEstimates, startDeal, UpgradeRequired,
  type CostEstimate, type Fact, type ListingBundle,
} from "@/lib/listing";
import { cn } from "@/lib/utils";

const ListingMap = lazy(() => import("@/components/odys/ListingMap"));

export const Route = createFileRoute("/listing/$id")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(listingQuery(params.id)),
  head: ({ loaderData }) => {
    const l = loaderData?.listing;
    if (!l) return { meta: [{ title: "Listing unavailable | Odysstay" }, { name: "robots", content: "noindex" }] };
    const title = [l.comune, l.property_type ? TYPE_LABELS[l.property_type] ?? l.property_type : null, l.price_eur != null ? formatEur(l.price_eur) : null]
      .filter(Boolean).join(", ") + " | Odysstay";
    const desc = l.summary_en ?? "An Italian property from an official public notice, explained in English.";
    return {
      meta: [
        { title }, { name: "description", content: desc },
        { property: "og:title", content: title }, { property: "og:description", content: desc },
        { property: "og:type", content: "article" }, { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: ListingPage,
  errorComponent: ListingError,
  notFoundComponent: () => (
    <Shell>
      <div className="py-24 text-center">
        <h1 className="text-4xl">Listing not found</h1>
        <p className="mt-3 text-muted-foreground">It may have been withdrawn or the link is wrong.</p>
        <Button asChild className="mt-8"><Link to="/discover">Back to Discover</Link></Button>
      </div>
    </Shell>
  ),
});

function ListingError({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  return (
    <Shell>
      <div className="py-24 text-center">
        <h1 className="text-3xl">This listing didn't load</h1>
        <p className="mt-3 text-muted-foreground">{error instanceof Error ? error.message : "Please try again."}</p>
        <Button className="mt-8" onClick={() => { router.invalidate(); reset(); }}>Try again</Button>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link to="/"><Wordmark className="text-xl" /></Link>
          <Button asChild variant="ghost" size="sm"><Link to="/discover"><ArrowLeft /> Discover</Link></Button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 pb-16">{children}</main>
      <footer className="mx-auto max-w-6xl border-t px-5 py-8 text-xs text-muted-foreground">{LEGAL_LINE}</footer>
    </div>
  );
}

function Section({ title, kicker, children, id }: { title: string; kicker?: string; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="border-t py-10">
      {kicker && <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{kicker}</p>}
      <h2 className="mb-6 text-2xl md:text-3xl">{title}</h2>
      {children}
    </section>
  );
}

function FactValue({ fact, sourceUrl }: { fact: Fact | undefined; sourceUrl: string | null }) {
  const v = factValue(fact);
  if (!fact || !v) return <NotStated />;
  return (
    <SourceQuote quote={fact.quote} quoteEn={fact.quote_en} page={fact.page} sourceUrl={sourceUrl}>
      {v}
    </SourceQuote>
  );
}

function useUserId() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null,
  }).data ?? null;
}

function ListingPage() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(listingQuery(id));
  const { listing: l, facts, flags } = data;
  const userId = useUserId();
  const byKey = Object.fromEntries(facts.map((f) => [f.key, f])) as Record<string, Fact | undefined>;
  const src = l.source_url;

  return (
    <Shell>
      <Identity data={data} />
      <Gallery data={data} userId={userId} />

      <div className="grid gap-12 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0">
          <Section title="Key numbers">
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border bg-border md:grid-cols-3">
              {[
                ["Base price", <FactValue key="p" fact={byKey["price_eur"]} sourceUrl={src} />],
                ["Surface", <FactValue key="s" fact={byKey["surface_sqm"]} sourceUrl={src} />],
                ["Price per m²", <PricePerSqm key="m" facts={byKey} />],
                ["Deposit", <FactValue key="d" fact={byKey["deposit_eur"]} sourceUrl={src} />],
                ["Deadline", <FactValue key="dl" fact={byKey["deadline"]} sourceUrl={src} />],
              ].map(([label, node]) => (
                <div key={label as string} className={cn("bg-card p-5", label === "Deadline" && "col-span-2")}>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
                  <dd className="mt-2 text-lg font-semibold tnum">{node}</dd>
                </div>
              ))}
            </dl>
          </Section>

          <Section title="In plain English">
            {l.summary_en ? <p className="max-w-2xl text-lg leading-relaxed">{l.summary_en}</p> : <NotStated />}
          </Section>

          <Section title="Every fact in the notice" kicker="Quoted from the official notice">
            {facts.length ? (
              <dl className="divide-y rounded-2xl border bg-card">
                {facts.map((f) => (
                  <div key={f.id} className="grid gap-1 p-4 sm:grid-cols-[220px_1fr] sm:gap-6">
                    <dt className="text-sm text-muted-foreground">{f.label_en}</dt>
                    <dd className="font-medium"><FactValue fact={f} sourceUrl={src} /></dd>
                  </div>
                ))}
              </dl>
            ) : <NotStated />}
            <p className="mt-3 text-sm text-muted-foreground">
              Every fact above is quoted word for word from the official notice. Tap "Source" to see the Italian original.
            </p>
          </Section>

          <Section title="Red flags">
            {flags.length ? (
              <ul className="space-y-3">
                {flags.map((f) => (
                  <li key={f.id} className="flex gap-4 rounded-2xl border bg-card p-5">
                    <AlertTriangle className={cn("mt-0.5 h-5 w-5 shrink-0", f.severity === "low" ? "text-caution" : "text-warning")} />
                    <div className="min-w-0">
                      <span className={cn("mb-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
                        f.severity === "high" ? "bg-warning text-background" : f.severity === "medium" ? "bg-warning-soft text-warning" : "bg-caution-soft text-caution")}>
                        {f.severity}
                      </span>
                      <div className="font-medium">
                        <SourceQuote quote={f.quote} quoteEn={f.quote_en} sourceUrl={src}>{f.flag_en}</SourceQuote>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="max-w-2xl rounded-2xl border bg-card p-5 text-muted-foreground">
                No red flags were found in the notice. That does not mean there are none: a site visit with a surveyor is still essential.
              </p>
            )}
          </Section>

          <CostSection data={data} userId={userId} />
          <HowBuying saleType={l.sale_type} />

          <Section title="Location">
            <p className="mb-4 flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4" />
              {l.address ?? <NotStated />}
            </p>
            {l.lat != null && l.lng != null ? (
              <div className="h-80 overflow-hidden rounded-2xl border">
                <ClientOnly fallback={<div className="h-full animate-pulse bg-muted" />}>
                  <Suspense fallback={<div className="h-full animate-pulse bg-muted" />}>
                    <ListingMap lat={l.lat} lng={l.lng} />
                  </Suspense>
                </ClientOnly>
              </div>
            ) : <p className="text-sm text-muted-foreground">No coordinates in the notice.</p>}
          </Section>

          <Section title="Original notice">
            {src ? (
              <a href={src} target="_blank" rel="noreferrer" className="flex items-center gap-4 rounded-2xl border bg-card p-5 transition-shadow hover:shadow-hover">
                <FileText className="h-6 w-6 shrink-0 text-brand" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{l.source_title ?? "Official notice"}</p>
                  <p className="text-sm text-muted-foreground">
                    {l.source_published_at ? `Published ${new Date(l.source_published_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}` : "Publication date not stated"}
                  </p>
                </div>
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
              </a>
            ) : <NotStated />}
          </Section>
        </div>

        <aside className="lg:pt-10">
          <div className="lg:sticky lg:top-24"><ActionCard data={data} userId={userId} /></div>
        </aside>
      </div>
    </Shell>
  );
}

function PricePerSqm({ facts }: { facts: Record<string, Fact | undefined> }) {
  const p = facts["price_eur"]?.value_num;
  const s = facts["surface_sqm"]?.value_num;
  if (p == null || !s || p <= 1) return <NotStated />;
  return (
    <span>
      {formatEur(Math.round(p / s))}
      <span className="mt-1 block text-xs font-normal text-muted-foreground">Price ÷ surface, both quoted</span>
    </span>
  );
}

function Identity({ data }: { data: ListingBundle }) {
  const l = data.listing;
  return (
    <div className="flex flex-wrap items-end justify-between gap-6 pb-8 pt-10">
      <div className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {l.is_demo && <span className="rounded-full bg-foreground px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-background">Demo</span>}
          <DeadlinePill deadline={l.deadline_at} />
          {l.property_type && <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">{TYPE_LABELS[l.property_type] ?? l.property_type}</span>}
          {l.sale_type && <span className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand">{SALE_TYPE_LABELS[l.sale_type] ?? l.sale_type}</span>}
        </div>
        <h1 className="text-5xl md:text-6xl">{l.comune ?? "Unknown comune"}</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          {[l.province, l.region].filter(Boolean).join(" · ") || "Location not stated"}
        </p>
        {l.title_en && <p className="mt-4 max-w-2xl text-lg">{l.title_en}</p>}
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Deal score</p>
          <p className="text-sm text-muted-foreground">Tap for reasons</p>
        </div>
        <ScoreBadge score={l.score} reasons={l.score_reasons} />
      </div>
    </div>
  );
}

function Gallery({ data, userId }: { data: ListingBundle; userId: string | null }) {
  const id = data.listing.id!;
  const { data: images = [] } = useQuery({
    queryKey: ["listing-images", id, userId],
    queryFn: async () => {
      const { data, error } = await supabase.from("listing_images").select("*").eq("listing_id", id).neq("kind", "map");
      if (error) throw error;
      return orderImages(data);
    },
  });
  const [active, setActive] = useState(0);
  const img = images[active];
  return (
    <div>
      <div className="relative overflow-hidden rounded-3xl">
        {img ? (
          <div className="relative aspect-[16/9] bg-muted">
            <img src={renderUrl(img.storage_path) ?? ""} alt={img.caption_en ?? "Property image"} className="h-full w-full object-cover" />
            {img.kind === "render" && <IllustrationLabel className="bottom-4 left-4" />}
          </div>
        ) : (
          <div className="[&>div]:aspect-[16/9] md:[&>div]:aspect-[21/9]"><CardImage row={data.listing} /></div>
        )}
        <div className="absolute right-4 top-4">
          {data.listing.id && (
            <GenerateRender
              listingId={data.listing.id}
              signedIn={!!userId}
              hasOriginal={images.some((i) => i.kind === "original")}
              onCreated={() => setActive(0)}
            />
          )}
        </div>
      </div>
      {images.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {images.map((im, i) => (
            <button key={im.id} onClick={() => setActive(i)}
              className={cn("relative h-16 w-24 shrink-0 overflow-hidden rounded-xl ring-2", i === active ? "ring-foreground" : "ring-transparent")}>
              <img src={renderUrl(im.storage_path) ?? ""} alt="" className="h-full w-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      )}
      {img?.caption_en && <p className="mt-2 text-sm text-muted-foreground">{img.caption_en}</p>}
    </div>
  );
}

type Item = { item_en: string; low_eur: number; high_eur: number };
const asItems = (j: unknown): Item[] => (Array.isArray(j) ? (j as Item[]).filter((x) => x && typeof x.item_en === "string") : []);
const asStrings = (j: unknown): string[] => (Array.isArray(j) ? j.filter((x): x is string => typeof x === "string") : []);
const range = (lo: number, hi: number) => `${formatEur(lo)} to ${formatEur(hi)}`;

function CostSection({ data, userId }: { data: ListingBundle; userId: string | null }) {
  const l = data.listing;
  const { data: estimates = [], isLoading } = useQuery({
    queryKey: ["estimates", l.id, userId],
    queryFn: async () => {
      const { data, error } = await supabase.from("cost_estimates").select("*").eq("listing_id", l.id!);
      if (error) throw error;
      return pickEstimates(data, userId);
    },
  });
  const [scenario, setScenario] = useState("standard");
  const sel: CostEstimate | undefined = estimates.find((e) => e.scenario === scenario) ?? estimates[0];
  const price = l.price_eur;

  return (
    <>
      <Section title="Renovation" kicker="Estimated ranges">
        {isLoading ? <div className="h-40 animate-pulse rounded-2xl bg-muted" /> : !estimates.length ? (
          <p className="text-muted-foreground">No estimate yet</p>
        ) : (
          <>
            <div className="mb-5 inline-flex rounded-full border bg-card p-1">
              {estimates.map((e) => (
                <button key={e.id} onClick={() => setScenario(e.scenario)}
                  className={cn("rounded-full px-4 py-1.5 text-sm font-medium capitalize transition-colors",
                    sel?.id === e.id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>
                  {e.scenario}
                </button>
              ))}
            </div>
            {sel && (
              <div className="rounded-2xl border bg-card p-6">
                <p className="text-3xl font-semibold tnum">{range(sel.low_eur, sel.high_eur)}</p>
                {sel.user_id && <p className="mt-1 text-xs text-brand">Your own estimate</p>}
                <ul className="mt-5 divide-y">
                  {asItems(sel.items).map((it) => (
                    <li key={it.item_en} className="flex justify-between gap-4 py-2.5 text-sm">
                      <span>{it.item_en}</span>
                      <span className="shrink-0 text-muted-foreground tnum">{range(it.low_eur, it.high_eur)}</span>
                    </li>
                  ))}
                </ul>
                {asStrings(sel.assumptions).length > 0 && (
                  <div className="mt-5">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Assumptions</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                      {asStrings(sel.assumptions).map((a) => <li key={a}>{a}</li>)}
                    </ul>
                  </div>
                )}
                {sel.price_list && (
                  <p className="mt-4 text-sm text-muted-foreground">
                    Based on: {sel.price_list_url ? <a href={sel.price_list_url} target="_blank" rel="noreferrer" className="text-brand hover:underline">{sel.price_list}</a> : sel.price_list}
                  </p>
                )}
              </div>
            )}
            <p className="mt-3 text-sm text-muted-foreground">Ranges, not quotes. Real costs depend on a survey.</p>
          </>
        )}
      </Section>

      <Section title="Total cost picture">
        <div className="rounded-2xl border bg-card p-6">
          <Row label="Base price">{price != null ? <Money value={price} /> : <NotStated />}</Row>
          <Row label={`Renovation, ${sel?.scenario ?? "none"}`}>{sel ? <span className="tnum">{range(sel.low_eur, sel.high_eur)}</span> : <span className="text-muted-foreground">No estimate yet</span>}</Row>
          <div className="my-3 border-t" />
          <Row label="Total" strong>
            {price != null && sel ? <span className="tnum">{range(price + sel.low_eur, price + sel.high_eur)}</span> : <span className="text-sm font-normal text-muted-foreground">Needs a price and an estimate</span>}
          </Row>
        </div>

        {data.grants.length > 0 && (
          <div className="mt-6 space-y-4">
            <h3 className="text-lg">Grants that may apply</h3>
            {data.grants.map((lg) => {
              const g = lg.grants;
              if (!g) return null;
              const dLo = sel ? grantDeduction(g, sel.low_eur) : null;
              const dHi = sel ? grantDeduction(g, sel.high_eur) : null;
              return (
                <div key={g.id} className="rounded-2xl border bg-card p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <p className="font-semibold">{g.name}</p>
                    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", lg.fit === "likely" ? "bg-success-soft text-success" : "bg-caution-soft text-caution")}>
                      {lg.fit === "likely" ? "Likely fit" : "Possible fit"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm">{g.summary_en}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{lg.reason_en}</p>
                  {g.max_eur != null && <p className="mt-3 text-sm">Up to <Money value={g.max_eur} showOneEuroChip={false} />{g.pct != null && ` · ${g.pct}% of eligible works`}</p>}
                  {g.conditions_en && <p className="mt-2 text-sm text-muted-foreground">Conditions: {g.conditions_en}</p>}
                  <p className="mt-3 text-xs text-muted-foreground">
                    <a href={g.source_url} target="_blank" rel="noreferrer" className="text-brand hover:underline">Official source</a>
                    {" · "}Checked {new Date(g.checked_at).toLocaleDateString("en-GB")}
                  </p>
                  {price != null && sel && dLo != null && dHi != null && (
                    <div className="mt-4 rounded-xl bg-muted p-4 text-sm">
                      <p className="font-medium">Total after grant, if approved</p>
                      <p className="mt-1 text-lg font-semibold tnum">{range(price + sel.low_eur - dLo, price + sel.high_eur - dHi)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Conditional. Only applies if the grant is approved for you.</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <p className="mt-4 text-sm text-muted-foreground">Taxes and notary fees: ask the agent, they depend on your situation.</p>
      </Section>
    </>
  );
}

function Row({ label, children, strong }: { label: string; children: ReactNode; strong?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between gap-4 py-1.5", strong && "text-lg font-semibold")}>
      <span className={cn(!strong && "text-muted-foreground")}>{label}</span>
      <span>{children}</span>
    </div>
  );
}

const STEPS: Record<string, string[]> = {
  sale: [
    "Read the full notice carefully.",
    "Inspect the property with a surveyor.",
    "Pay the deposit as the notice requires.",
    "Submit your offer by the method and deadline stated in the notice.",
    "The public body announces the award.",
    "Sign the deed (rogito) at a notary.",
  ],
  one_euro: [
    "Apply to the comune's call for applications.",
    "Sign the renovation commitment.",
    "Provide the guarantee the comune asks for.",
    "Sign the deed at a notary.",
    "Complete the works within the time stated in the call.",
  ],
};

function HowBuying({ saleType }: { saleType: string | null }) {
  const t = saleType ?? "sale";
  const isUse = t === "concession" || t === "lease";
  const steps = STEPS[t === "one_euro" ? "one_euro" : "sale"]!;
  return (
    <Section title="How buying works">
      {isUse ? (
        <p className="max-w-2xl rounded-2xl border bg-card p-6">
          This is a {t === "lease" ? "lease" : "concession"}. It grants you the right to use the property for a period, not ownership. You do not buy it.
        </p>
      ) : (
        <ol className="space-y-3">
          {steps.map((s, i) => (
            <li key={s} className="flex gap-4">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background">{i + 1}</span>
              <span className="pt-0.5">{s}</span>
            </li>
          ))}
        </ol>
      )}
      <p className="mt-4 text-sm text-muted-foreground">General guide only. The notice sets the exact rules and dates.</p>
    </Section>
  );
}

function ActionCard({ data, userId }: { data: ListingBundle; userId: string | null }) {
  const l = data.listing;
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [upgrade, setUpgrade] = useState(false);
  const { data: deal, refetch } = useQuery({
    queryKey: ["deal-for", l.id, userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("deals").select("id").eq("listing_id", l.id!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const here = `/listing/${l.id}`;

  async function onStart() {
    if (!userId) {
      navigate({ to: "/login", search: { redirect: here } });
      return;
    }
    setBusy(true);
    try {
      const dealId = await startDeal(l);
      navigate({ to: "/deals/$id", params: { id: dealId } });
    } catch (e) {
      if (e instanceof UpgradeRequired) setUpgrade(true);
      else {
        toast.error("Could not start the deal. Please try again.");
        refetch();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-3xl border bg-card p-6 shadow-hover">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Base price</p>
      <div className="mt-1 flex items-center justify-between">
        <Money value={l.price_eur} className="text-3xl font-semibold" />
        {l.id && <SaveButton id={l.id} />}
      </div>
      <div className="mt-2"><DeadlinePill deadline={l.deadline_at} /></div>

      <div className="mt-6 space-y-2">
        {deal ? (
          <Button asChild size="lg" className="w-full"><Link to="/deals/$id" params={{ id: deal.id }}>Open your deal</Link></Button>
        ) : (
          <Button size="lg" className="w-full" onClick={onStart} disabled={busy}>
            {!userId && <Lock />} {busy ? "Starting" : userId ? "Start a deal" : "Sign in to start a deal"}
          </Button>
        )}
        {l.id && (
          <AgentChatButton listingId={l.id} dealId={deal?.id ?? null} signedIn={!!userId} className="h-auto w-full whitespace-normal py-2.5">
            <MessageCircle /> Ask the agent about this property
          </AgentChatButton>
        )}
      </div>

      {upgrade && (
        <div className="mt-4 rounded-2xl bg-caution-soft p-4 text-sm text-caution">
          <p className="font-semibold">You already have an active deal</p>
          <p className="mt-1">The free plan includes one active deal at a time. Upgrade to Pro to work on several, or close your current deal first.</p>
          <div className="mt-2 flex gap-4">
            <Link to="/deals" className="font-medium underline">See your deals</Link>
            <Link to="/pricing" className="font-medium underline">See plans</Link>
          </div>
        </div>
      )}

      <p className="mt-6 text-xs leading-relaxed text-muted-foreground">{LEGAL_LINE}</p>
    </div>
  );
}
