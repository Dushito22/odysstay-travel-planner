import { createFileRoute } from "@tanstack/react-router";

import { ComingSoon } from "@/components/odys/AppShell";

export const Route = createFileRoute("/_authenticated/discover")({
  head: () => ({ meta: [{ title: "Discover | Odysstay" }] }),
  component: DiscoverPage,
});

function DiscoverPage() {
  return <ComingSoon title="Discover" intro="The national feed of opportunities arrives here soon." />;
}
