import { useNavigate } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ServicesSection } from "@/components/odys/PurchaseService";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Plan = {
  id: "free" | "buyer";
  name: { en: string; ru: string };
  monthly: number;
  blurb: { en: string; ru: string };
  features: { en: string; ru: string }[];
  featured?: boolean;
};

const PLANS: Plan[] = [
  {
    id: "free", name: { en: "Free", ru: "Бесплатно" }, monthly: 0,
    blurb: { en: "Look around properly, at no cost.", ru: "Спокойно осмотреться, бесплатно." },
    features: [
      { en: "Every listing in Italy, map and deal score", ru: "Все объявления Италии, карта и оценка сделки" },
      { en: "The catch and the full cost on every house", ru: "Минусы и полная стоимость по каждому дому" },
      { en: "Argos's five picks every Saturday, with a voice note", ru: "5 домов от Argos каждую субботу, с голосовым" },
      { en: "Chat with Argos, here and on Telegram", ru: "Чат с Argos здесь и в Telegram" },
      { en: "1 renovation illustration, 1 saved search", ru: "1 иллюстрация ремонта, 1 сохранённый поиск" },
    ],
  },
  {
    id: "buyer", name: { en: "Buyer", ru: "Покупатель" }, monthly: 29, featured: true,
    blurb: { en: "For when you're serious.", ru: "Когда вы всерьёз." },
    features: [
      { en: "Everything in Free", ru: "Всё из бесплатного" },
      { en: "Calls with Argos, 2 hours a month", ru: "Звонки с Argos, 2 часа в месяц" },
      { en: "Argos writes to sellers in Italian; anything about price or visits needs your OK", ru: "Argos пишет продавцам по-итальянски; цена и визиты только с вашего «да»" },
      { en: "Court reports read for you: occupants, debts, risks", ru: "Отчёты суда прочитаны за вас: жильцы, долги, риски" },
      { en: "Your picks on Thursday, two days before everyone", ru: "Подборка в четверг, на два дня раньше всех" },
      { en: "Unlimited illustrations and saved searches", ru: "Безлимит иллюстраций и сохранённых поисков" },
      { en: "What you've paid counts toward a Deal Check or purchase", ru: "Оплаченное засчитывается в проверку сделки или покупку" },
    ],
  },
];

/** Free and Buyer, then the services. The paid plan collects interest until payments are switched on. */
export function PricingPlans({ className }: { className?: string }) {
  const ru = useLang() === "ru";
  const L = ru ? "ru" : "en";
  const navigate = useNavigate();
  const [yearly, setYearly] = useState(false);
  const [joined, setJoined] = useState<string | null>(null);

  async function join(p: Plan) {
    if (p.id === "free") { void navigate({ to: "/discover" }); return; }
    const { data } = await supabase.auth.getSession();
    const uid = data.session?.user.id;
    if (!uid) { void navigate({ to: "/login", search: { redirect: "/pricing" } }); return; }
    const { error } = await supabase.from("plan_waitlist" as never).upsert({ user_id: uid, plan: p.id, billing: yearly ? "yearly" : "monthly" } as never);
    if (error) { toast.error(error.message); return; }
    setJoined(p.id);
  }

  return (
    <div className={className}>
      <div className="flex justify-center">
        <div className="inline-flex rounded-full bg-muted p-1 text-sm">
          {[false, true].map((y) => (
            <button key={String(y)} type="button" onClick={() => setYearly(y)}
              className={cn("rounded-full px-4 py-1 transition-colors", yearly === y ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              {y ? (ru ? "За год · 2 месяца в подарок" : "Yearly · 2 months free") : ru ? "Помесячно" : "Monthly"}
            </button>
          ))}
        </div>
      </div>
      <div className="mx-auto mt-8 grid max-w-3xl gap-4 md:grid-cols-2">
        {PLANS.map((p) => {
          const price = yearly && p.monthly ? Math.round((p.monthly * 10) / 12) : p.monthly;
          return (
            <section key={p.id} className={cn("flex flex-col rounded-2xl border bg-card p-6", p.featured && "border-foreground shadow-hover")}>
              <div className="flex items-center justify-between">
                <h3 className="font-display text-xl">{p.name[L]}</h3>
                {p.featured && <span className="rounded-full bg-foreground px-2.5 py-0.5 text-[11px] text-background">{ru ? "Для покупки" : "Most useful"}</span>}
              </div>
              <p className="mt-3 flex items-baseline gap-1">
                <span className="font-display text-4xl tnum">€{price}</span>
                {p.monthly > 0 && <span className="text-sm text-muted-foreground">{ru ? "/мес" : "/month"}</span>}
              </p>
              <p className="mt-1 h-4 text-xs text-muted-foreground">
                {yearly && p.monthly > 0 ? (ru ? `€${p.monthly * 10} в год` : `€${p.monthly * 10} billed yearly`) : ""}
              </p>
              <p className="mt-2 text-[15px] font-light text-muted-foreground">{p.blurb[L]}</p>
              <ul className="mt-4 flex-1 space-y-2">
                {p.features.map((f) => (
                  <li key={f.en} className="flex items-start gap-2 text-[14px] font-light leading-snug">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" /> {f[L]}
                  </li>
                ))}
              </ul>
              <button type="button" onClick={() => void join(p)} disabled={joined === p.id}
                className={cn("mt-6 h-10 w-full rounded-full text-[15px] transition-colors",
                  p.featured ? "bg-foreground text-background hover:bg-foreground/85" : "border hover:border-foreground/40")}>
                {joined === p.id
                  ? ru ? "Вы в списке. Напишем, когда откроем." : "You're on the list. We'll write when it opens."
                  : p.id === "free" ? (ru ? "Начать бесплатно" : "Start free")
                  : ru ? "Хочу этот тариф" : "I want this plan"}
              </button>
            </section>
          );
        })}
      </div>
      <ServicesSection className="mt-14" />
      <p className="mx-auto mt-6 max-w-2xl text-center text-sm text-muted-foreground">
        {ru
          ? "Подписка откроется скоро: запишитесь, и мы сообщим первыми. Odysstay не держит ваши деньги: сборы нотариуса, юриста и геометра идут им напрямую."
          : "The Buyer plan opens soon: join the list and you hear first. Odysstay never holds your money: notary, lawyer and surveyor fees go straight to them."}
      </p>
    </div>
  );
}
