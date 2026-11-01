import { createFileRoute } from "@tanstack/react-router";

import { PricingPlans } from "@/components/odys/PricingPlans";
import { PublicShell } from "@/components/odys/PublicShell";
import { useT } from "@/lib/tr";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing | Odysstay" },
      {
        name: "description",
        content:
          "Free to look around every house for sale in Italy. Explorer €19 and Buyer €39 a month when you shortlist and buy.",
      },
      { property: "og:title", content: "Pricing | Odysstay" },
      {
        property: "og:description",
        content: "Free to look around. Explorer €19, Buyer €39 a month.",
      },
    ],
  }),
  component: Pricing,
});

function Pricing() {
  const t = useT();
  return (
    <PublicShell>
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-3xl md:text-4xl">{t("Simple pricing")}</h1>
        <p className="mt-3 text-muted-foreground">
          {t("Free to look around. Pay when you're shortlisting or buying.")}
        </p>
      </div>
      <PricingPlans className="mt-10" />
    </PublicShell>
  );
}
