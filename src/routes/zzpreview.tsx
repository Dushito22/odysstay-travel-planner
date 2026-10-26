import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { ListingCard } from "@/components/odys/ListingCard";
import { DEFAULT_FILTERS, fetchFeed, sortFeed } from "@/lib/feed";
const FeedMap = lazy(() => import("@/components/odys/FeedMap"));
export const Route = createFileRoute("/zzpreview")({ ssr: false, component: P });
function P() {
  const { data = [] } = useQuery({ queryKey: ["x"], queryFn: () => fetchFeed(DEFAULT_FILTERS) });
  const rows = sortFeed(data, "best", null);
  return <div className="p-4"><p id="n">{rows.length}</p><div className="h-[500px]"><ClientOnly><Suspense><FeedMap rows={rows} profile={null} onBounds={() => {}} /></Suspense></ClientOnly></div>
  <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3 mt-4">{rows.map(r => <ListingCard key={r.id} row={r} profile={null} />)}</div></div>;
}
