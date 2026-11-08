import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Phone } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { openArgos } from "@/components/odys/ArgosDock";
import { ArgosComposer } from "@/components/odys/ArgosComposer";
import { formatEur } from "@/components/odys/primitives";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { FeedRow } from "@/lib/feed";
import { speechLang, useLang } from "@/lib/i18n";
import { startAutopilot, startDeal, UpgradeRequired } from "@/lib/listing";
import { cn } from "@/lib/utils";

/** 1 день, 2 дня, 5 дней */
function ru(n: number, one: string, few: string, many: string) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

/** Argos's read of the listing, from the facts we hold. Never a claim the data can't back. */
export function argosTake(l: FeedRow, lang: "en" | "ru"): string[] {
  const r = lang === "ru";
  const out: string[] = [];
  const d = l.discount_pct;
  if (d != null && d >= 10) out.push(r ? `Цена на ${Math.round(d)}% ниже оценки суда.` : `Priced ${Math.round(d)}% under the court's own valuation.`);
  if (l.min_offer_eur != null && l.price_eur != null && l.min_offer_eur < l.price_eur)
    out.push(r ? `Суд принимает предложения от ${formatEur(l.min_offer_eur)}.` : `The court accepts offers from ${formatEur(l.min_offer_eur)}.`);
  if (l.previous_auction_failed)
    out.push(r ? "Его уже не продали с первого раза, в следующем раунде цена обычно ниже." : "It already failed to sell once. The next round usually opens lower.");
  if (l.sale_type === "sale")
    out.push(r ? "Продаётся через агентство, значит, о цене можно договориться. Первый разговор на итальянском беру на себя." : "Sold through an agency, so the price is open to talk. I'll make the first approach, in Italian.");
  if (l.condition === "ruin") out.push(r ? "Нужен капитальный ремонт: крыша, стены, коммуникации. Посчитайте его до того, как влюбитесь." : "A full renovation: roof, walls, systems. Budget for it before you fall in love.");
  else if (l.condition === "needs_work") out.push(r ? "Нужен ремонт, но основа, судя по описанию, крепкая. Мой расчёт расходов ниже." : "It needs work, but the bones sound solid. My cost estimate is below.");
  else if (l.condition === "ready") out.push(r ? "По описанию можно заезжать и жить." : "Described as ready to live in.");
  if (l.occupancy === "occupied") out.push(r ? "Там ещё живут. До вашей ставки выясню, когда обязаны съехать." : "Someone still lives there. I'll find out when they must leave before you bid.");
  else if (l.occupancy === "free") out.push(r ? "Пустует, жильцов нет." : "Vacant, so no one to move out.");
  const days = l.days_left;
  if (days != null && days > 0 && days <= 30)
    out.push(r ? `До конца приёма предложений ${days} ${ru(days, "день", "дня", "дней")}, действовать нужно быстро.` : `Offers close in ${days} ${days === 1 ? "day" : "days"}, so we move fast.`);
  const flags = Number(l.red_flag_count ?? 0);
  if (flags > 0)
    out.push(r ? `В документах ${flags} ${ru(flags, "пункт", "пункта", "пунктов")} для проверки, список ниже.` : `I found ${flags} ${flags === 1 ? "thing" : "things"} to check in the papers, listed below.`);
  if (!l.has_real_photo) out.push(r ? "Настоящих фото не публиковали. Могу их запросить." : "No real photos were published. I can ask for some.");
  if (!out.length) out.push(r ? "Полные документы я ещё не читал. Спросите меня, и я их разберу." : "I haven't read the full papers yet. Ask me and I'll go through them.");
  return out.slice(0, 4);
}

const QUESTIONS = {
  en: ["What will it really cost me?", "Is anyone living there?", "Can I see it before I buy?"],
  ru: ["Сколько это будет стоить на самом деле?", "Там кто-то живёт?", "Можно посмотреть до покупки?"],
};

function useDeal(listingId: string, userId: string | null) {
  return useQuery({
    queryKey: ["deal-for", listingId, userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("deals").select("id").eq("listing_id", listingId).maybeSingle();
      if (error) throw error;
      return data;
    },
  }).data ?? null;
}

/** One action: Argos takes the deal on (writes to the seller, books the viewing, reads the papers). */
export function ArgosHandleButton({ l, userId, className }: { l: FeedRow; userId: string | null; className?: string }) {
  const r = useLang() === "ru";
  const navigate = useNavigate();
  const deal = useDeal(l.id!, userId);
  const [busy, setBusy] = useState(false);
  async function go() {
    if (!userId) { navigate({ to: "/login", search: { redirect: `/listing/${l.id}` } }); return; }
    if (deal) { navigate({ to: "/deals/$id", params: { id: deal.id } }); return; }
    setBusy(true);
    try {
      const id = await startDeal(l);
      // Argos writes to the seller while the deal page opens; the page follows along.
      void startAutopilot(id).catch(() => {});
      navigate({ to: "/deals/$id", params: { id } });
    } catch (e) {
      if (e instanceof UpgradeRequired)
        toast(r ? "Бесплатный план: одна активная сделка за раз." : "The free plan includes one active deal at a time.", { action: { label: r ? "Тарифы" : "See plans", onClick: () => navigate({ to: "/pricing" }) } });
      else toast.error(r ? "Не получилось. Попробуйте ещё раз." : "Could not start. Please try again.");
    } finally { setBusy(false); }
  }
  return (
    <Button size="lg" onClick={go} disabled={busy} className={className}>
      {deal ? (r ? "Открыть сделку" : "Open your deal") : r ? "Пусть Argos свяжется с продавцом" : "Let Argos contact the seller"}
    </Button>
  );
}

/** The listing's "ask Argos" box: suggested questions, a composer and a call button. All open the Argos dock,
 * which knows which house is on screen. No sign-in needed to ask. */
export function AskArgos({ className }: { l: FeedRow; userId: string | null; className?: string }) {
  const lang = useLang();
  const r = lang === "ru";
  return (
    <div className={cn("grain relative overflow-hidden rounded-[14px] bg-gradient-to-b from-[oklch(0.93_0.02_240)] to-[oklch(0.965_0.01_235)] p-5", className)}>
      <p className="font-display text-[22px] leading-tight">
        {r ? <>Спросите <em className="italic text-azure">Argos</em> об этом доме</> : <>Ask <em className="italic text-azure">Argos</em> about this house</>}
      </p>
      <p className="mt-1 text-[13px] font-light text-foreground/60">
        {r ? "Он прочитал объявление. Пишите или звоните, отвечает на вашем языке." : "He has read the listing. Write or call, he answers in your language."}
      </p>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {QUESTIONS[lang].map((q) => (
          <button key={q} type="button" onClick={() => openArgos({ text: q })}
            className="rounded-full border border-foreground/12 bg-background/70 px-3 py-1.5 text-left text-[13px] font-light transition-colors hover:border-foreground/30 hover:bg-background">
            {q}
          </button>
        ))}
      </div>
      <div className="mt-4">
        <ArgosComposer tone="light" lang={speechLang(lang)} onSubmit={(t) => openArgos({ text: t })}
          placeholder={r ? "Спросите что угодно…" : "Ask anything…"} />
      </div>
      <button type="button" onClick={() => openArgos({ mode: "call" })}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-azure py-2.5 text-[15px] text-white transition-opacity hover:opacity-90">
        <Phone className="h-4 w-4" /> {r ? "Позвонить Argos про этот дом" : "Call Argos about this house"}
      </button>
    </div>
  );
}
