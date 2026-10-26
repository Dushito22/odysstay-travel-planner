import { createFileRoute } from "@tanstack/react-router";

import { ComingSoon } from "@/components/odys/AppShell";

export const Route = createFileRoute("/_authenticated/map")({
  head: () => ({ meta: [{ title: "Map | Odysstay" }] }),
  component: MapPage,
});

function MapPage() {
  return <ComingSoon title="Map" intro="The map of opportunities arrives here soon." />;
}
