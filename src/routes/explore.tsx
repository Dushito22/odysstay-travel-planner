import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Lock } from "lucide-react";

import { ListingCard, ListingCardSkeleton } from "@/components/odys/ListingCard";
import { PublicShell } from "@/components/odys/PublicShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { topListingsQuery } from "@/lib/public";

export const Route = createFileRoute("/explore")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/discover" });
  },
  head: () => ({
    meta: [
      { title: "Explore | Odysstay" },
      {
        name: "description",
        content:
          "The best-scoring Italian public property notices open right now, explained in English.",
      },
    ],
  }),
  component: Explore,
});

function Explore() {
  const q = useQuery(topListingsQuery(6));
  return (
    <PublicShell>
      <h1 className="text-4xl md:text-5xl">Top opportunities today</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        The six highest-scoring notices still open. Sign in to see the full national feed, the map
        and filters.
      </p>
      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {q.isLoading
          ? Array.from({ length: 6 }, (_, i) => <ListingCardSkeleton key={i} />)
          : (q.data ?? []).map((r) => <ListingCard key={r.id} row={r} profile={null} />)}
      </div>
      {q.isSuccess && q.data.length === 0 && (
        <p className="mt-6 rounded-2xl border border-dashed bg-card p-10 text-center text-muted-foreground">
          New notices are being added. Check back soon.
        </p>
      )}
      {q.error && <p className="mt-6 text-warning">Could not load listings. Please refresh.</p>}
      <div className="mt-14 rounded-3xl border bg-card p-8 text-center md:p-12">
        <Lock className="mx-auto h-6 w-6 text-muted-foreground" />
        <h2 className="mt-4 text-2xl md:text-3xl">See every notice across Italy</h2>
        <p className="mx-auto mt-2 max-w-lg text-muted-foreground">
          Filters by region, budget and type, the map, saved searches with alerts, and your own deal
          rooms. Free.
        </p>
        <Button asChild size="lg" className="mt-6">
          <Link to="/login" search={{ redirect: "/discover" }}>
            Sign in to explore
          </Link>
        </Button>
      </div>
    </PublicShell>
  );
}
