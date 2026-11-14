import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { useCallback, useEffect, useRef, useState } from "react";

import { ArgosComposer } from "@/components/odys/ArgosComposer";
import { FilterBar } from "@/components/odys/FilterBar";
import { RESET_SEARCH } from "@/components/odys/Filters";
import { FeedGate, PEEK } from "@/components/odys/SignInGate";
import { ListingCard, ListingCardSkeleton } from "@/components/odys/ListingCard";
import { SaveSearchButton } from "@/components/odys/SaveSearchButton";
import { WeeklyDrop } from "@/components/odys/WeeklyDrop";
import { feedSearchSchema, type FeedSearch } from "@/lib/feed";
import { useSignedIn } from "@/lib/signed-in";
import { useFeed } from "@/lib/use-feed";
import { speechLang, useLang } from "@/lib/i18n";
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
  const patch = (p: Partial<FeedSearch>) => navigate({ search: (prev: FeedSearch) => ({ ...prev, ...p }), replace: true });
  const { profile, filters, rows, total, isLoading, error } = useFeed(search, replace);
  const signedIn = useSignedIn();
  const guest = signedIn === false;

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
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="type-label text-foreground/55">{t("Discover")}</p>
          <h1 className="mt-3 type-h2">{ru ? <>Дома в Италии на продажу, <em className="font-display italic text-azure">самые выгодные сначала</em>.</> : <>Every house for sale in Italy, <em className="font-display italic text-azure">best value first</em>.</>}</h1>
          <p className="mt-2 text-[15px] font-light text-foreground/60 tnum">
            {isLoading ? (ru ? "Загружаем свежие объявления…" : "Reading today's notices…") : total > rows.length
              ? (ru ? `Найдено ${total.toLocaleString("ru-RU")}, показываем первые ${rows.length}.` : `${total.toLocaleString("en-GB")} match, showing the top ${rows.length}.`)
              : (ru ? `Найдено: ${rows.length.toLocaleString("ru-RU")}` : `${rows.length.toLocaleString("en-GB")} ${rows.length === 1 ? "house matches" : "houses match"}`)}
            {sort === "best" && <span className="hidden md:inline"> {ru ? "Порядок: оценка сделки Argos (цена против оценки и цен района, состояние, сроки, риски), дома с фото первыми." : "Ranked by Argos's deal score: price against valuations and local prices, condition, deadline, red flags. Real photos first."}</span>}
          </p>
        </div>
        <div className="w-full shrink-0 lg:w-[460px]">
          <ArgosComposer tone="light" lang={speechLang(ru ? "ru" : "en")}
            placeholder={ru ? "Или просто скажите Argos, что ищете…" : "Or just tell Argos what you want…"}
            onSubmit={(q, spoken) => navigate({ to: "/argos", search: { q, ...(spoken ? { voice: true } : {}) } })} />
        </div>
      </div>

      <WeeklyDrop />

      {/* Directly in the page column, so it stays pinned while the results scroll. */}
      <FilterBar className="mt-6" value={search} onChange={patch} onReset={() => replace(RESET_SEARCH)} right={<SaveSearchButton filters={filters} sort={sort} compact />} />

      <div className="mt-6">
        {error ? (
          <p className="rounded-[10px] border bg-card p-8 font-light text-warning">{ru ? "Не удалось загрузить объявления. Обновите страницу." : "Could not load listings. Please refresh."}</p>
        ) : isLoading ? (
          <div className="grid items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => <ListingCardSkeleton key={i} />)}
          </div>
        ) : rows.length === 0 ? (
          <div className="grain rounded-[10px] bg-muted p-12 text-center">
            <p className="type-h3">{ru ? <>Пока <em className="italic text-azure">ничего</em>.</> : <>Nothing matches, <em className="italic text-azure">yet</em>.</>}</p>
            <p className="mt-2 type-body text-foreground/60">{ru ? "Новые объявления приходят каждое утро. Сохраните поиск, и Argos напишет вам." : "New notices arrive every morning. Save this search and Argos will tell you."}</p>
            <div className="mt-6"><SaveSearchButton filters={filters} sort={sort} variant="default" /></div>
          </div>
        ) : (
          <>
            <div className="grid items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {rows.slice(0, guest ? PEEK : shown).map((r) => <ListingCard key={r.id} row={r} profile={profile} />)}
            </div>
            {guest ? <FeedGate rows={rows} total={Math.max(total, rows.length)} region={search.regions.length === 1 ? search.regions[0] : null} />
              : shown < rows.length && <div ref={sentinel} className="h-10" />}
          </>
        )}
      </div>
    </div>
  );
}
