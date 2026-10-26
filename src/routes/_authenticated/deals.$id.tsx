import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink } from "lucide-react";

import { AgentChatButton } from "@/components/odys/AgentChat";
import { CardImage } from "@/components/odys/ListingCard";
import { ApprovalCard } from "@/components/odys/deal/MessageView";
import {
  ActivityTab,
  ConversationsTab,
  DealSettings,
  DocumentsTab,
  PlanTab,
  QuotesTab,
} from "@/components/odys/deal/DealTabs";
import { DeadlinePill, LEGAL_LINE, Money, ScoreBadge } from "@/components/odys/primitives";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  dealQuery,
  isTaskOverdue,
  setStage,
  STAGES,
  stageLabel,
  type DealBundle,
} from "@/lib/deal";
import { TYPE_LABELS } from "@/lib/feed";
import { useDealAction, useDealRealtime } from "@/lib/use-deal";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/deals/$id")({
  head: () => ({ meta: [{ title: "Deal room | Odysstay" }] }),
  component: DealPage,
  notFoundComponent: () => (
    <div className="py-24 text-center">
      <h1 className="text-3xl">Deal not found</h1>
      <p className="mt-2 text-muted-foreground">
        It may have been removed, or it belongs to another account.
      </p>
      <Button asChild className="mt-6">
        <Link to="/deals">Back to deals</Link>
      </Button>
    </div>
  ),
});

function DealPage() {
  const { id } = Route.useParams();
  const q = useQuery(dealQuery(id));
  useDealRealtime(id);

  if (q.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-12 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }
  if (q.error || !q.data) {
    return (
      <div className="rounded-2xl border bg-card p-8">
        <p className="text-warning">This deal didn't load.</p>
        <Button className="mt-4" variant="outline" onClick={() => q.refetch()}>
          Try again
        </Button>
      </div>
    );
  }
  return <DealRoom bundle={q.data} />;
}

function DealRoom({ bundle }: { bundle: DealBundle }) {
  const { deal, listing, threads, messages, tasks, quotes, userId } = bundle;
  const { run, pending } = useDealAction(deal.id);

  const awaiting = messages.filter((m) => m.status === "awaiting_approval");
  const overdue = tasks.filter((t) => isTaskOverdue(t));
  const threadOf = (id: string) => threads.find((t) => t.id === id);
  const closed = ["won", "lost", "withdrawn"].includes(deal.stage);

  return (
    <div className="space-y-8">
      <Button asChild variant="ghost" size="sm" className="-ml-3">
        <Link to="/deals">
          <ArrowLeft /> All deals
        </Link>
      </Button>

      {/* Header */}
      <section className="flex flex-col gap-5 rounded-2xl border bg-card p-4 sm:flex-row sm:items-center md:p-5">
        {listing && (
          <div className="w-full shrink-0 sm:w-44">
            <CardImage row={listing} compact />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl md:text-4xl">{listing?.comune ?? "Listing unavailable"}</h1>
            <ScoreBadge score={listing?.score} reasons={listing?.score_reasons} size="sm" />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {[
              listing?.property_type
                ? (TYPE_LABELS[listing.property_type] ?? listing.property_type)
                : null,
              listing?.province,
              listing?.region,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {listing && <Money value={listing.price_eur} className="text-xl" />}
            <DeadlinePill deadline={listing?.deadline_at} />
            {listing && (
              <Link
                to="/listing/$id"
                params={{ id: listing.id! }}
                className="inline-flex items-center gap-1 text-sm text-brand hover:underline"
              >
                View listing <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        </div>
        <div className="sm:self-start">
          <div className="flex flex-wrap gap-2">
            {listing?.id && (
              <AgentChatButton listingId={listing.id} dealId={deal.id} signedIn variant="default" />
            )}
            <DealSettings bundle={bundle} run={run} pending={pending} />
          </div>
        </div>
      </section>

      {/* Stage */}
      <section aria-label="Deal stage">
        {deal.stage === "withdrawn" ? (
          <p className="rounded-2xl border bg-muted p-4 text-sm">
            You withdrew from this deal. Everything stays readable.
          </p>
        ) : (
          <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
            {STAGES.map((s) => {
              const idx = STAGES.findIndex((x) => x.value === deal.stage);
              const mine = STAGES.findIndex((x) => x.value === s.value);
              const current = s.value === deal.stage;
              const past = mine < idx && !["won", "lost"].includes(s.value);
              return (
                <button
                  key={s.value}
                  type="button"
                  disabled={pending === "stage" || current}
                  onClick={() =>
                    run("stage", () => setStage(deal, s.value), `Moved to ${stageLabel(s.value)}`)
                  }
                  className={cn(
                    "shrink-0 rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                    current && "border-foreground bg-foreground text-background",
                    past && !current && "bg-muted text-foreground",
                    !current && !past && "text-muted-foreground hover:bg-muted",
                  )}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Needs you */}
      {(awaiting.length > 0 || overdue.length > 0) && !closed && (
        <section className="space-y-3">
          <h2 className="text-xl">
            Needs you{" "}
            <span className="text-muted-foreground tnum">({awaiting.length + overdue.length})</span>
          </h2>
          {awaiting.map((m) => (
            <ApprovalCard
              key={m.id}
              msg={m}
              thread={threadOf(m.thread_id)}
              userId={userId}
              run={run}
              pending={pending}
            />
          ))}
          {overdue.length > 0 && (
            <div className="rounded-2xl border border-warning/40 bg-warning-soft/40 p-4 text-sm">
              <p className="font-medium text-warning">Overdue tasks</p>
              <ul className="mt-1 list-disc pl-5">
                {overdue.map((t) => (
                  <li key={t.id}>{t.title_en}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* Tabs */}
      <Tabs defaultValue={awaiting.length ? "conversations" : "plan"}>
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="plan">Plan</TabsTrigger>
          <TabsTrigger value="conversations">
            Conversations{threads.length ? ` (${threads.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="quotes">
            Quotes{quotes.length ? ` (${quotes.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>
        <div className="mt-6">
          <TabsContent value="plan">
            <PlanTab bundle={bundle} run={run} pending={pending} />
          </TabsContent>
          <TabsContent value="conversations">
            <ConversationsTab bundle={bundle} run={run} pending={pending} />
          </TabsContent>
          <TabsContent value="quotes">
            <QuotesTab bundle={bundle} run={run} pending={pending} />
          </TabsContent>
          <TabsContent value="documents">
            <DocumentsTab bundle={bundle} run={run} pending={pending} />
          </TabsContent>
          <TabsContent value="activity">
            <ActivityTab bundle={bundle} />
          </TabsContent>
        </div>
      </Tabs>

      <p className="border-t pt-6 text-xs text-muted-foreground">{LEGAL_LINE}</p>
    </div>
  );
}
