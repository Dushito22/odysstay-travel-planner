import { createFileRoute } from "@tanstack/react-router";

import { ComingSoon } from "@/components/odys/AppShell";

export const Route = createFileRoute("/_authenticated/saved")({
  head: () => ({ meta: [{ title: "Saved | Odysstay" }] }),
  component: SavedPage,
});

function SavedPage() {
  return <ComingSoon title="Saved" intro="Listings you save will appear here." />;
}
