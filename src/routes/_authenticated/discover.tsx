import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { useCallback, useEffect, useRef, useState } from "react";

import { FilterChips, FilterPanel, MobileFilters, RESET_SEARCH } from "@/components/odys/Filters";
import { ListingCard, ListingCardSkeleton } from "@/components/odys/ListingCard";
import { SaveSearchButton } from "@/components/odys/SaveSearchButton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { feedSearchSchema, SORTS, type FeedSearch } from "@/lib/feed";
import { useFeed } from "@/lib/use-feed";
import { useLang } from "@/lib/i18n";
import { useT } from "@/lib/tr";

export const Route = createFileRoute("/_authenticated/discover")({
  validateSearch: zodValidator(feedSearchSchema),
  head: () => ({ meta: [{ title: "Discover | Odysstay" }] }),
  component: DiscoverPage,
});

const PAGE = 24;

function DiscoverPage() {
  const t = useT();
  const ru = useLang() === "ru";
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/discover" });
  const replace = useCallback((s: FeedSearch) => navigate({ search: s, replace: true }), [navigate]);
  const patch = (p: Partial<FeedSearch>) => navigate({ search: (prev) => ({ ...prev, ...p }), replace: true });
  const { profile, filters, rows, total, isLoading, error } = useFeed(search, replace);

  const [shown, setShown] = useState(PAGE);
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => { setShown(PAGE); }, [rows]);
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
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="type-label text-foreground/55">{t("Discover")}</p>
          <h1 className="mt-4 type-h2">{ru ? <>Дома в Италии на продажу: <em className="font-display italic text-azure">самые выгодные сначала</em>.</> : <>Every open house in Italy, <em className="font-display italic text-azure">best first</em>.</>}</h1>
          <p className="mt-3 type-body text-foreground/60 tnum">
            {isLoading ? (ru ? "Загружаем свежие объявления…" : "Reading today's notices…") : total > rows.length
              ? (ru ? `Всего на продажу: ${total.toLocaleString("ru-RU")}. Показываем ${rows.length} самых выгодных, остальное можно отфильтровать.` : `${total.toLocaleString("en-GB")} open across Italy. Showing the best ${rows.length}, narrow it down with filters.`)
              : (ru ? `Объектов на продажу по всей Италии: ${rows.length.toLocaleString("ru-RU")}` : `${rows.length.toLocaleString("en-GB")} ${rows.length === 1 ? "house" : "houses"} open across Italy`)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MobileFilters value={search} onChange={patch} />
          <Select value={sort} onValueChange={(s) => patch({ sort: s })}>
            <SelectTrigger className="w-56" aria-label="Sort"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SORTS.map((s) => <SelectItem key={s.value} value={s.value}>{t(s.label)}</SelectItem>)}
            </SelectContent>
          </Select>
          <SaveSearchButton filters={filters} sort={sort} />
        </div>
      </div>

      <div className="mb-8 mt-6 border-b border-foreground/10 pb-5"><FilterChips value={search} onChange={patch} onReset={() => replace(RESET_SEARCH)} /></div>

      <div className="flex gap-8 xl:gap-10">
        <aside className="hidden w-[264px] shrink-0 lg:block">
          <div className="grain sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto rounded-[10px] bg-muted p-5">
            <FilterPanel value={search} onChange={patch} />
          </div>
        </aside>
        <div className="min-w-0 flex-1">
          {error ? (
            <p className="rounded-[10px] border bg-card p-8 font-light text-warning">Could not load listings. Please refresh.</p>
          ) : isLoading ? (
            <div className="grid items-stretch gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }, (_, i) => <ListingCardSkeleton key={i} />)}
            </div>
          ) : rows.length === 0 ? (
            <div className="grain rounded-[10px] bg-muted p-12 text-center">
              <p className="type-h3">Nothing matches, <em className="italic text-azure">yet</em>.</p>
              <p className="mt-2 type-body text-foreground/60">New notices arrive every morning. Save this search and Argos will tell you.</p>
              <div className="mt-6"><SaveSearchButton filters={filters} sort={sort} variant="default" /></div>
            </div>
          ) : (
            <>
              <div className="grid items-stretch gap-6 sm:grid-cols-2 xl:grid-cols-3">
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
