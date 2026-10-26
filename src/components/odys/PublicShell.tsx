import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { LEGAL_LINE, Wordmark } from "./primitives";

export function PublicFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 md:flex-row md:items-start md:justify-between">
        <div className="max-w-md">
          <Wordmark className="text-xl" />
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{LEGAL_LINE}</p>
        </div>
        <nav
          aria-label="Footer"
          className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground"
        >
          <Link to="/explore" className="hover:text-foreground">
            Explore
          </Link>
          <Link to="/pricing" className="hover:text-foreground">
            Pricing
          </Link>
          <Link to="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
          <Link to="/terms" className="hover:text-foreground">
            Terms
          </Link>
          <a href="mailto:hello@odysstay.com" className="hover:text-foreground">
            hello@odysstay.com
          </a>
        </nav>
      </div>
    </footer>
  );
}

/** Header and footer for public pages (pricing, legal). The landing page has its own hero header. */
export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link to="/" aria-label="Odysstay home">
            <Wordmark className="text-xl" />
          </Link>
          <nav className="flex items-center gap-1">
            <Button asChild variant="ghost" size="sm">
              <Link to="/pricing">Pricing</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/explore">Explore</Link>
            </Button>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-12 md:py-16">{children}</main>
      <PublicFooter />
    </div>
  );
}
