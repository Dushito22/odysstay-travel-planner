import { useNavigate } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Plan = {
  id: "free" | "explorer" | "buyer";
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
      { en: "Translations and Argos's take on every house", ru: "Перевод и мнение Argos по каждому дому" },
      { en: "Argos chat and a few minutes of calls a day", ru: "Чат с Argos и несколько минут звонков в день" },
      { en: "1 renovation illustration", ru: "1 иллюстрация ремонта" },
      { en: "1 saved search", ru: "1 сохранённый поиск" },
    ],
  },
  {
    id: "explorer", name: { en: "Explorer", ru: "Explorer" }, monthly: 19,
    blurb: { en: "For when you're shortlisting.", ru: "Когда вы уже выбираете." },
    features: [
      { en: "Everything in Free", ru: "Всё из бесплатного" },
      { en: "Unlimited Argos chat, 30 minutes of calls a month", ru: "Безлимитный чат, 30 минут звонков в месяц" },
      { en: "Argos on Telegram with instant alerts for new matches", ru: "Argos в Telegram и мгновенные уведомления о новых домах" },
      { en: "3 active deals: Argos writes to sellers in Italian, you approve", ru: "3 активные сделки: Argos пишет продавцам по-итальянски, вы одобряете" },
      { en: "15 illustrations a month, unlimited saved searches", ru: "15 иллюстраций в месяц, безлимит сохранённых поисков" },
    ],
  },
  {
    id: "buyer", name: { en: "Buyer", ru: "Buyer" }, monthly: 39, featured: true,
    blurb: { en: "For when you're buying.", ru: "Когда вы покупаете." },
    features: [
      { en: "Everything in Explorer", ru: "Всё из Explorer" },
      { en: "Unlimited deals, messages and follow-ups", ru: "Безлимит сделок, писем и напоминаний" },
      { en: "2 hours of calls with Argos a month", ru: "2 часа звонков с Argos в месяц" },
      { en: "Court reports read for you: occupants, debts, risks", ru: "Отчёты суда прочитаны за вас: жильцы, долги, риски" },
      { en: "Unlimited illustrations", ru: "Безлимит иллюстраций" },
      { en: "A person at Odysstay checks anything binding", ru: "Человек из Odysstay проверяет всё, что вас обязывает" },
    ],
  },
];

/** The three plans. Paid plans collect interest until payments are switched on. */
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
      <div className="mx-auto mt-8 grid max-w-5xl gap-4 md:grid-cols-3">
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
      <p className="mx-auto mt-6 max-w-2xl text-center text-sm text-muted-foreground">
        {ru
          ? "Оплата откроется скоро: запишитесь, и мы сообщим первыми. Сборы коммуны, нотариуса и геометра вы платите им напрямую, Odysstay не держит ваши деньги."
          : "Payments open soon: join the list and you hear first. Fees to the comune, notary or surveyor go straight to them. Odysstay never holds your money."}
      </p>
    </div>
  );
}
