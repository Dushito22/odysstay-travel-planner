import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/i18n";

type B = { level: string; name: string; category: string; active_auctions: number | null; starting_price_median: number | null; average_price_cut_pct: number | null; updated_at: string | null };

const CATEGORY: Record<string, string> = { apartment: "appartamento", land: "terreno", building: "fabbricato", rural_house: "rurale", commercial: "negozio" };

/** How this auction compares with live court auctions in its region, from ImmobilScan's open
 * observatory (CC BY 4.0, credited with its update date as the licence asks). */
export function AuctionBenchmark({ region, type, price }: { region: string | null; type: string | null; price: number | null }) {
  const ru = useLang() === "ru";
  const q = useQuery({
    queryKey: ["auction-benchmark", region],
    staleTime: 6 * 3600_000,
    queryFn: async () => {
      const { data } = await supabase.from("auction_benchmarks" as never).select("level, name, category, active_auctions, starting_price_median, average_price_cut_pct, updated_at");
      return (data ?? []) as unknown as B[];
    },
  });
  const all = q.data ?? [];
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[^a-z]/g, "");
  const reg = region ? all.find((b) => b.level !== "italy" && !b.category && norm(b.name) === norm(region)) : undefined;
  const cat = type && CATEGORY[type] ? all.find((b) => b.level === "italy" && b.category === CATEGORY[type]) : undefined;
  const base = reg ?? all.find((b) => b.level === "italy" && !b.category);
  if (!base) return null;
  const eur = (n: number) => `€${Math.round(n).toLocaleString(ru ? "ru-RU" : "en-GB")}`;
  const median = cat?.starting_price_median ?? base.starting_price_median;
  const vs = price && median ? Math.round((1 - price / median) * 100) : null;
  const date = base.updated_at ? new Date(base.updated_at).toLocaleDateString(ru ? "ru-RU" : "en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";
  const where = reg ? reg.name : ru ? "Италии" : "Italy";
  return (
    <div className="mt-3 rounded-[12px] border border-foreground/10 bg-card p-4">
      <p className="text-[12px] uppercase tracking-[0.1em] text-foreground/55">{ru ? "Торги в регионе" : "Court auctions nearby"}</p>
      <p className="mt-2 text-[14px] font-light leading-snug">
        {ru
          ? <>Сейчас в {where} {base.active_auctions?.toLocaleString("ru-RU")} торгов, медианная стартовая цена {base.starting_price_median ? eur(base.starting_price_median) : "—"}. Лоты, ушедшие на новый тур, подешевели в среднем на {Math.round(base.average_price_cut_pct ?? 0)}%.</>
          : <>{base.active_auctions?.toLocaleString("en-GB")} live auctions in {where}, median starting price {base.starting_price_median ? eur(base.starting_price_median) : "n/a"}. Lots that went to another round dropped {Math.round(base.average_price_cut_pct ?? 0)}% on average.</>}
      </p>
      {vs != null && Math.abs(vs) >= 5 && (
        <p className="mt-1.5 text-[14px] leading-snug">
          {vs > 0
            ? (ru ? `Этот лот на ${vs}% дешевле медианы${cat ? " для такого типа" : ""}.` : `This one starts ${vs}% below the median${cat ? " for its type" : ""}.`)
            : (ru ? `Этот лот на ${-vs}% дороже медианы${cat ? " для такого типа" : ""}.` : `This one starts ${-vs}% above the median${cat ? " for its type" : ""}.`)}
        </p>
      )}
      <p className="mt-2 text-[11px] font-light text-foreground/45">
        {ru ? "Источник" : "Source"}: <a href="https://immobilscan.it" target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">ImmobilScan</a>{ru ? ", данные Portale delle Vendite Pubbliche" : ", Public Sales Portal data"} · CC BY 4.0{date ? ` · ${date}` : ""}
      </p>
    </div>
  );
}
