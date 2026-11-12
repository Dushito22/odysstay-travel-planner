import { ClientOnly, createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { lazy, Suspense, useCallback, useMemo, useState } from "react";

import { FilterChips, MobileFilters, FilterPanel, RESET_SEARCH } from "@/components/odys/Filters";
import { ListingCard } from "@/components/odys/ListingCard";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { feedSearchSchema, type FeedSearch } from "@/lib/feed";
import { useFeed } from "@/lib/use-feed";
import type { Bounds } from "@/components/odys/FeedMap";

const FeedMap = lazy(() => import("@/components/odys/FeedMap"));

export const Route = createFileRoute("/_authenticated/map")({
  validateSearch: zodValidator(feedSearchSchema),
  head: () => ({ meta: [{ title: "Map | Odysstay" }] }),
  component: MapPage,
});

function MapPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/map" });
  const replace = useCallback((s: FeedSearch) => navigate({ search: s, replace: true }), [navigate]);
  const patch = (p: Partial<FeedSearch>) => navigate({ search: (prev: FeedSearch) => ({ ...prev, ...p }), replace: true });
  const { profile, rows } = useFeed(search, replace);
  const [bounds, setBounds] = useState<Bounds | null>(null);

  const located = useMemo(() => rows.filter((r) => r.lat != null && r.lng != null), [rows]);
  const visible = useMemo(
    () => (bounds ? located.filter((r) => r.lat! >= bounds.s && r.lat! <= bounds.n && r.lng! >= bounds.w && r.lng! <= bounds.e) : located),
    [located, bounds],
  );

  return (
    <div className="flex h-[calc(100vh-61px-64px)] md:h-screen">
      <div className="relative min-w-0 flex-1">
        <div className="absolute left-3 right-3 top-3 z-[1000] flex flex-wrap items-center gap-2">
          <MobileFilters value={search} onChange={patch} />
          <Sheet>
            <SheetTrigger asChild><Button variant="outline" className="hidden bg-card lg:inline-flex">Filters</Button></SheetTrigger>
            <SheetContent side="left" className="overflow-y-auto">
              <SheetHeader><SheetTitle className="font-display">Filters</SheetTitle></SheetHeader>
              <div className="px-4 pb-6"><FilterPanel value={search} onChange={patch} /></div>
            </SheetContent>
          </Sheet>
          <div className="rounded-xl bg-card/95 px-3 py-1.5"><FilterChips value={search} onChange={patch} onReset={() => replace(RESET_SEARCH)} /></div>
        </div>
        <ClientOnly fallback={<div className="h-full w-full animate-pulse bg-muted" />}>
          <Suspense fallback={<div className="h-full w-full animate-pulse bg-muted" />}>
            <FeedMap rows={located} profile={profile} onBounds={setBounds} />
          </Suspense>
        </ClientOnly>
      </div>
      <aside className="hidden w-96 shrink-0 overflow-y-auto border-l bg-background p-4 lg:block">
        <p className="mb-4 text-sm text-muted-foreground tnum">{visible.length} in this area</p>
        <div className="space-y-4">
          {visible.map((r) => <ListingCard key={r.id} row={r} profile={profile} compact />)}
        </div>
      </aside>
    </div>
  );
}
