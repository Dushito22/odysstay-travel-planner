import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { useCallback, useEffect, useRef, useState } from "react";

import { FilterChips, FilterPanel, MobileFilters, RESET_SEARCH } from "@/components/odys/Filters";
import { ListingCard, ListingCardSkeleton } from "@/components/odys/ListingCard";
import { SaveSearchButton } from "@/components/odys/SaveSearchButton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { feedSearchSchema, SORTS, type FeedSearch } from "@/lib/feed";
import { useFeed } from "@/lib/use-feed";

export const Route = createFileRoute("/_authenticated/discover")({
  validateSearch: zodValidator(feedSearchSchema),
  head: () => ({ meta: [{ title: "Discover | Odysstay" }] }),
  component: DiscoverPage,
});

const PAGE = 24;

function DiscoverPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/discover" });
  const replace = useCallback((s: FeedSearch) => navigate({ search: s, replace: true }), [navigate]);
  const patch = (p: Partial<FeedSearch>) => navigate({ search: (prev) => ({ ...prev, ...p }), replace: true });
  const { profile, filters, rows, total, isLoading, error } = useFeed(search, replace);

  const [shown, setShown] = useState(PAGE);
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => setShown(PAGE), [rows]);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e?.isIntersecting && setShown((n) => n + PAGE), { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [rows.length]);

  const sort = search.sort ?? "best";

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl md:text-5xl">Discover</h1>
          <p className="mt-2 text-muted-foreground tnum">
            {isLoading ? "Loading opportunities" : total > rows.length
              ? `${total.toLocaleString("en-GB")} opportunities across Italy. Showing the top ${rows.length}, narrow with filters.`
              : `${rows.length} ${rows.length === 1 ? "opportunity" : "opportunities"} across Italy`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MobileFilters value={search} onChange={patch} />
          <Select value={sort} onValueChange={(s) => patch({ sort: s })}>
            <SelectTrigger className="w-40" aria-label="Sort"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SORTS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <SaveSearchButton filters={filters} sort={sort} />
        </div>
      </div>

      <div className="mb-6"><FilterChips value={search} onChange={patch} onReset={() => replace(RESET_SEARCH)} /></div>

      <div className="flex gap-8">
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto pr-2"><FilterPanel value={search} onChange={patch} /></div>
        </aside>
        <div className="min-w-0 flex-1">
          {error ? (
            <p className="rounded-2xl border bg-card p-8 text-warning">Could not load listings. Please refresh.</p>
          ) : isLoading ? (
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }, (_, i) => <ListingCardSkeleton key={i} />)}
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-2xl border border-dashed bg-card p-12 text-center">
              <p className="font-display text-xl">No listings match these filters yet.</p>
              <p className="mt-2 text-muted-foreground">New notices are added every day.</p>
              <div className="mt-6"><SaveSearchButton filters={filters} sort={sort} variant="default" /></div>
            </div>
          ) : (
            <>
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {rows.slice(0, shown).map((r) => <ListingCard key={r.id} row={r} profile={profile} />)}
              </div>
              {shown < rows.length && <div ref={sentinel} className="h-10" />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
