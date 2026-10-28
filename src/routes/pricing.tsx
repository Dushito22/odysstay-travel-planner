import { createFileRoute, Link } from "@tanstack/react-router";
import { Check } from "lucide-react";

import { PublicShell } from "@/components/odys/PublicShell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PLANS = [
  {
    name: "Free",
    price: "€0",
    period: "",
    blurb: "Explore Italy's hidden market and work one property properly.",
    features: [
      "National feed and map",
      "Full listing pages, every fact sourced from the notice",
      "Agent chat on any listing",
      "1 active deal with plan, messages and quotes",
      "3 illustrations a day",
      "Saved searches with email alerts",
    ],
    cta: { label: "Start free", to: "/discover" as const },
  },
  {
    name: "Pro",
    price: "€29",
    period: "/month",
    blurb: "For buyers working several properties at once.",
    features: [
      "Everything in Free",
      "Unlimited active deals",
      "Unlimited Italian drafting and follow-ups",
      "Unlimited illustrations",
      "Instant alerts when a matching notice appears",
      "Priority processing of new notices",
    ],
    cta: {
      label: "Join the Pro waitlist",
      href: "mailto:hello@odysstay.com?subject=Pro%20waitlist",
    },
    featured: true,
  },
];

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing | Odysstay" },
      {
        name: "description",
        content:
          "Free to explore Italian public property notices. Pro at €29 a month for unlimited deals and drafting.",
      },
      { property: "og:title", content: "Pricing | Odysstay" },
      {
        property: "og:description",
        content: "Free to explore. Pro at €29 a month for unlimited deals and drafting.",
      },
    ],
  }),
  component: Pricing,
});

function Pricing() {
  return (
    <PublicShell>
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-4xl md:text-5xl">Simple pricing</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Free to explore. Pay only when you're working several properties at once.
        </p>
      </div>
      <div className="mx-auto mt-12 grid max-w-4xl gap-6 md:grid-cols-2">
        {PLANS.map((p) => (
          <section
            key={p.name}
            className={cn(
              "flex flex-col rounded-3xl border bg-card p-8",
              p.featured && "border-foreground shadow-hover",
            )}
          >
            <h2 className="text-2xl">{p.name}</h2>
            <p className="mt-4">
              <span className="font-display text-5xl font-semibold tnum">{p.price}</span>
              <span className="text-muted-foreground">{p.period}</span>
            </p>
            <p className="mt-3 text-muted-foreground">{p.blurb}</p>
            <ul className="mt-6 flex-1 space-y-3">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-3 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" /> {f}
                </li>
              ))}
            </ul>
            <div className="mt-8">
              {"to" in p.cta ? (
                <Button asChild size="lg" variant="outline" className="w-full">
                  <Link to={p.cta.to}>{p.cta.label}</Link>
                </Button>
              ) : (
                <Button asChild size="lg" className="w-full">
                  <a href={p.cta.href}>{p.cta.label}</a>
                </Button>
              )}
            </div>
          </section>
        ))}
      </div>
      <p className="mx-auto mt-10 max-w-2xl text-center text-sm text-muted-foreground">
        Fees to the comune, notary, surveyor or other professionals are paid by you directly to
        them. Odysstay never holds your money.
      </p>
    </PublicShell>
  );
}
