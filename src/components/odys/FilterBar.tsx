import { ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DEFAULT_FILTERS, SORTS, TYPE_LABELS, type FeedSearch } from "@/lib/feed";
import { useLang } from "@/lib/i18n";
import { PROPERTY_TYPES, REGIONS } from "@/lib/profile";
import { useT } from "@/lib/tr";
import { cn } from "@/lib/utils";
import { FilterPanel } from "./Filters";
import { formatEur } from "./primitives";

type Props = { value: FeedSearch; onChange: (patch: Partial<FeedSearch>) => void; onReset: () => void; right?: ReactNode; className?: string };

const toggleIn = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
const PRICE_PRESETS = [15000, 30000, 50000, 80000, 120000];
const SIZE_PRESETS = [50, 80, 100, 150];

/** One line of search over the results: town, region, price, type, a blue Filters button for everything
 * else, then sort and save. On a phone: town, Filters and nothing more; the rest moves into the panel. */
export function FilterBar({ value: v, onChange, onReset, right, className }: Props) {
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
  const extra = (v.minSurface ? 1 : 0) + (v.newDays ? 1 : 0) + (v.kind && v.kind !== "all" ? 1 : 0) + v.condition.length + (v.realPhotos ? 1 : 0)
    + (v.minScore ? 1 : 0) + (v.minDiscount ? 1 : 0) + (v.leases ? 1 : 0) + (v.unsold ? 1 : 0) + (!v.oneEuro ? 1 : 0);
  const touched = v.regions.length || v.types.length || v.minPrice || v.maxPrice || v.q || extra;
  const regionPicker = (
    <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
      {REGIONS.map((r) => (
        <label key={r} className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-[13px] hover:bg-muted">
          <input type="checkbox" className="accent-[oklch(0.52_0.13_245)]" checked={v.regions.includes(r)} onChange={() => set({ regions: toggleIn(v.regions, r) })} />
          <span className="truncate">{r}</span>
        </label>
      ))}
    </div>
  );
  const pricePicker = (
    <>
      <div className="flex flex-wrap gap-1.5">
        {PRICE_PRESETS.map((p) => (
          <Pill key={p} active={v.maxPrice === p && !v.minPrice} onClick={() => set({ minPrice: 0, maxPrice: p })}>{t("Up to")} {formatEur(p)}</Pill>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Num label={t("From")} value={v.minPrice} onChange={(n) => set({ minPrice: n })} />
        <Num label={t("To")} value={v.maxPrice} onChange={(n) => set({ maxPrice: n })} />
      </div>
    </>
  );
  const typePicker = (
    <div className="flex flex-wrap gap-1.5">
      {PROPERTY_TYPES.map((pt) => (
        <Pill key={pt.value} active={v.types.includes(pt.value)} onClick={() => set({ types: toggleIn(v.types, pt.value) })}>{t(pt.label)}</Pill>
      ))}
    </div>
  );

  return (
    <div className={cn("sticky top-0 z-20 -mx-5 border-b border-foreground/10 bg-background/95 px-5 py-3 backdrop-blur md:-mx-10 md:px-10", className)}>
      <div className="flex items-center gap-2">
        <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full border border-foreground/15 bg-card px-3.5 focus-within:border-foreground/40 md:max-w-[240px]">
          <Search className="h-4 w-4 shrink-0 text-foreground/45" />
          <input value={town} onChange={(e) => setTown(e.target.value)} placeholder={ru ? "Город или коммуна" : "Town or comune"}
            className="min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-foreground/45" />
          {town && <button type="button" aria-label="Clear" onClick={() => setTown("")}><X className="h-3.5 w-3.5 text-foreground/50" /></button>}
        </label>

        <div className="hidden items-center gap-2 md:flex">
          <Drop label={regionLabel} active={!!v.regions.length} width="w-[340px]">
            {regionPicker}
            {!!v.regions.length && <button type="button" className="mt-2 text-[12px] text-azure" onClick={() => set({ regions: [] })}>{t("All of Italy")}</button>}
          </Drop>
          <Drop label={priceLabel} active={!!(v.minPrice || v.maxPrice)} width="w-[290px]">
            {pricePicker}
            {!!(v.minPrice || v.maxPrice) && <button type="button" className="mt-2 text-[12px] text-azure" onClick={() => set({ minPrice: 0, maxPrice: 0 })}>{t("Any price")}</button>}
          </Drop>
          <Drop label={typeLabel} active={!!v.types.length} width="w-[270px]">{typePicker}</Drop>
        </div>

        <Sheet>
          <SheetTrigger asChild>
            <button type="button" className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-azure px-4 text-[14px] text-white shadow-[0_10px_24px_-14px_oklch(0.52_0.13_245/0.9)] transition-colors hover:bg-azure/90">
              <SlidersHorizontal className="h-4 w-4" />
              <span>{t("Filters")}</span>
              {extra > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1.5 text-[11px] font-medium text-azure">{extra}</span>}
            </button>
          </SheetTrigger>
          <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-[400px]">
            <SheetHeader className="border-b px-5 py-4"><SheetTitle className="font-display text-[24px] font-normal">{t("Filters")}</SheetTitle></SheetHeader>
            <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
              <div className="space-y-6 md:hidden">
                <Section title={t("Region")}>{regionPicker}</Section>
                <Section title={t("Price")}>{pricePicker}</Section>
                <Section title={t("Property type")}>{typePicker}</Section>
              </div>
              <Section title={ru ? "Показать" : "Show"}>
                <div className="flex flex-wrap gap-1.5">
                  <Pill active={v.newDays === 7} onClick={() => set({ newDays: v.newDays === 7 ? 0 : 7, ...(v.newDays === 7 ? {} : { sort: "newest" }) })}>{t("New this week")}</Pill>
                  <Pill active={v.kind === "private"} onClick={() => set({ kind: v.kind === "private" ? "all" : "private" })}>{t("Private sales")}</Pill>
                  <Pill active={v.kind === "auction"} onClick={() => set({ kind: v.kind === "auction" ? "all" : "auction" })}>{t("Auctions")}</Pill>
                </div>
              </Section>
              <Section title={t("Min surface m²")}>
                <div className="flex flex-wrap gap-1.5">
                  <Pill active={!v.minSurface} onClick={() => set({ minSurface: 0 })}>{t("Any size")}</Pill>
                  {SIZE_PRESETS.map((n) => <Pill key={n} active={v.minSurface === n} onClick={() => set({ minSurface: n })}>{n}+ m²</Pill>)}
                </div>
              </Section>
              <FilterPanel value={v} onChange={onChange} extrasOnly />
            </div>
            <div className="flex items-center justify-between gap-3 border-t px-5 py-4">
              <button type="button" disabled={!touched} onClick={() => onChange({ ...DEFAULT_FILTERS, prefs: false })} className="text-[14px] text-foreground/60 hover:text-foreground disabled:opacity-40">{t("Clear")}</button>
              <SheetClose asChild>
                <button type="button" className="h-10 rounded-full bg-azure px-6 text-[14px] text-white hover:bg-azure/90">{ru ? "Показать дома" : "Show houses"}</button>
              </SheetClose>
            </div>
          </SheetContent>
        </Sheet>

        {!!touched && (
          <button type="button" onClick={() => onChange({ ...DEFAULT_FILTERS, prefs: false })} className="hidden shrink-0 px-1 text-[13px] text-foreground/55 hover:text-foreground lg:block">{t("Clear")}</button>
        )}

        <div className="ml-auto hidden shrink-0 items-center gap-2 sm:flex">
          <Select value={v.sort ?? "best"} onValueChange={(s) => onChange({ sort: s })}>
            <SelectTrigger className="h-10 w-auto gap-2 rounded-full border-foreground/15 text-[14px]" aria-label="Sort"><SelectValue /></SelectTrigger>
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

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-2.5 text-[13px] font-medium text-foreground/70">{title}</h3>
      {children}
    </section>
  );
}

function Drop({ label, active, width, children }: { label: string; active: boolean; width: string; children: ReactNode }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={cn("inline-flex h-10 max-w-[190px] shrink-0 items-center gap-1.5 rounded-full border px-4 text-[14px] transition-colors",
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
