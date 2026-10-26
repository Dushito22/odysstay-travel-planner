import { createFileRoute } from "@tanstack/react-router";

import { ComingSoon } from "@/components/odys/AppShell";

export const Route = createFileRoute("/_authenticated/inbox")({
  head: () => ({ meta: [{ title: "Inbox | Odysstay" }] }),
  component: InboxPage,
});

function InboxPage() {
  return <ComingSoon title="Inbox" intro="Messages from comuni, notaries and surveyors will appear here." />;
}
