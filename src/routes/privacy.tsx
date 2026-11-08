import { createFileRoute } from "@tanstack/react-router";

import { PublicShell } from "@/components/odys/PublicShell";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [{ title: "Privacy | Odysstay" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <PublicShell>
      <article className="mx-auto max-w-2xl space-y-4">
        <h1 className="text-4xl">Privacy</h1>
        <p className="text-muted-foreground">
          Our full privacy policy is being finalised. In short: your documents are private to you,
          your messages are sent only after you approve them, and we never sell your data.
        </p>
        <p className="text-muted-foreground">Questions: hello@odysstay.xyz</p>
      </article>
    </PublicShell>
  ),
});
