import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

import { fetchFeed, filtersOf, prefsSearch, sortFeed, type FeedSearch } from "./feed";
import { profileQuery } from "./profile";

/** Shared feed state for /discover and /map. Search params are the single source of truth. */
export function useFeed(search: FeedSearch, replace: (s: FeedSearch) => void) {
  const { data: profile = null, isFetched: profileReady } = useQuery(profileQuery);
  const ready = search.sort !== undefined;

  useEffect(() => {
    if (!ready && profileReady) replace(prefsSearch(profile));
  }, [ready, profileReady, profile, replace]);

  const filters = filtersOf(search);
  const q = useQuery({
    queryKey: ["feed", filters],
    queryFn: () => fetchFeed(filters),
    enabled: ready,
  });
  const rows = useMemo(() => sortFeed(q.data ?? [], search.sort ?? "best", profile), [q.data, search.sort, profile]);
  return { profile, filters, rows, isLoading: !ready || q.isLoading, error: q.error };
}
