import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/i18n";

type O = { omi_zone: string | null; omi_zone_descr: string | null; omi_eur_m2_min: number | null; omi_eur_m2_max: number | null; omi_rent_m2_min: number | null; omi_rent_m2_max: number | null; omi_semester: string | null; omi_match: string | null };

/** The official value per m² for the listing's zone (OMI, Agenzia delle Entrate), next to what this
 * house asks per m². The free OMI copy is from 2018, which the line says. */
export function OmiValue({ listingId, price, sqm }: { listingId: string; price: number | null; sqm: number | null }) {
  const ru = useLang() === "ru";
  const q = useQuery({
    queryKey: ["omi", listingId],
    staleTime: 24 * 3600_000,
    queryFn: async () => {
      const { data } = await supabase.from("listings").select("omi_zone, omi_zone_descr, omi_eur_m2_min, omi_eur_m2_max, omi_rent_m2_min, omi_rent_m2_max, omi_semester, omi_match" as never).eq("id", listingId).maybeSingle();
      return (data ?? null) as unknown as O | null;
    },
  });
  const o = q.data;
  if (!o?.omi_eur_m2_min || !o.omi_eur_m2_max) return null;
  const eur = (n: number) => `€${Math.round(n).toLocaleString(ru ? "ru-RU" : "en-GB")}`;
  const lo = Number(o.omi_eur_m2_min), hi = Number(o.omi_eur_m2_max);
  const ppsqm = price && sqm && sqm > 10 ? price / sqm : null;
  const gap = ppsqm ? Math.round((1 - ppsqm / ((lo + hi) / 2)) * 100) : null;
  const year = (o.omi_semester ?? "2018").slice(0, 4);
  const zone = o.omi_match === "map" ? (o.omi_zone ?? "") : (ru ? `центр, ${o.omi_zone ?? ""}` : `town centre, ${o.omi_zone ?? ""}`);
  return (
    <div className="mt-3 rounded-[12px] border border-foreground/10 bg-card p-4">
      <p className="text-[12px] uppercase tracking-[0.1em] text-foreground/55">{ru ? "Официальная цена зоны" : "Official value for the zone"}</p>
      <p className="mt-2 text-[14px] font-light leading-snug">
        {ru ? <>Налоговая оценивает жильё здесь в {eur(lo)}–{eur(hi)} за м²{o.omi_rent_m2_min ? <>, аренда {o.omi_rent_m2_min}–{o.omi_rent_m2_max} € за м² в месяц</> : null}.</>
          : <>The tax agency values homes here at {eur(lo)} to {eur(hi)} per m²{o.omi_rent_m2_min ? <>, rent at €{o.omi_rent_m2_min} to €{o.omi_rent_m2_max} per m² a month</> : null}.</>}
      </p>
      {gap != null && Math.abs(gap) >= 5 && ppsqm && (
        <p className="mt-1.5 text-[14px] leading-snug">
          {gap > 0
            ? (ru ? `Этот дом просит ${eur(ppsqm)} за м², на ${gap}% ниже середины.` : `This one asks ${eur(ppsqm)} per m², ${gap}% under the middle of that range.`)
            : (ru ? `Этот дом просит ${eur(ppsqm)} за м², на ${-gap}% выше середины.` : `This one asks ${eur(ppsqm)} per m², ${-gap}% above the middle of that range.`)}
        </p>
      )}
      <p className="mt-2 text-[11px] font-light text-foreground/45">
        {ru ? "Источник" : "Source"}: Agenzia delle Entrate, OMI {year} · {zone}{o.omi_zone_descr ? ` · ${o.omi_zone_descr}` : ""}
      </p>
    </div>
  );
}
