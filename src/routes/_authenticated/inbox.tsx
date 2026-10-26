import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { AlertTriangle, CalendarClock, CheckCircle2, MailOpen } from "lucide-react";

import { PageHeader } from "@/components/odys/AppShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { inboxQuery, type InboxItem } from "@/lib/deal";
import { useInboxRealtime } from "@/lib/use-deal";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/inbox")({
  head: () => ({ meta: [{ title: "Inbox | Odysstay" }] }),
  component: InboxPage,
});

const KIND = {
  approval: { icon: CheckCircle2, label: "Approve", tone: "bg-caution-soft text-caution" },
  inbound: { icon: MailOpen, label: "Reply", tone: "bg-brand-soft text-brand" },
  overdue_task: { icon: AlertTriangle, label: "Overdue", tone: "bg-warning-soft text-warning" },
  deadline: { icon: CalendarClock, label: "Due soon", tone: "bg-muted text-foreground" },
} satisfies Record<InboxItem["kind"], { icon: typeof MailOpen; label: string; tone: string }>;

function InboxPage() {
  const q = useQuery(inboxQuery);
  useInboxRealtime();

  return (
    <>
      <PageHeader
        title="Inbox"
        intro="Everything across your deals that needs you: approvals, replies, overdue tasks and close deadlines."
      />
      {q.error ? (
        <div className="rounded-2xl border bg-card p-8">
          <p className="text-warning">Could not load your inbox.</p>
          <Button className="mt-4" variant="outline" onClick={() => q.refetch()}>
            Try again
          </Button>
        </div>
      ) : q.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      ) : !q.data?.length ? (
        <div className="rounded-2xl border border-dashed bg-card p-12 text-center">
          <p className="font-display text-xl">Nothing needs you right now.</p>
          <p className="mt-2 text-muted-foreground">
            Approvals, replies and deadlines from your deals will show up here.
          </p>
          <Button asChild variant="outline" className="mt-6">
            <Link to="/deals">Go to deals</Link>
          </Button>
        </div>
      ) : (
        <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
          {q.data.map((item, i) => {
            const k = KIND[item.kind];
            const Icon = k.icon;
            return (
              <li key={`${item.kind}-${item.dealId}-${i}`}>
                <Link
                  to="/deals/$id"
                  params={{ id: item.dealId }}
                  className="flex items-start gap-4 p-4 transition-colors hover:bg-muted/60 md:p-5"
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                      k.tone,
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{item.dealLabel}</span>
                      <span>· {k.label}</span>
                      {item.binding && (
                        <span className="rounded-full bg-warning-soft px-2 py-0.5 font-medium text-warning">
                          Binding
                        </span>
                      )}
                      <span className="ml-auto tnum">
                        {format(new Date(item.date), "d MMM yyyy")}
                      </span>
                    </div>
                    <p className="mt-1 font-medium">{item.title}</p>
                    {item.detail && (
                      <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                        {item.detail}
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
