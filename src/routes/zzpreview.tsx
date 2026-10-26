import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { ListingCard } from "@/components/odys/ListingCard";
import { FilterPanel } from "@/components/odys/Filters";
import { DEFAULT_FILTERS, fetchFeed, sortFeed } from "@/lib/feed";
const FeedMap = lazy(() => import("@/components/odys/FeedMap"));
export const Route = createFileRoute("/zzpreview")({ ssr: false, component: P });
function P() {
  const { data = [] } = useQuery({ queryKey: ["x"], queryFn: () => fetchFeed(DEFAULT_FILTERS) });
  const rows = sortFeed(data, "best", null);
  return <div className="p-8 flex gap-8"><div className="w-64"><FilterPanel value={{...DEFAULT_FILTERS, sort:"best", prefs:false}} onChange={()=>{}} /></div><div className="flex-1"><h1 className="text-5xl mb-6">Discover</h1><div className="h-[360px] rounded-2xl overflow-hidden"><ClientOnly><Suspense><FeedMap rows={rows} profile={null} onBounds={() => {}} /></Suspense></ClientOnly></div>
  <div className="grid gap-x-6 gap-y-10 grid-cols-3 mt-8">{rows.map(r => <ListingCard key={r.id} row={r} profile={null} />)}</div></div></div>;
}
