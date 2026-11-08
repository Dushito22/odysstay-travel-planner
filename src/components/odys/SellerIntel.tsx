import { useQuery } from "@tanstack/react-query";
import { MessageCircle, Users } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/i18n";

type Intel = { fact_en: string; fact_ru: string | null; learned_at: string };

/** What sellers told Argo about this house in earlier conversations, and how many buyers are following it.
 * Facts about the house only: never who asked or what they offered. */
export function SellerIntel({ listingId }: { listingId: string }) {
  const ru = useLang() === "ru";
  const q = useQuery({
    queryKey: ["listing-intel", listingId],
    queryFn: async () => {
      const [facts, interest] = await Promise.all([
        supabase.from("listing_intel_public" as never).select("fact_en, fact_ru, learned_at").eq("listing_id", listingId)
          .gt("learned_at", new Date(Date.now() - 60 * 864e5).toISOString()).order("learned_at", { ascending: false }).limit(8),
        supabase.rpc("listing_interest" as never, { target: listingId } as never),
      ]);
      return { facts: (facts.data ?? []) as unknown as Intel[], following: Number(interest.data ?? 0) };
    },
  });
  const d = q.data;
  if (!d || (!d.facts.length && d.following < 2)) return null;
  const latest = d.facts[0]?.learned_at;
  return (
    <div className="mt-3 rounded-[12px] border border-azure/25 bg-azure-soft/50 p-4">
      {d.facts.length > 0 && (
        <>
          <p className="flex items-center gap-1.5 text-[12px] uppercase tracking-[0.1em] text-azure">
            <MessageCircle className="h-3.5 w-3.5" />
            {ru ? "Продавец сообщил Argo" : "The seller told Argo"}
            {latest && <span className="normal-case tracking-normal text-foreground/45">· {new Date(latest).toLocaleDateString(ru ? "ru-RU" : "en-GB", { day: "numeric", month: "short" })}</span>}
          </p>
          <ul className="mt-2 space-y-1">
            {d.facts.map((f, i) => <li key={i} className="text-[14px] font-light leading-snug">{(ru && f.fact_ru) || f.fact_en}</li>)}
          </ul>
        </>
      )}
      {d.following >= 2 && (
        <p className={`flex items-center gap-1.5 text-[13px] text-foreground/70 ${d.facts.length ? "mt-3" : ""}`}>
          <Users className="h-3.5 w-3.5" />
          {ru ? `За этим домом следят покупателей Odysstay: ${d.following}` : `${d.following} Odysstay buyers are following this house`}
        </p>
      )}
    </div>
  );
}
