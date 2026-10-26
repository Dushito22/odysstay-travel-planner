import { createFileRoute } from "@tanstack/react-router";

import { ComingSoon } from "@/components/odys/AppShell";

export const Route = createFileRoute("/_authenticated/deals/")({
  head: () => ({ meta: [{ title: "Deals | Odysstay" }] }),
  component: DealsPage,
});

function DealsPage() {
  return <ComingSoon title="Deals" intro="Your deal rooms will appear here once you start one." />;
}
