import type { ReactNode } from "react";

import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { INTENTS, PROPERTY_TYPES, REGIONS } from "@/lib/profile";
import { cn } from "@/lib/utils";
import { Money } from "./primitives";

export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "h-8 rounded-full border px-3 text-[13px] font-light transition-colors",
        active ? "border-foreground bg-foreground text-background" : "border-foreground/15 bg-card hover:border-foreground/40",
      )}
    >
      {children}
    </button>
  );
}

export function IntentPicker({ value, onChange }: { value: string | null; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {INTENTS.map((i) => (
        <button
          key={i.value}
          type="button"
          aria-pressed={value === i.value}
          onClick={() => onChange(i.value)}
          className={cn(
            "rounded-full border bg-card px-4 py-1.5 text-[15px] font-light transition-colors hover:border-foreground/40",
            value === i.value && "border-foreground bg-foreground text-background",
          )}
        >
          {i.label}
        </button>
      ))}
    </div>
  );
}

export function BudgetSlider({
  label, value, max, onChange,
}: { label: string; value: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">{label}</span>
        <Money value={value} className="text-2xl" showOneEuroChip={false} />
      </div>
      <Slider value={[value]} min={0} max={max} step={5000} onValueChange={([v]) => onChange(v ?? 0)} aria-label={label} />
    </div>
  );
}

export function RegionPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const toggle = (r: string) => onChange(value.includes(r) ? value.filter((x) => x !== r) : [...value, r]);
  return (
    <div className="space-y-4">
      <Chip active={value.length === 0} onClick={() => onChange([])}>All of Italy</Chip>
      <div className="flex flex-wrap gap-2">
        {REGIONS.map((r) => (
          <Chip key={r} active={value.includes(r)} onClick={() => toggle(r)}>{r}</Chip>
        ))}
      </div>
    </div>
  );
}

export function TypePicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const toggle = (t: string) => onChange(value.includes(t) ? value.filter((x) => x !== t) : [...value, t]);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {PROPERTY_TYPES.map((t) => (
          <Chip key={t.value} active={value.includes(t.value)} onClick={() => toggle(t.value)}>{t.label}</Chip>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">None selected means any type.</p>
    </div>
  );
}

export type Paperwork = { has_codice_fiscale: boolean; has_pec: boolean; can_move_residency: boolean };

const PAPER_ITEMS: { key: keyof Paperwork; label: string }[] = [
  { key: "has_codice_fiscale", label: "I have a codice fiscale (Italian tax number)" },
  { key: "has_pec", label: "I have a PEC (certified email, needed for some official bids)" },
  { key: "can_move_residency", label: "I could move my official residence to Italy (some grants require it)" },
];

export function PaperworkPicker({ value, onChange }: { value: Paperwork; onChange: (v: Paperwork) => void }) {
  return (
    <div className="divide-y rounded-2xl border bg-card">
      {PAPER_ITEMS.map((p) => (
        <label key={p.key} className="flex cursor-pointer items-center justify-between gap-4 p-4 text-sm">
          <span>{p.label}</span>
          <Switch checked={value[p.key]} onCheckedChange={(c) => onChange({ ...value, [p.key]: c })} />
        </label>
      ))}
    </div>
  );
}
