import { SlidersHorizontal, X } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { CONDITION_LABELS, DEFAULT_FILTERS, TYPE_LABELS, type FeedSearch } from "@/lib/feed";
import { useT } from "@/lib/tr";
import { PROPERTY_TYPES, REGIONS } from "@/lib/profile";
import { Chip } from "./prefs";
import { formatEur } from "./primitives";

type Props = { value: FeedSearch; onChange: (patch: Partial<FeedSearch>) => void };

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-3 border-b border-foreground/10 pb-5 last:border-0 last:pb-0">
      <p className="type-label text-[11px] text-foreground/55">{title}</p>
      {children}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 text-[14px] font-light">
      <span>{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

const toggleIn = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

export function FilterPanel({ value: v, onChange }: Props) {
  const t = useT();
  const set = (p: Partial<FeedSearch>) => onChange({ ...p, prefs: false });
  return (
    <div className="space-y-5">
      <Group title={t("Region")}>
        <div className="flex flex-wrap gap-1.5">
          {REGIONS.map((r) => (
            <Chip key={r} active={v.regions.includes(r)} onClick={() => set({ regions: toggleIn(v.regions, r) })}>{r}</Chip>
          ))}
        </div>
      </Group>
      <Group title={t("Max price")}>
        <Input
          type="number" inputMode="numeric" min={0} step={5000} placeholder={t("Any price")}
          value={v.maxPrice || ""} onChange={(e) => set({ maxPrice: Math.max(0, Number(e.target.value) || 0) })}
        />
      </Group>
      <Group title={t("Property type")}>
        <div className="flex flex-wrap gap-1.5">
          {PROPERTY_TYPES.map((pt) => (
            <Chip key={pt.value} active={v.types.includes(pt.value)} onClick={() => set({ types: toggleIn(v.types, pt.value) })}>{t(pt.label)}</Chip>
          ))}
        </div>
      </Group>
      <Group title={t("State of the property")}>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(CONDITION_LABELS).map(([k, label]) => (
            <Chip key={k} active={v.condition.includes(k)} onClick={() => set({ condition: toggleIn(v.condition, k) })}>{t(label)}</Chip>
          ))}
        </div>
        <Toggle label={t("Real photos only")} checked={v.realPhotos} onChange={(c) => set({ realPhotos: c })} />
      </Group>
      <Group title={t("Min surface m²")}>
        <Input
          type="number" inputMode="numeric" min={0} step={10} placeholder={t("Any size")}
          value={v.minSurface || ""} onChange={(e) => set({ minSurface: Math.max(0, Number(e.target.value) || 0) })}
        />
      </Group>
      <Group title={t("Sale type")}>
        <p className="text-[14px] font-light text-foreground/60">Outright sales always included</p>
        <Toggle label="Include concessions and leases" checked={v.leases} onChange={(c) => set({ leases: c })} />
        <Toggle label="One-euro schemes" checked={v.oneEuro} onChange={(c) => set({ oneEuro: c })} />
      </Group>
      <Group title={t("Status")}>
        <Toggle label="Previously unsold only" checked={v.unsold} onChange={(c) => set({ unsold: c })} />
        <Toggle label="Hide closed" checked={v.hideClosed} onChange={(c) => set({ hideClosed: c })} />
      </Group>
      <Group title={v.minDiscount ? `Below court appraisal: ${v.minDiscount}%+` : t("Below court appraisal")}>
        <Slider value={[v.minDiscount]} min={0} max={70} step={5} onValueChange={([d]) => set({ minDiscount: d ?? 0 })} aria-label="Minimum discount below the court appraisal" />
        <p className="text-[12px] font-light leading-relaxed text-foreground/55">Court sales only: how far the minimum offer sits below the court expert's valuation.</p>
      </Group>
      <Group title={`${t("Min score")}: ${v.minScore}`}>
        <Slider value={[v.minScore]} min={0} max={100} step={5} onValueChange={([s]) => set({ minScore: s ?? 0 })} aria-label="Minimum score" />
      </Group>
    </div>
  );
}

export function MobileFilters(props: Props) {
  const t = useT();
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" className="lg:hidden"><SlidersHorizontal /> {t("Filters")}</Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-xl">
        <SheetHeader><SheetTitle className="font-display">{t("Filters")}</SheetTitle></SheetHeader>
        <div className="px-4 pb-6"><FilterPanel {...props} /></div>
      </SheetContent>
    </Sheet>
  );
}

export function FilterChips({ value: v, onChange, onReset }: Props & { onReset: () => void }) {
  const t = useT();
  const set = (p: Partial<FeedSearch>) => onChange({ ...p, prefs: false });
  const chips: { label: string; clear: () => void }[] = [
    ...v.regions.map((r) => ({ label: r, clear: () => set({ regions: v.regions.filter((x) => x !== r) }) })),
    ...v.types.map((ty) => ({ label: t(TYPE_LABELS[ty] ?? ty), clear: () => set({ types: v.types.filter((x) => x !== ty) }) })),
  ];
  v.condition.forEach((k) => chips.push({ label: t(CONDITION_LABELS[k] ?? k), clear: () => set({ condition: v.condition.filter((x) => x !== k) }) }));
  if (v.realPhotos) chips.push({ label: t("Real photos only"), clear: () => set({ realPhotos: false }) });
  if (v.maxPrice) chips.push({ label: `Up to ${formatEur(v.maxPrice)}`, clear: () => set({ maxPrice: 0 }) });
  if (v.minSurface) chips.push({ label: `From ${v.minSurface} m²`, clear: () => set({ minSurface: 0 }) });
  if (v.minScore) chips.push({ label: `Score ${v.minScore}+`, clear: () => set({ minScore: 0 }) });
  if (v.minDiscount) chips.push({ label: `${v.minDiscount}%+ below appraisal`, clear: () => set({ minDiscount: 0 }) });
  if (v.leases) chips.push({ label: "Concessions and leases", clear: () => set({ leases: false }) });
  if (!v.oneEuro) chips.push({ label: "No one-euro schemes", clear: () => set({ oneEuro: true }) });
  if (v.unsold) chips.push({ label: "Previously unsold", clear: () => set({ unsold: false }) });
  if (!v.hideClosed) chips.push({ label: "Showing closed", clear: () => set({ hideClosed: true }) });

  return (
    <div className="flex flex-wrap items-center gap-2 text-[14px] font-light">
      {v.prefs && (
        <span className="mr-1 text-foreground/55">
          {t("Using your preferences,")}{" "}
          <button className="text-azure underline-offset-4 hover:underline" onClick={onReset}>{t("reset")}</button>
        </span>
      )}
      {chips.map((c) => (
        <button key={c.label} onClick={c.clear} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-foreground/15 bg-card px-3 text-[13px] font-light transition-colors hover:border-foreground/40">
          {c.label} <X className="h-3 w-3" />
        </button>
      ))}
    </div>
  );
}

export const RESET_SEARCH: FeedSearch = { ...DEFAULT_FILTERS, sort: "best", prefs: false };
