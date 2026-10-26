import { createFileRoute } from "@tanstack/react-router";

import { ComingSoon } from "@/components/odys/AppShell";

export const Route = createFileRoute("/_authenticated/deals/$id")({
  head: () => ({ meta: [{ title: "Deal room | Odysstay" }] }),
  component: DealPage,
});

function DealPage() {
  return <ComingSoon title="Deal room" intro="The deal room for this property arrives here soon." />;
}
