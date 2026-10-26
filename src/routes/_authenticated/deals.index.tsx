import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

import { PageHeader } from "@/components/odys/AppShell";
import { DeadlinePill, Money, ScoreBadge } from "@/components/odys/primitives";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  dealsAttentionQuery,
  dealsQuery,
  groupDeals,
  stageLabel,
  type DealWithListing,
} from "@/lib/deal";
import { TYPE_LABELS } from "@/lib/feed";

export const Route = createFileRoute("/_authenticated/deals/")({
  head: () => ({ meta: [{ title: "Deals | Odysstay" }] }),
  component: DealsPage,
});

function DealsPage() {
  const deals = useQuery(dealsQuery);
  const attention = useQuery(dealsAttentionQuery);

  if (deals.error) {
    return (
      <>
        <PageHeader title="Deals" />
        <div className="rounded-2xl border bg-card p-8">
          <p className="text-warning">Could not load your deals.</p>
          <Button className="mt-4" variant="outline" onClick={() => deals.refetch()}>
            Try again
          </Button>
        </div>
      </>
    );
  }

  if (deals.isLoading) {
    return (
      <>
        <PageHeader title="Deals" />
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      </>
    );
  }

  const list = deals.data ?? [];
  if (!list.length) {
    return (
      <>
        <PageHeader
          title="Deals"
          intro="Every property you pursue gets its own deal room: plan, messages, quotes and deadlines."
        />
        <div className="rounded-2xl border border-dashed bg-card p-12 text-center">
          <p className="font-display text-xl">No deals yet.</p>
          <p className="mt-2 text-muted-foreground">Start one from any listing.</p>
          <Button asChild className="mt-6">
            <Link to="/discover">Browse listings</Link>
          </Button>
        </div>
      </>
    );
  }

  const { active, submitted, closed } = groupDeals(list);
  const counts = attention.data ?? {};

  return (
    <>
      <PageHeader
        title="Deals"
        intro="Every property you're pursuing, with what needs you first."
      />
      <div className="space-y-10">
        <Group title="Active" deals={active} counts={counts} />
        <Group title="Submitted" deals={submitted} counts={counts} />
        <Group title="Closed" deals={closed} counts={counts} />
      </div>
    </>
  );
}

function Group({
  title,
  deals,
  counts,
}: {
  title: string;
  deals: DealWithListing[];
  counts: Record<string, number>;
}) {
  if (!deals.length) return null;
  return (
    <section>
      <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
        {title} <span className="tnum">({deals.length})</span>
      </h2>
      <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
        {deals.map((d) => (
          <DealRow key={d.id} deal={d} needsYou={counts[d.id] ?? 0} />
        ))}
      </ul>
    </section>
  );
}

function DealRow({ deal, needsYou }: { deal: DealWithListing; needsYou: number }) {
  const l = deal.listing;
  return (
    <li>
      <Link
        to="/deals/$id"
        params={{ id: deal.id }}
        className="flex items-center gap-4 p-4 transition-colors hover:bg-muted/60 md:p-5"
      >
        <ScoreBadge score={l?.score} reasons={l?.score_reasons} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="truncate font-display text-lg font-semibold">
              {l?.comune ?? "Listing unavailable"}
            </span>
            <span className="text-sm text-muted-foreground">
              {[
                l?.property_type ? (TYPE_LABELS[l.property_type] ?? l.property_type) : null,
                l?.region,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {l && <Money value={l.price_eur} className="text-sm" showOneEuroChip={false} />}
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
              {stageLabel(deal.stage)}
            </span>
            <DeadlinePill deadline={l?.deadline_at} />
            {needsYou > 0 && (
              <span className="rounded-full bg-caution-soft px-2.5 py-1 text-xs font-medium text-caution tnum">
                {needsYou} need{needsYou === 1 ? "s" : ""} you
              </span>
            )}
          </div>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </Link>
    </li>
  );
}
