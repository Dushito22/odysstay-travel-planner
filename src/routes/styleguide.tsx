import { addDays } from "date-fns";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import {
  DeadlinePill, IllustrationLabel, Money, NotStated, ScoreBadge, SourceQuote, Wordmark,
} from "@/components/odys/primitives";
import { Chip } from "@/components/odys/prefs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/styleguide")({
  head: () => ({ meta: [{ title: "Styleguide | Odysstay" }, { name: "robots", content: "noindex" }] }),
  component: Styleguide,
});

const swatches = ["background", "card", "foreground", "muted-foreground", "border", "primary", "brand-soft", "success", "success-soft", "brand", "warning", "warning-soft"];
const swatchClass: Record<string, string> = {
  background: "bg-background", card: "bg-card", foreground: "bg-foreground", "muted-foreground": "bg-muted-foreground",
  border: "bg-border", primary: "bg-primary", "brand-soft": "bg-brand-soft", success: "bg-success",
  "success-soft": "bg-success-soft", brand: "bg-brand", warning: "bg-warning", "warning-soft": "bg-warning-soft",
};

function Panel({ dark }: { dark: boolean }) {
  const [chip, setChip] = useState(true);
  const now = new Date();
  return (
    <div className={cn(dark && "dark")}>
      <div className="space-y-8 bg-background p-8 text-foreground">
        <div className="flex items-baseline justify-between">
          <Wordmark />
          <span className="text-sm text-muted-foreground">{dark ? "Dark" : "Light"}</span>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {swatches.map((s) => (
            <div key={s}>
              <div className={cn("h-12 rounded-md border", swatchClass[s])} />
              <p className="mt-1 text-[11px] text-muted-foreground">{s}</p>
            </div>
          ))}
        </div>
        <div>
          <h1 className="text-4xl font-medium">Casa colonica, Montefalco</h1>
          <p className="mt-2 text-muted-foreground">Inter body copy. Plain, direct English with short sentences.</p>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-2xl">
          <Money value={36000} /> <Money value={1} /> <Money value={null} />
        </div>
        <div className="flex items-center gap-3">
          <ScoreBadge score={82} reasons={["Price per m² well below the comune average", "No previous failed auction"]} />
          <ScoreBadge score={54} reasons={["Occupancy not stated"]} />
          <ScoreBadge score={91} size="sm" />
        </div>
        <div className="flex flex-wrap gap-2">
          <DeadlinePill deadline={addDays(now, 23)} now={now} />
          <DeadlinePill deadline={addDays(now, 5)} now={now} />
          <DeadlinePill deadline={addDays(now, -2)} now={now} />
        </div>
        <div className="rounded-lg border bg-card p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Surface</p>
          <SourceQuote quote="superficie commerciale di mq 142 circa" quoteEn="commercial surface of about 142 m²" page={3} sourceUrl="https://example.org">
            <span className="font-display text-xl tnum">142 m²</span>
          </SourceQuote>
          <p className="mt-4 text-xs uppercase tracking-wide text-muted-foreground">Occupancy</p>
          <NotStated />
        </div>
        <div className="relative h-40 rounded-lg border bg-muted">
          <IllustrationLabel />
        </div>
        <div className="flex flex-wrap gap-3">
          <Button>Primary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Chip active={chip} onClick={() => setChip(!chip)}>Toscana</Chip>
        </div>
        <Input placeholder="Input field" />
      </div>
    </div>
  );
}

function Styleguide() {
  return (
    <div className="grid lg:grid-cols-2">
      <Panel dark={false} />
      <Panel dark />
    </div>
  );
}
