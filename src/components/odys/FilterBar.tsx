import { ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DEFAULT_FILTERS, SORTS, TYPE_LABELS, type FeedSearch } from "@/lib/feed";
import { useLang } from "@/lib/i18n";
import { PROPERTY_TYPES, REGIONS } from "@/lib/profile";
import { useT } from "@/lib/tr";
import { cn } from "@/lib/utils";
import { FilterPanel } from "./Filters";
import { formatEur } from "./primitives";

type Props = { value: FeedSearch; onChange: (patch: Partial<FeedSearch>) => void; onReset: () => void; right?: ReactNode };

const toggleIn = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
const PRICE_PRESETS = [15000, 30000, 50000, 80000, 120000];
const SIZE_PRESETS = [50, 80, 100, 150];

/** One row of search on top of the results: town, region, price, type, size, quick switches, sort.
 * Everything else lives under "More filters". Scrolls sideways on a phone instead of wrapping. */
export function FilterBar({ value: v, onChange, onReset, right }: Props) {
  const t = useT();
  const ru = useLang() === "ru";
  const set = (p: Partial<FeedSearch>) => onChange({ ...p, prefs: false });
  const [town, setTown] = useState(v.q ?? "");
  useEffect(() => setTown(v.q ?? ""), [v.q]);
  useEffect(() => {
    if (town === (v.q ?? "")) return;
    const id = window.setTimeout(() => set({ q: town }), 350);
    return () => window.clearTimeout(id);
  }, [town]); // eslint-disable-line react-hooks/exhaustive-deps

  const regionLabel = !v.regions.length ? t("All of Italy") : v.regions.length === 1 ? v.regions[0]! : `${v.regions[0]} +${v.regions.length - 1}`;
  const priceLabel = v.minPrice && v.maxPrice ? `${formatEur(v.minPrice)} – ${formatEur(v.maxPrice)}`
    : v.maxPrice ? `${t("Up to")} ${formatEur(v.maxPrice)}` : v.minPrice ? `${t("From")} ${formatEur(v.minPrice)}` : t("Any price");
  const typeLabel = !v.types.length ? t("Any type") : v.types.length === 1 ? t(TYPE_LABELS[v.types[0]!] ?? v.types[0]!) : `${t(TYPE_LABELS[v.types[0]!] ?? "")} +${v.types.length - 1}`;
  const sizeLabel = v.minSurface ? `${v.minSurface}+ m²` : t("Any size");
  const more = v.condition.length + (v.realPhotos ? 1 : 0) + (v.minScore ? 1 : 0) + (v.minDiscount ? 1 : 0) + (v.leases ? 1 : 0) + (v.unsold ? 1 : 0) + (!v.oneEuro ? 1 : 0);
  const touched = v.regions.length || v.types.length || v.minPrice || v.maxPrice || v.minSurface || v.q || v.newDays || (v.kind && v.kind !== "all") || more;

  return (
    <div className="sticky top-0 z-20 -mx-5 border-b border-foreground/10 bg-background/95 px-5 py-3 backdrop-blur md:-mx-10 md:px-10">
      <div className="flex items-center gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] xl:flex-wrap xl:overflow-visible">
        <label className="flex h-9 min-w-[150px] max-w-[220px] flex-1 items-center gap-2 rounded-full border border-foreground/15 bg-card px-3 focus-within:border-foreground/40">
          <Search className="h-3.5 w-3.5 shrink-0 text-foreground/45" />
          <input value={town} onChange={(e) => setTown(e.target.value)} placeholder={t("Town")}
            className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-foreground/45" />
          {town && <button type="button" aria-label="Clear" onClick={() => setTown("")}><X className="h-3 w-3 text-foreground/50" /></button>}
        </label>

        <Drop label={regionLabel} active={!!v.regions.length} width="w-[340px]">
          <div className="flex items-center justify-between">
            <p className="text-[12px] uppercase tracking-[0.1em] text-foreground/50">{t("Region")}</p>
            {!!v.regions.length && <button type="button" className="text-[12px] text-azure" onClick={() => set({ regions: [] })}>{t("All of Italy")}</button>}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5">
            {REGIONS.map((r) => (
              <label key={r} className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-[13px] hover:bg-muted">
                <input type="checkbox" className="accent-[oklch(0.52_0.13_245)]" checked={v.regions.includes(r)} onChange={() => set({ regions: toggleIn(v.regions, r) })} />
                <span className="truncate">{r}</span>
              </label>
            ))}
          </div>
        </Drop>

        <Drop label={priceLabel} active={!!(v.minPrice || v.maxPrice)} width="w-[280px]">
          <p className="text-[12px] uppercase tracking-[0.1em] text-foreground/50">{t("Price")}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {PRICE_PRESETS.map((p) => (
              <Pill key={p} active={v.maxPrice === p && !v.minPrice} onClick={() => set({ minPrice: 0, maxPrice: p })}>{t("Up to")} {formatEur(p)}</Pill>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Num label={t("From")} value={v.minPrice} onChange={(n) => set({ minPrice: n })} />
            <Num label={t("To")} value={v.maxPrice} onChange={(n) => set({ maxPrice: n })} />
          </div>
          {!!(v.minPrice || v.maxPrice) && <button type="button" className="mt-2 text-[12px] text-azure" onClick={() => set({ minPrice: 0, maxPrice: 0 })}>{t("Any price")}</button>}
        </Drop>

        <Drop label={typeLabel} active={!!v.types.length} width="w-[260px]">
          <p className="text-[12px] uppercase tracking-[0.1em] text-foreground/50">{t("Property type")}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {PROPERTY_TYPES.map((pt) => (
              <Pill key={pt.value} active={v.types.includes(pt.value)} onClick={() => set({ types: toggleIn(v.types, pt.value) })}>{t(pt.label)}</Pill>
            ))}
          </div>
        </Drop>

        <Drop label={sizeLabel} active={!!v.minSurface} width="w-[240px]">
          <p className="text-[12px] uppercase tracking-[0.1em] text-foreground/50">{t("Min surface m²")}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Pill active={!v.minSurface} onClick={() => set({ minSurface: 0 })}>{t("Any size")}</Pill>
            {SIZE_PRESETS.map((n) => <Pill key={n} active={v.minSurface === n} onClick={() => set({ minSurface: n })}>{n}+ m²</Pill>)}
          </div>
        </Drop>

        <span className="mx-1 h-5 w-px shrink-0 bg-foreground/15" />
        <Pill active={v.newDays === 7} onClick={() => set({ newDays: v.newDays === 7 ? 0 : 7, ...(v.newDays === 7 ? {} : { sort: "newest" }) })}>{t("New this week")}</Pill>
        <Pill active={v.kind === "private"} onClick={() => set({ kind: v.kind === "private" ? "all" : "private" })}>{t("Private sales")}</Pill>
        <Pill active={v.kind === "auction"} onClick={() => set({ kind: v.kind === "auction" ? "all" : "auction" })}>{t("Auctions")}</Pill>

        <Sheet>
          <SheetTrigger asChild>
            <button type="button" className={cn("inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] transition-colors",
              more ? "border-foreground bg-foreground text-background" : "border-foreground/15 bg-card hover:border-foreground/40")}>
              <SlidersHorizontal className="h-3.5 w-3.5" /> {t("More filters")}{more ? ` · ${more}` : ""}
            </button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-sm">
            <SheetHeader><SheetTitle className="font-display">{t("Filters")}</SheetTitle></SheetHeader>
            <div className="px-4 pb-6"><FilterPanel value={v} onChange={onChange} extrasOnly /></div>
          </SheetContent>
        </Sheet>
        {!!touched && (
          <button type="button" onClick={() => onChange({ ...DEFAULT_FILTERS, prefs: false })} className="shrink-0 px-1 text-[13px] text-foreground/55 hover:text-foreground">{t("Clear")}</button>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-2 pl-2">
          <Select value={v.sort ?? "best"} onValueChange={(s) => onChange({ sort: s })}>
            <SelectTrigger className="h-9 w-auto gap-2 rounded-full text-[13px]" aria-label="Sort"><SelectValue /></SelectTrigger>
            <SelectContent>{SORTS.map((s) => <SelectItem key={s.value} value={s.value}>{t(s.label)}</SelectItem>)}</SelectContent>
          </Select>
          {right}
        </div>
      </div>
      {v.prefs && (
        <p className="mt-2 text-[12px] font-light text-foreground/55">
          {ru ? "Подобрано по вашим предпочтениям, " : "Matched to your preferences, "}
          <button type="button" className="text-azure underline-offset-4 hover:underline" onClick={onReset}>{t("reset")}</button>
        </p>
      )}
    </div>
  );
}

function Drop({ label, active, width, children }: { label: string; active: boolean; width: string; children: ReactNode }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={cn("inline-flex h-9 max-w-[200px] shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] transition-colors",
          active ? "border-foreground bg-foreground text-background" : "border-foreground/15 bg-card hover:border-foreground/40")}>
          <span className="truncate">{label}</span> <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className={cn("p-4", width)}>{children}</PopoverContent>
    </Popover>
  );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick}
      className={cn("inline-flex h-8 shrink-0 items-center rounded-full border px-3 text-[13px] transition-colors",
        active ? "border-foreground bg-foreground text-background" : "border-foreground/15 bg-card hover:border-foreground/40")}>
      {children}
    </button>
  );
}

function Num({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  const [s, setS] = useState(value ? String(value) : "");
  useEffect(() => setS(value ? String(value) : ""), [value]);
  return (
    <label className="block">
      <span className="text-[11px] text-foreground/50">{label}, €</span>
      <input inputMode="numeric" value={s} placeholder="0"
        onChange={(e) => setS(e.target.value.replace(/\D/g, ""))}
        onBlur={() => onChange(Number(s) || 0)} onKeyDown={(e) => e.key === "Enter" && onChange(Number(s) || 0)}
        className="mt-0.5 h-9 w-full rounded-lg border bg-background px-2.5 text-[13px] outline-none focus:border-foreground/40" />
    </label>
  );
}
