import { createFileRoute, Link } from "@tanstack/react-router";

import { LEGAL_LINE, Wordmark } from "@/components/odys/primitives";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Odysstay | Italy's hidden property, found and explained" },
      { name: "description", content: "Underpriced Italian property from official public notices, translated and explained for foreign buyers." },
      { property: "og:title", content: "Odysstay | Italy's hidden property, found and explained" },
      { property: "og:description", content: "Underpriced Italian property from official public notices, translated and explained for foreign buyers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="flex min-h-screen flex-col px-5 py-6 md:px-10">
      <header className="flex items-center justify-between">
        <Wordmark />
        <Button asChild variant="outline"><Link to="/login">Sign in</Link></Button>
      </header>
      <main className="mx-auto flex max-w-3xl flex-1 flex-col justify-center py-20">
        <h1 className="text-5xl font-medium leading-[1.05] md:text-7xl">
          The Italian houses that never reach the property portals.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          Town halls, notaries and courts publish them in Italian PDFs. We find them, translate every line and help you buy.
        </p>
        <div className="mt-10"><Button asChild size="lg"><Link to="/login">Sign in</Link></Button></div>
      </main>
      <footer className="text-xs text-muted-foreground">{LEGAL_LINE}</footer>
    </div>
  );
}
