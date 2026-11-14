import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

import { countFeed, FEED_FIRST, fetchFeed, filtersOf, prefsSearch, sortFeed, type FeedSearch } from "./feed";
import { profileQuery } from "./profile";

/** Shared feed state for /discover and /map. Search params are the single source of truth. */
const LAST = "odys-last-discover";

export function useFeed(search: FeedSearch, replace: (s: FeedSearch) => void) {
  const { data: profile = null, isFetched: profileReady } = useQuery(profileQuery);
  const ready = search.sort !== undefined;

  // Coming back to Discover without filters in the address: reopen the search you had, else start from your preferences.
  useEffect(() => {
    if (ready) return;
    try {
      const saved = sessionStorage.getItem(LAST);
      if (saved) { replace(JSON.parse(saved) as FeedSearch); return; }
    } catch { /* storage blocked */ }
    if (profileReady) replace(prefsSearch(profile));
  }, [ready, profileReady, profile, replace]);
  useEffect(() => {
    if (!ready) return;
    try { sessionStorage.setItem(LAST, JSON.stringify(search)); } catch { /* storage blocked */ }
  }, [ready, search]);

  const filters = filtersOf(search);
  const sort = search.sort ?? "best";
  // Two requests: the first screenful (fast) and the full list (can take seconds when the database is busy).
  const first = useQuery({ queryKey: ["feed-first", filters, sort], queryFn: () => fetchFeed(filters, sort, FEED_FIRST), enabled: ready });
  const q = useQuery({ queryKey: ["feed", filters, sort], queryFn: () => fetchFeed(filters, sort), enabled: ready });
  // The count runs beside the rows and never holds them up.
  const c = useQuery({
    queryKey: ["feed-count", filters, search.sort ?? "best"],
    queryFn: () => countFeed(filters, search.sort ?? "best"),
    enabled: ready, staleTime: 10 * 60_000,
  });
  // What's already on screen keeps its place when the full list lands; the rest comes after it.
  const rows = useMemo(() => {
    const head = sortFeed(first.data?.rows ?? [], sort, profile);
    if (!q.data) return head;
    const seen = new Set(head.map((r) => r.id));
    return [...head, ...sortFeed(q.data.rows.filter((r) => !seen.has(r.id)), sort, profile)];
  }, [first.data, q.data, sort, profile]);
  const n = rows.length;
  // A planner estimate can undershoot a short list; never show fewer than we hold.
  const total = c.data != null ? Math.max(c.data, n) : n;
  // An error only when nothing could be loaded at all.
  const failed = !rows.length && !first.isLoading && !q.isLoading ? first.error ?? q.error ?? null : null;
  return { profile, filters, rows, total, isLoading: !ready || (first.isLoading && q.isLoading), error: failed };
}
