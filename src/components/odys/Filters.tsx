import { SlidersHorizontal, X } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { DEFAULT_FILTERS, TYPE_LABELS, type FeedSearch } from "@/lib/feed";
import { PROPERTY_TYPES, REGIONS } from "@/lib/profile";
import { Chip } from "./prefs";
import { formatEur } from "./primitives";

type Props = { value: FeedSearch; onChange: (patch: Partial<FeedSearch>) => void };

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-3 border-b pb-5 last:border-0">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
      <span>{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

const toggleIn = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

export function FilterPanel({ value: v, onChange }: Props) {
  const set = (p: Partial<FeedSearch>) => onChange({ ...p, prefs: false });
  return (
    <div className="space-y-5">
      <Group title="Region">
        <div className="flex flex-wrap gap-1.5">
          {REGIONS.map((r) => (
            <Chip key={r} active={v.regions.includes(r)} onClick={() => set({ regions: toggleIn(v.regions, r) })}>{r}</Chip>
          ))}
        </div>
      </Group>
      <Group title="Max price">
        <Input
          type="number" inputMode="numeric" min={0} step={5000} placeholder="Any price"
          value={v.maxPrice || ""} onChange={(e) => set({ maxPrice: Math.max(0, Number(e.target.value) || 0) })}
        />
      </Group>
      <Group title="Property type">
        <div className="flex flex-wrap gap-1.5">
          {PROPERTY_TYPES.map((t) => (
            <Chip key={t.value} active={v.types.includes(t.value)} onClick={() => set({ types: toggleIn(v.types, t.value) })}>{t.label}</Chip>
          ))}
        </div>
      </Group>
      <Group title="Min surface m²">
        <Input
          type="number" inputMode="numeric" min={0} step={10} placeholder="Any size"
          value={v.minSurface || ""} onChange={(e) => set({ minSurface: Math.max(0, Number(e.target.value) || 0) })}
        />
      </Group>
      <Group title="Sale type">
        <p className="text-sm">Outright sale</p>
        <Toggle label="Include concessions and leases" checked={v.leases} onChange={(c) => set({ leases: c })} />
        <Toggle label="One-euro schemes" checked={v.oneEuro} onChange={(c) => set({ oneEuro: c })} />
      </Group>
      <Group title="Status">
        <Toggle label="Previously unsold only" checked={v.unsold} onChange={(c) => set({ unsold: c })} />
        <Toggle label="Hide closed" checked={v.hideClosed} onChange={(c) => set({ hideClosed: c })} />
      </Group>
      <Group title={v.minDiscount ? `Below court appraisal: ${v.minDiscount}%+` : "Below court appraisal"}>
        <Slider value={[v.minDiscount]} min={0} max={70} step={5} onValueChange={([d]) => set({ minDiscount: d ?? 0 })} aria-label="Minimum discount below the court appraisal" />
        <p className="text-xs text-muted-foreground">Court sales only: how far the minimum offer sits below the court expert's valuation.</p>
      </Group>
      <Group title={`Min score: ${v.minScore}`}>
        <Slider value={[v.minScore]} min={0} max={100} step={5} onValueChange={([s]) => set({ minScore: s ?? 0 })} aria-label="Minimum score" />
      </Group>
    </div>
  );
}

export function MobileFilters(props: Props) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" className="lg:hidden"><SlidersHorizontal /> Filters</Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-xl">
        <SheetHeader><SheetTitle className="font-display">Filters</SheetTitle></SheetHeader>
        <div className="px-4 pb-6"><FilterPanel {...props} /></div>
      </SheetContent>
    </Sheet>
  );
}

export function FilterChips({ value: v, onChange, onReset }: Props & { onReset: () => void }) {
  const set = (p: Partial<FeedSearch>) => onChange({ ...p, prefs: false });
  const chips: { label: string; clear: () => void }[] = [
    ...v.regions.map((r) => ({ label: r, clear: () => set({ regions: v.regions.filter((x) => x !== r) }) })),
    ...v.types.map((t) => ({ label: TYPE_LABELS[t] ?? t, clear: () => set({ types: v.types.filter((x) => x !== t) }) })),
  ];
  if (v.maxPrice) chips.push({ label: `Up to ${formatEur(v.maxPrice)}`, clear: () => set({ maxPrice: 0 }) });
  if (v.minSurface) chips.push({ label: `From ${v.minSurface} m²`, clear: () => set({ minSurface: 0 }) });
  if (v.minScore) chips.push({ label: `Score ${v.minScore}+`, clear: () => set({ minScore: 0 }) });
  if (v.minDiscount) chips.push({ label: `${v.minDiscount}%+ below appraisal`, clear: () => set({ minDiscount: 0 }) });
  if (v.leases) chips.push({ label: "Concessions and leases", clear: () => set({ leases: false }) });
  if (!v.oneEuro) chips.push({ label: "No one-euro schemes", clear: () => set({ oneEuro: true }) });
  if (v.unsold) chips.push({ label: "Previously unsold", clear: () => set({ unsold: false }) });
  if (!v.hideClosed) chips.push({ label: "Showing closed", clear: () => set({ hideClosed: true }) });

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {v.prefs && (
        <span className="text-muted-foreground">
          Using your preferences,{" "}
          <button className="text-brand underline-offset-4 hover:underline" onClick={onReset}>reset</button>
        </span>
      )}
      {chips.map((c) => (
        <button key={c.label} onClick={c.clear} className="inline-flex items-center gap-1 rounded-full border bg-card px-2.5 py-1 text-xs hover:bg-muted">
          {c.label} <X className="h-3 w-3" />
        </button>
      ))}
    </div>
  );
}

export const RESET_SEARCH: FeedSearch = { ...DEFAULT_FILTERS, sort: "best", prefs: false };
