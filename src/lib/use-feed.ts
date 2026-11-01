import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

import { fetchFeed, filtersOf, prefsSearch, sortFeed, type FeedSearch } from "./feed";
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
  const q = useQuery({
    queryKey: ["feed", filters, search.sort ?? "best"],
    queryFn: () => fetchFeed(filters, search.sort ?? "best"),
    enabled: ready,
  });
  const rows = useMemo(() => sortFeed(q.data?.rows ?? [], search.sort ?? "best", profile), [q.data, search.sort, profile]);
  return { profile, filters, rows, total: q.data?.total ?? 0, isLoading: !ready || q.isLoading, error: q.error };
}
