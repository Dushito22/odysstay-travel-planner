import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/odys/AppShell";
import { BudgetSlider, IntentPicker, PaperworkPicker, RegionPicker, TypePicker } from "@/components/odys/prefs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { chooseLang, useLang } from "@/lib/i18n";
import { profileQuery, saveProfile } from "@/lib/profile";
import { cn } from "@/lib/utils";
import { TelegramConnect } from "@/components/odys/TelegramConnect";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profile | Odysstay" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(profileQuery),
  component: ProfilePage,
});

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border bg-card p-6">
      <h2 className="mb-5 text-xl">{title}</h2>
      {children}
    </section>
  );
}

function ProfilePage() {
  const { data: p } = useSuspenseQuery(profileQuery);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const lang = useLang();
  const [weeklyEmail, setWeeklyEmail] = useState(p?.weekly_email ?? true);
  const [fullName, setFullName] = useState(p?.full_name ?? "");
  const [country, setCountry] = useState(p?.home_country ?? "");
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

  // Saves by itself a moment after any change, so Argos (here and on Telegram) always has the latest.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const id = window.setTimeout(() => void save(true), 900);
    return () => window.clearTimeout(id);
  }, [fullName, country, intent, budget, reno, regions, types, paper]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save(quiet = false) {
    setSaving(true);
    try {
      await saveProfile({
        full_name: fullName.trim() || null,
        home_country: country.trim() || null,
        intent,
        budget_max_eur: budget,
        renovation_budget_eur: reno,
        preferred_regions: regions,
        property_types: types,
        ...paper,
      });
      await qc.invalidateQueries({ queryKey: profileQuery.queryKey });
      if (!quiet) toast.success("Profile saved");
      setSavedAt(new Date());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login", search: { mode: "signin" }, replace: true });
  }

  return (
    <>
      <PageHeader title="Profile" intro="What you tell us here, Argos knows: on the site and on Telegram. It saves by itself." />
      <div className="space-y-6">
        <Section title="Language and weekly picks">
          <p className="mb-3 text-sm text-muted-foreground">The site, Argos's chats and calls, Telegram and your weekly picks all use this language.</p>
          <div className="inline-grid grid-cols-2 rounded-full bg-muted p-1 text-[14px]">
            {([["en", "English"], ["ru", "Русский"]] as const).map(([l, label]) => (
              <button key={l} type="button" onClick={() => { chooseLang(l); qc.setQueryData(profileQuery.queryKey, (old) => (old ? { ...old, language: l } : old)); }}
                className={cn("h-9 rounded-full px-5 transition-colors", lang === l ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                {label}
              </button>
            ))}
          </div>
          <label className="mt-5 flex cursor-pointer items-center gap-3 text-[15px]">
            <input type="checkbox" className="h-4 w-4 accent-[var(--color-azure)]" checked={weeklyEmail}
              onChange={(e) => { setWeeklyEmail(e.target.checked); void saveProfile({ weekly_email: e.target.checked }); }} />
            Email me Argos's five picks every Saturday
          </label>
        </Section>
        <Section title="Argos on Telegram"><TelegramConnect /></Section>
        <Section title="About you">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={120} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">Home country</Label>
              <Input id="country" value={country} onChange={(e) => setCountry(e.target.value)} maxLength={80} />
            </div>
          </div>
        </Section>
        <Section title="What's the house for?"><IntentPicker value={intent} onChange={setIntent} /></Section>
        <Section title="Budget">
          <div className="space-y-8">
            <BudgetSlider label="Purchase budget" value={budget} max={500000} onChange={setBudget} />
            <BudgetSlider label="Renovation budget" value={reno} max={300000} onChange={setReno} />
          </div>
        </Section>
        <Section title="Where?"><RegionPicker value={regions} onChange={setRegions} /></Section>
        <Section title="What kind of property?"><TypePicker value={types} onChange={setTypes} /></Section>
        <Section title="Your paperwork"><PaperworkPicker value={paper} onChange={setPaper} /></Section>
        <Section title="Documents and plan">
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline"><Link to="/vault">Open your document vault</Link></Button>
            <Button asChild variant="outline"><Link to="/pricing">{p?.plan === "pro" ? "Pro plan" : "Free plan · see Pro"}</Link></Button>
          </div>
        </Section>
        <div className="flex flex-wrap justify-between gap-3">
          <Button variant="outline" onClick={signOut}>Sign out</Button>
          <span className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{saving ? "Saving…" : savedAt ? "Saved. Argos knows." : "Changes save by themselves."}</span>
            <Button onClick={() => void save()} disabled={saving}>Save</Button>
          </span>
        </div>
      </div>
    </>
  );
}
