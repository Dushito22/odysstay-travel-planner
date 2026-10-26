import { createFileRoute } from "@tanstack/react-router";

import { PublicShell } from "@/components/odys/PublicShell";
import { LEGAL_LINE } from "@/components/odys/primitives";

export const Route = createFileRoute("/terms")({
  head: () => ({ meta: [{ title: "Terms | Odysstay" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <PublicShell>
      <article className="mx-auto max-w-2xl space-y-4">
        <h1 className="text-4xl">Terms</h1>
        <p className="text-muted-foreground">Our full terms of service are being finalised.</p>
        <p className="text-muted-foreground">{LEGAL_LINE}</p>
        <p className="text-muted-foreground">Questions: hello@odysstay.com</p>
      </article>
    </PublicShell>
  ),
});
