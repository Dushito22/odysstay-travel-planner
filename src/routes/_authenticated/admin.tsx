import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { toast } from "sonner";

import { PageHeader } from "@/components/odys/AppShell";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin | Odysstay" }] }),
  component: AdminPage,
});

type Overview = {
  stats: Record<string, number>;
  waitlist: { plan: string; billing: string; created_at: string; email: string }[];
  purchases: { id: string; kind: string; status: string; payment_ref: string | null; paid_note: string | null; paid_claimed_at: string | null; note: string | null; created_at: string; listing_id: string | null; email: string; listing_title: string | null; listing_price: number | null }[];
  sources: { source: string; n: number }[];
  users: { email: string; signup_source: string | null; created_at: string; last_sign_in_at: string | null; deals: number; saved: number }[];
};

const STAT_LABELS: [string, string][] = [
  ["users", "Users"], ["users_7d", "New, 7 days"], ["listings", "Listings"], ["deals", "Deals"],
  ["saved", "Saved houses"], ["telegram", "On Telegram"], ["waitlist", "Plan waitlist"], ["purchase", "Service requests"],
];

const KIND: Record<string, string> = { deal_check: "Deal Check", remote_purchase: "Remote purchase", search_purchase: "Search + purchase" };

const d = (v: string | null) => (v ? format(new Date(v), "d MMM yyyy, HH:mm") : "never");

function AdminPage() {
  const q = useQuery({
    queryKey: ["admin-overview"],
    retry: false,
    queryFn: async (): Promise<Overview> => {
      const { data, error } = await supabase.rpc("admin_overview" as never);
      if (error) throw error;
      return data as unknown as Overview;
    },
  });

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.rpc("admin_set_request_status" as never, { request_id: id, new_status: status } as never);
    if (error) toast.error(error.message); else void q.refetch();
  };

  if (q.isLoading) return <><PageHeader title="Admin" /><Skeleton className="h-64 w-full" /></>;
  if (q.error || !q.data) {
    return (
      <>
        <PageHeader title="Admin" />
        <div className="rounded-[10px] bg-muted p-10 text-center type-body text-foreground/60">
          This page is only for the Odysstay owner.
          <div className="mt-4"><Link to="/discover" className="underline">Back to search</Link></div>
        </div>
      </>
    );
  }

  const o = q.data;
  return (
    <>
      <PageHeader title="Admin" intro="Who signed up, who wants a paid plan, and who asked for the purchase service." />
      <div className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STAT_LABELS.map(([k, label]) => (
          <div key={k} className="rounded-[10px] bg-muted px-4 py-3">
            <div className="type-h2 text-[28px] leading-none">{o.stats[k] ?? 0}</div>
            <div className="mt-1 text-[12px] text-foreground/60">{label}</div>
          </div>
        ))}
      </div>

      <Section title="Service requests" empty="No requests yet." rows={o.purchases.length}>
        {o.purchases.map((p) => (
          <div key={p.id}>
            <Row a={`${KIND[p.kind] ?? p.kind} · ${p.email}`} b={p.listing_id ? (
              <Link to="/listing/$id" params={{ id: p.listing_id }} className="underline">{p.listing_title ?? "Listing"}{p.listing_price ? `, €${p.listing_price.toLocaleString("en")}` : ""}</Link>
            ) : "General request"} c={d(p.created_at)} />
            <div className="flex flex-wrap items-center gap-2 px-4 pb-2.5 text-[12px]">
              {p.payment_ref && <span className="rounded bg-muted px-1.5 py-0.5 font-mono">{p.payment_ref}</span>}
              <span className={p.status === "paid" ? "text-success" : "text-foreground/60"}>{p.status}</span>
              {p.paid_claimed_at && p.status !== "paid" && <span className="text-[oklch(0.6_0.13_45)]">says paid {d(p.paid_claimed_at)}{p.paid_note ? `: ${p.paid_note}` : ""}</span>}
              {p.status !== "paid" && (
                <button type="button" onClick={() => void setStatus(p.id, "paid")} className="ml-auto rounded-full border px-2.5 py-0.5 hover:border-foreground/40">Mark paid</button>
              )}
              {p.status === "paid" && (
                <button type="button" onClick={() => void setStatus(p.id, "done")} className="ml-auto rounded-full border px-2.5 py-0.5 hover:border-foreground/40">Mark done</button>
              )}
            </div>
          </div>
        ))}
      </Section>

      <Section title="Plan waitlist" empty="Nobody yet." rows={o.waitlist.length}>
        {o.waitlist.map((w) => (
          <Row key={w.email + w.plan} a={w.email} b={`${w.plan}, ${w.billing}`} c={d(w.created_at)} />
        ))}
      </Section>

      <Section title="Where sign-ups come from" empty="No sign-ups yet." rows={o.sources?.length ?? 0}>
        {(o.sources ?? []).map((x) => <Row key={x.source} a={x.source} b={`${x.n} people`} c="" />)}
      </Section>

      <Section title="Latest users" empty="No users." rows={o.users.length}>
        {o.users.map((u) => (
          <Row key={u.email} a={u.email} b={`${u.signup_source ?? "direct"} · ${u.deals} deals, ${u.saved} saved`} c={`joined ${d(u.created_at)}`} />
        ))}
      </Section>
    </>
  );
}

function Section({ title, empty, rows, children }: { title: string; empty: string; rows: number; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="mb-3 text-[15px] font-medium">{title} <span className="text-foreground/40">{rows}</span></h2>
      <div className="divide-y divide-border rounded-[10px] border border-border">
        {rows ? children : <div className="px-4 py-3 text-[13px] text-foreground/60">{empty}</div>}
      </div>
    </section>
  );
}

function Row({ a, b, c }: { a: string; b: React.ReactNode; c: string }) {
  return (
    <div className="grid gap-1 px-4 py-2.5 text-[13px] sm:grid-cols-[1.2fr_1.2fr_1fr] sm:gap-4">
      <span className="truncate font-medium">{a}</span>
      <span className="text-foreground/70">{b}</span>
      <span className="text-foreground/50 sm:text-right">{c}</span>
    </div>
  );
}
