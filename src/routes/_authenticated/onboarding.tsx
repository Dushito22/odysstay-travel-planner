import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { BudgetSlider, IntentPicker, PaperworkPicker, RegionPicker, TypePicker } from "@/components/odys/prefs";
import { Wordmark } from "@/components/odys/primitives";
import { Button } from "@/components/ui/button";
import { profileQuery, saveProfile, type ProfileUpdate } from "@/lib/profile";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Get started | Odysstay" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(profileQuery),
  component: Onboarding,
});

const TITLES = ["What's the house for?", "Budget", "Where?", "What kind of property?", "Your paperwork"];

function Onboarding() {
  const { data: p } = useSuspenseQuery(profileQuery);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [intent, setIntent] = useState(p?.intent ?? null);
  const [budget, setBudget] = useState(p?.budget_max_eur ?? 100000);
  const [reno, setReno] = useState(p?.renovation_budget_eur ?? 50000);
  const [regions, setRegions] = useState<string[]>(p?.preferred_regions ?? []);
  const [types, setTypes] = useState<string[]>(p?.property_types ?? []);
  const [paper, setPaper] = useState({
    has_codice_fiscale: p?.has_codice_fiscale ?? false,
    has_pec: p?.has_pec ?? false,
    can_move_residency: p?.can_move_residency ?? false,
  });

  const patches: ProfileUpdate[] = [
    { intent },
    { budget_max_eur: budget, renovation_budget_eur: reno },
    { preferred_regions: regions },
    { property_types: types },
    { ...paper, onboarded: true },
  ];

  async function next() {
    setSaving(true);
    try {
      await saveProfile(patches[step] ?? {});
      await qc.invalidateQueries({ queryKey: profileQuery.queryKey });
      if (step === 4) navigate({ to: "/discover" });
      else setStep(step + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-5 py-8">
      <Wordmark className="text-xl" />
      <div className="mt-10 flex gap-2" aria-label={`Step ${step + 1} of 5`}>
        {TITLES.map((t, i) => (
          <span key={t} className={cn("h-2 w-2 rounded-full", i <= step ? "bg-primary" : "bg-border")} />
        ))}
      </div>
      <h1 className="mt-6 text-3xl font-medium md:text-4xl">{TITLES[step]}</h1>
      <div className="mt-8 flex-1">
        {step === 0 && <IntentPicker value={intent} onChange={setIntent} />}
        {step === 1 && (
          <div className="space-y-10">
            <BudgetSlider label="Purchase budget" value={budget} max={500000} onChange={setBudget} />
            <BudgetSlider label="Renovation budget" value={reno} max={300000} onChange={setReno} />
          </div>
        )}
        {step === 2 && <RegionPicker value={regions} onChange={setRegions} />}
        {step === 3 && <TypePicker value={types} onChange={setTypes} />}
        {step === 4 && (
          <>
            <PaperworkPicker value={paper} onChange={setPaper} />
            <p className="mt-4 text-sm text-muted-foreground">Don't worry if not. We'll help you get them.</p>
          </>
        )}
      </div>
      <div className="mt-10 flex justify-between border-t pt-6">
        <Button variant="ghost" onClick={() => setStep(step - 1)} disabled={step === 0 || saving}>
          Back
        </Button>
        <Button onClick={next} disabled={saving || (step === 0 && !intent)}>
          {step === 4 ? "Finish" : "Continue"}
        </Button>
      </div>
    </div>
  );
}
