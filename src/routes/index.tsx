import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import hero from "@/assets/hero-villa.jpg";
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
    <div className="min-h-screen p-3 md:p-4">
      <section className="relative flex min-h-[calc(100vh-1.5rem)] flex-col overflow-hidden rounded-3xl md:min-h-[calc(100vh-2rem)]">
        <img src={hero} alt="Stone farmhouse on an Italian hillside at golden hour" width={1600} height={1104}
          className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-foreground/20 to-foreground/10" />
        <header className="relative z-10 flex items-center justify-between p-5 text-background md:p-8">
          <Wordmark className="text-background" />
          <Button asChild variant="secondary" size="sm"><Link to="/login">Sign in</Link></Button>
        </header>
        <div className="relative z-10 mt-auto max-w-4xl p-6 text-background md:p-12">
          <p className="mb-5 text-sm font-medium uppercase tracking-[0.2em] text-background/75">Public notices, decoded</p>
          <h1 className="text-5xl leading-[1.02] md:text-7xl">The Italian homes that never reach the portals.</h1>
          <p className="mt-6 max-w-xl text-lg text-background/80">
            Town halls, notaries and courts publish them in Italian PDFs. We find them, translate every line and help you buy.
          </p>
          <div className="mt-10">
            <Button asChild size="lg" variant="secondary"><Link to="/login">Start exploring <ArrowRight /></Link></Button>
          </div>
        </div>
      </section>
      <footer className="mx-auto max-w-4xl px-4 py-8 text-center text-xs text-muted-foreground">{LEGAL_LINE}</footer>
    </div>
  );
}
