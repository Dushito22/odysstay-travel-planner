import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import {
  ClientOnly, createFileRoute, Link, useNavigate, useRouter, type ErrorComponentProps,
} from "@tanstack/react-router";
import {
  AlertTriangle, ArrowLeft, ExternalLink, FileText, Lock, Mail, MapPin, MessageCircle, Phone,
} from "lucide-react";
import { lazy, Suspense, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { AgentChatButton } from "@/components/odys/AgentChat";
import { GenerateRender } from "@/components/odys/GenerateRender";
import { Description } from "@/components/odys/Description";
import { Nearby } from "@/components/odys/Nearby";
import { CardImage, SaveButton } from "@/components/odys/ListingCard";
import {
  DeadlinePill, formatEur, IllustrationLabel, LEGAL_LINE, Money, NotStated, ScoreBadge, SourceQuote, Wordmark,
} from "@/components/odys/primitives";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { photoUrls, renderUrl, SALE_TYPE_LABELS, TYPE_LABELS } from "@/lib/feed";
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

function RedFlags({ data }: { data: ListingBundle }) {
  const { listing: l, flags, deep } = data;
  const court = l.sale_type === "auction_judicial";
  const status = deep?.status ?? null;
  const fromReport = flags.some((f) => f.origin === "rules");
  return (
    <Section title="Red flags" {...(fromReport ? { kicker: "Found in the court appraisal report" } : {})}>
      {flags.length > 0 && (
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
                  <SourceQuote quote={f.quote} quoteEn={f.quote_en} page={f.page} sourceUrl={f.doc_url ?? l.source_url}
                    docLabel={f.doc_url ? "Appraisal report" : "Official notice"}>
                    {f.flag_en}
                  </SourceQuote>
                </div>
                {f.origin === "rules" && (
                  <p className="mt-2 text-sm text-muted-foreground" lang="it">
                    {f.page ? `Page ${f.page}: ` : ""}"{f.quote.length > 220 ? f.quote.slice(0, 220) + "..." : f.quote}"
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <DeepDiveNote court={court} status={status} pages={deep?.pages ?? null} hasFlags={flags.length > 0} listingId={l.id!} />
    </Section>
  );
}

function DeepDiveNote({ court, status, pages, hasFlags, listingId }: {
  court: boolean; status: string | null; pages: number | null; hasFlags: boolean; listingId: string;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const request = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("signin");
      const { error } = await supabase.from("deep_dives").insert({ listing_id: listingId });
      if (error && error.code !== "23505") throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["listing", listingId] });
      toast("We are reading the court report. Usually ready within the hour.");
    },
    onError: (e) => {
      if (e instanceof Error && e.message === "signin") navigate({ to: "/login", search: { redirect: window.location.pathname } });
      else toast.error("Could not start the check. Please try again.");
    },
  });
  const pagesText = pages ? `${pages} pages` : "all pages";
  let title: string | null = null;
  let text: string | null = null;
  let action = false;
  if (!court) {
    if (!hasFlags) { title = "No red flags found in the notice"; text = "A site visit with a surveyor is still essential before you commit."; }
  } else if (status === "pending" || status === "running") {
    title = "Reading the court appraisal report";
    text = "We check every page for unpermitted building work, land registry mismatches, unpaid fees, occupancy, damage and missing certificates. Usually ready within the hour.";
  } else if (status === "done") {
    if (hasFlags) text = `Found by reading ${pagesText} of the appraisal report. Each point quotes the report word for word. Tap Source, then Translate, and check every one with a surveyor before bidding.`;
    else { title = "No red flags found"; text = `We read ${pagesText} of the appraisal report and found none of the usual warning signs. Still worth a surveyor's visit before bidding.`; }
  } else if (status === "no_text") {
    title = "The report could not be read"; text = "The appraisal report is a poor scan. Open it under Official documents.";
  } else if (status === "no_document") {
    title = "No appraisal report published"; text = "The court has not published an appraisal report for this sale yet. Ask the sale delegate for it.";
  } else if (status === "error") {
    title = "We could not open the report"; text = "Try the link under Official documents."; action = true;
  } else {
    title = hasFlags ? null : "No red flags in the listing data";
    text = "The real problems are in the court's appraisal report. We can read all of it for you: unpermitted building work, unpaid fees, occupancy, damage and missing certificates, each quoted from the report. Free, usually within the hour.";
    action = true;
  }
  if (!text && !title) return null;
  return (
    <div className={cn("glass max-w-2xl rounded-2xl p-5", hasFlags && "mt-4")}>
      {title && <p className="font-semibold">{title}</p>}
      {text && <p className={cn("text-muted-foreground", title && "mt-1")}>{text}</p>}
      {action && court && (
        <Button className="mt-4" onClick={() => request.mutate()} disabled={request.isPending}>
          {request.isPending ? "Starting..." : "Read the court report"}
        </Button>
      )}
    </div>
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
              {([
                ["Base price", <FactValue key="p" fact={byKey["price_eur"]} sourceUrl={src} />],
                byKey["min_offer_eur"] ? ["Minimum offer", <FactValue key="mo" fact={byKey["min_offer_eur"]} sourceUrl={src} />] : null,
                byKey["appraisal_eur"] ? ["Court appraisal", <Appraisal key="a" fact={byKey["appraisal_eur"]} discount={l.discount_pct} sourceUrl={src} />] : null,
                ["Surface", <FactValue key="s" fact={byKey["surface_sqm"] ?? byKey["perizia_surface_sqm"] ?? byKey["land_sqm"]} sourceUrl={src} />],
                byKey["condition"] ? ["Condition", <FactValue key="c" fact={byKey["condition"]} sourceUrl={src} />] : null,
                ["Price per m²", <PricePerSqm key="m" facts={byKey} />],
                ["Deposit", <FactValue key="d" fact={byKey["deposit_eur"] ?? byKey["deposit"]} sourceUrl={src} />],
                byKey["auction_date"] ? ["Sale date", <FactValue key="sd" fact={byKey["auction_date"]} sourceUrl={src} />] : null,
                ["Offer deadline", <FactValue key="dl" fact={byKey["deadline"]} sourceUrl={src} />],
              ].filter(Boolean) as [string, ReactNode][]).map(([label, node], i, all) => (
                <div key={label} className={cn("bg-card p-5", fillClass(i, all.length))}>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
                  <dd className="mt-2 text-lg font-semibold tnum">{node}</dd>
                </div>
              ))}
            </dl>
          </Section>

          <Section title="Location and what is nearby">
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
            {l.lat != null && l.lng != null && (
              <ClientOnly fallback={null}>
                <Nearby lat={l.lat} lng={l.lng} comune={l.comune} />
              </ClientOnly>
            )}
          </Section>

          <Section title="In plain words">
            {l.summary_en ? <p className="max-w-2xl text-lg leading-relaxed">{l.summary_en}</p> : <NotStated />}
            {byKey["description"] && (
              <div className="mt-5">
                <Description listingId={l.id!} italian={byKey["description"].quote ?? byKey["description"].value_text ?? ""} signedIn={!!userId} />
              </div>
            )}
          </Section>

          <Section title="Every fact in the notice" kicker="Quoted from the official notice">
            {facts.length ? (
              <dl className="divide-y rounded-2xl border bg-card">
                {facts.filter((f) => f.key !== "description").map((f) => (
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

          <RedFlags data={data} />

          <CostSection data={data} userId={userId} />
          <OfficialDocuments data={data} />
          <SaleContacts data={data} />
          <HowBuying saleType={l.sale_type} />


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

/** Stretch the last cell so the grid has no empty slots (2 columns on mobile, 3 from md). */
function fillClass(i: number, n: number) {
  if (i !== n - 1) return "";
  const mobile = n % 2 === 1 ? "col-span-2" : "";
  const desk = { 0: "", 1: "md:col-span-3", 2: "md:col-span-2" }[n % 3 as 0 | 1 | 2];
  return cn(mobile, desk, mobile && !desk && "md:col-span-1");
}

function Appraisal({ fact, discount, sourceUrl }: { fact: Fact | undefined; discount: number | null; sourceUrl: string | null }) {
  return (
    <span>
      <FactValue fact={fact} sourceUrl={sourceUrl} />
      {discount != null && discount > 0 && (
        <span className="mt-1 block text-xs font-medium text-success">Minimum offer is {discount}% below it</span>
      )}
    </span>
  );
}

type Attachment = { kind: string; name: string; url: string };
type Contact = { role: string; name: string | null; email: string | null; phone: string | null; handles_visits?: boolean };
const asAttachments = (j: unknown): Attachment[] =>
  Array.isArray(j) ? (j as Attachment[]).filter((a) => a && typeof a.url === "string" && /^https:\/\//.test(a.url)) : [];
const asContacts = (j: unknown): Contact[] => (Array.isArray(j) ? (j as Contact[]).filter((c) => c && typeof c.role === "string") : []);
const DOC_LABEL: Record<string, string> = {
  appraisal: "Appraisal report (perizia)", sale_notice: "Sale notice (avviso di vendita)", court_order: "Court order", other: "Other document",
};
const DOC_ORDER = ["appraisal", "sale_notice", "court_order", "other"];

function OfficialDocuments({ data }: { data: ListingBundle }) {
  const docs = asAttachments(data.listing.attachments)
    .sort((a, b) => DOC_ORDER.indexOf(a.kind) - DOC_ORDER.indexOf(b.kind));
  if (!docs.length) return null;
  return (
    <Section title="Official documents" kicker="Filed with the court">
      <ul className="divide-y rounded-2xl border bg-card">
        {docs.map((d) => (
          <li key={d.url}>
            <a href={d.url} target="_blank" rel="noreferrer" className="flex items-center gap-4 p-4 hover:bg-muted/50">
              <FileText className="h-5 w-5 shrink-0 text-brand" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{DOC_LABEL[d.kind] ?? "Document"}</p>
                <p className="truncate text-sm text-muted-foreground">{d.name}</p>
              </div>
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm text-muted-foreground">
        The appraisal report is the most important read: it describes the condition, legal issues, building irregularities and occupancy in detail. In Italian.
      </p>
    </Section>
  );
}

function SaleContacts({ data }: { data: ListingBundle }) {
  const l = data.listing;
  const people = asContacts(l.contacts);
  if (!people.length && !l.court) return null;
  return (
    <Section title="Who runs the sale">
      {l.court && (
        <p className="mb-4 text-muted-foreground">
          {l.court}{l.case_ref ? `, ${l.case_ref}` : ""}{l.sale_mode ? `. Bidding: ${l.sale_mode}` : ""}
        </p>
      )}
      {people.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {people.map((c, i) => (
            <li key={i} className="rounded-2xl border bg-card p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{c.role}</p>
              {c.name && <p className="mt-1 font-semibold">{c.name}</p>}
              <div className="mt-3 space-y-1.5 text-sm">
                {c.email && <a href={`mailto:${c.email}`} className="flex items-center gap-2 text-brand hover:underline"><Mail className="h-4 w-4" />{c.email}</a>}
                {c.phone && <a href={`tel:${c.phone}`} className="flex items-center gap-2 text-brand hover:underline"><Phone className="h-4 w-4" />{c.phone}</a>}
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-sm text-muted-foreground">
        As published on the court portal. Viewings of court-sale properties are requested through the portal itself, using the "Prenota visita" button on the official page.
      </p>
    </Section>
  );
}

function PricePerSqm({ facts }: { facts: Record<string, Fact | undefined> }) {
  const p = facts["price_eur"]?.value_num;
  const s = facts["surface_sqm"]?.value_num ?? facts["perizia_surface_sqm"]?.value_num;
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
          {l.is_demo && <span className="rounded-full bg-sea px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">Demo</span>}
          <DeadlinePill deadline={l.deadline_at ?? l.auction_at} />
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
  const official = photoUrls(data.listing).map((url, i) => ({
    id: `official-${i}`, kind: "original", storage_path: url, caption_en: "Official photo from the court listing",
  }));
  const all = [...images.filter((i) => i.kind === "render"), ...(official.length ? official : images.filter((i) => i.kind !== "render"))];
  const [active, setActive] = useState(0);
  const img = all[active];
  return (
    <div>
      <div className="relative overflow-hidden rounded-3xl">
        {img ? (
          <div className="relative aspect-[16/9] bg-muted">
            <img src={renderUrl(img.storage_path) ?? ""} alt={img.caption_en ?? "Property image"} referrerPolicy="no-referrer" className="h-full w-full object-cover" />
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
              hasOriginal={all.some((i) => i.kind === "original")}
              photo={img?.id.startsWith("official-") ? img.storage_path : undefined}
              onCreated={() => setActive(0)}
            />
          )}
        </div>
      </div>
      {all.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {all.map((im, i) => (
            <button key={im.id} onClick={() => setActive(i)}
              className={cn("relative h-16 w-24 shrink-0 overflow-hidden rounded-xl ring-2", i === active ? "ring-foreground" : "ring-transparent")}>
              <img src={renderUrl(im.storage_path) ?? ""} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" loading="lazy" />
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
  const condition = data.facts.find((f) => f.key === "condition")?.value_text ?? "";
  const [scenario, setScenario] = useState(
    condition.startsWith("Good") ? "light" : condition.startsWith("Poor") || condition.startsWith("Derelict") ? "full" : "standard",
  );
  const sel: CostEstimate | undefined = estimates.find((e) => e.scenario === scenario) ?? estimates[0];
  const price = l.min_offer_eur ?? l.price_eur;
  const priceLabel = l.min_offer_eur != null ? "Minimum offer" : "Base price";

  return (
    <>
      <Section title="Renovation" kicker="Estimated ranges">
        {isLoading ? <div className="h-40 animate-pulse rounded-2xl bg-muted" /> : !estimates.length ? (
          <p className="max-w-2xl rounded-2xl border bg-card p-5 text-muted-foreground">
            {l.property_type === "land" || l.property_type === "garage"
              ? "No renovation estimate for this type of property."
              : "No estimate yet: the notice doesn't state the surface. It is added automatically once the surface is known, for court sales from the appraisal report."}
          </p>
        ) : (
          <>
            <div className="mb-5 inline-flex rounded-full border bg-card p-1">
              {estimates.map((e) => (
                <button key={e.id} onClick={() => setScenario(e.scenario)}
                  className={cn("rounded-full px-4 py-1.5 text-sm font-medium capitalize transition-colors",
                    sel?.id === e.id ? "bg-sea text-white" : "text-muted-foreground hover:text-foreground")}>
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
          <Row label={priceLabel}>{price != null ? <Money value={price} /> : <NotStated />}</Row>
          <Row label={sel ? `Renovation, ${sel.scenario}` : "Renovation"}>{sel ? <span className="tnum">{range(sel.low_eur, sel.high_eur)}</span> : <span className="text-muted-foreground">No estimate yet</span>}</Row>
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
        {l.min_offer_eur != null && (
          <p className="mt-4 text-sm text-muted-foreground">
            Uses the minimum offer. If other people bid, the price goes up from there in steps of the minimum raise.
          </p>
        )}
        <p className="mt-2 text-sm text-muted-foreground">Purchase taxes: ask the agent, they depend on your situation.</p>
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
  auction_judicial: [
    "Read the appraisal report (perizia) and the sale notice. They list the condition, legal issues and exact rules.",
    "Book a free viewing through the court portal, with the \"Prenota visita\" button on the official page.",
    "Before the deadline, file your offer with the deposit, exactly as the sale notice describes. Online sales use the Ministry's online offer form.",
    "On the sale date, if there are several offers, bidding starts from the highest one.",
    "If you win, pay the balance within the period set in the notice.",
    "The court issues the transfer decree. Mortgages and liens on the property are cancelled.",
  ],
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
  const steps = STEPS[t === "one_euro" || t === "auction_judicial" ? t : "sale"]!;
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
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sea text-xs font-semibold text-white">{i + 1}</span>
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
      {l.min_offer_eur != null && l.price_eur != null && l.min_offer_eur < l.price_eur && (
        <p className="mt-1 text-sm tnum">Offers valid from <span className="font-semibold">{formatEur(l.min_offer_eur)}</span></p>
      )}
      <div className="mt-2"><DeadlinePill deadline={l.deadline_at ?? l.auction_at} /></div>

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
