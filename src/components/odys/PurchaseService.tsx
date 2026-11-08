import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PaymentDialog, type PayInfo } from "@/components/odys/PaymentDialog";
import { supabase } from "@/integrations/supabase/client";
import { callFunction } from "@/lib/agent";
import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type ServiceKind = "deal_check" | "remote_purchase" | "search_purchase";

/** Set once a Stripe payment link exists; until then the request is saved and we send the link by email. */
const DEAL_CHECK_PAY = (import.meta.env["VITE_STRIPE_DEAL_CHECK_URL"] as string | undefined) ?? "";

/** Orders a service. Signed out goes to sign-in first; a Deal Check goes on to payment when it's switched on. */
export function useServiceRequest(kind: ServiceKind, listingId?: string) {
  const navigate = useNavigate();
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [order, setOrder] = useState<{ id: string; ref: string; pay: PayInfo } | null>(null);
  async function request() {
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    const back = listingId ? `/listing/${listingId}` : kind === "deal_check" ? "/deal-check" : "/pricing";
    if (!session) { void navigate({ to: "/login", search: { redirect: back } }); return; }
    setState("busy");
    try {
      const r = await callFunction<{ id: string; ref: string; paid?: boolean; pay: PayInfo | null }>("service-request", { kind, listing_id: listingId ?? null });
      if (kind === "deal_check" && DEAL_CHECK_PAY) {
        const u = new URL(DEAL_CHECK_PAY);
        u.searchParams.set("client_reference_id", r.id);
        if (session.user.email) u.searchParams.set("prefilled_email", session.user.email);
        window.location.href = u.toString();
        return;
      }
      if (r.pay) setOrder({ id: r.id, ref: r.ref, pay: r.pay });
      setState("done");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong. Please try again.");
      setState("idle");
    }
  }
  const dialog = order ? <PaymentDialog open onClose={() => setOrder(null)} orderId={order.id} payRef={order.ref} pay={order.pay} /> : null;
  return { state, request, dialog };
}

const BANDS = [
  { upTo: { en: "Houses up to €60k", ru: "Дома до €60 тыс." }, fee: 1900 },
  { upTo: { en: "€60k to €150k", ru: "€60–150 тыс." }, fee: 2900 },
  { upTo: { en: "Above €150k", ru: "Дороже €150 тыс." }, fee: 3900 },
];

/** The fixed fee for buying a house at this price. */
export const purchaseFee = (price: number | null | undefined) =>
  price == null || price <= 60000 ? 1900 : price <= 150000 ? 2900 : 3900;

/** Deal Check, Remote purchase and Search + purchase, under the plans. */
export function ServicesSection({ className }: { className?: string }) {
  const ru = useLang() === "ru";
  const L = ru ? "ru" : "en";
  const check = useServiceRequest("deal_check");
  const remote = useServiceRequest("remote_purchase");
  const search = useServiceRequest("search_purchase");
  const done = ru ? "Записали. Напишем в течение дня." : "Got it. We'll be in touch within a day.";
  return (
    <section className={cn("mx-auto max-w-5xl", className)}>
      <div className="mb-5 text-center">
        <h3 className="font-display text-[28px] leading-tight">{ru ? <>Когда нашли <em className="italic text-azure">тот самый</em> дом</> : <>When you've found <em className="italic text-azure">the one</em></>}</h3>
        <p className="mt-2 text-[15px] font-light text-muted-foreground">
          {ru ? "Фиксированная цена, не процент. Юрист, нотариус, геометра и налоги оплачиваются им напрямую, по их тарифам." : "Fixed fees, not a percentage. Lawyer, notary, surveyor and taxes are paid to them directly, at cost."}
        </p>
      </div>
      {check.dialog}
      <div className="grid gap-4 md:grid-cols-3">
        <ServiceCard
          featured
          startHere={ru ? "Начните отсюда" : "Start here"}
          name={ru ? "Проверка сделки" : "Deal Check"}
          price="€290"
          sub={ru ? "один дом, за 48 часов" : "one house, in 48 hours"}
          blurb={ru ? "Полный разбор одного дома: документы торгов, оценка суда, скрытые расходы и максимальная ставка." : "A full write-up of one house: the auction papers, the court valuation, hidden costs and the most you should bid."}
          points={ru
            ? ["Жильцы, долги, нарушения, сервитуты", "Сколько выйдет всего, до евро", "Максимальная ставка и почему", "Проверено итальянским специалистом", "€290 засчитываются в покупку"]
            : ["Occupants, debts, building issues, easements", "What it really costs, to the euro", "The most to bid, and why", "Signed off by an Italian professional", "The €290 counts toward a purchase"]}
          cta={check.state === "done" ? done : ru ? "Заказать проверку" : "Order a Deal Check"}
          busy={check.state !== "idle"}
          onClick={() => void check.request()}
          extra={<Link to="/deal-check" className="text-[13px] text-azure hover:underline">{ru ? "Посмотреть пример отчёта" : "See a sample report"} →</Link>}
        />
        <ServiceCard
          name={ru ? "Покупка под ключ" : "Remote purchase"}
          price={ru ? "от €1 900" : "from €1,900"}
          sub={ru ? "за дом, фиксированно" : "per house, fixed"}
          blurb={ru ? "Дом, который вы нашли на Odysstay, до подписи у нотариуса, не приезжая." : "A house you found on Odysstay, all the way to the deed, without flying over."}
          points={[
            ...(ru ? ["Codice fiscale, юрист и нотариус", "Подача ставки или предложения", "Перевод всех документов"] : ["Codice fiscale, lawyer and notary", "Bid or offer filed for you", "Every document translated"]),
            ...BANDS.map((b) => `${b.upTo[L]}: €${b.fee.toLocaleString(ru ? "ru-RU" : "en-GB")}`),
          ]}
          cta={remote.state === "done" ? done : ru ? "Хочу расчёт" : "Request a quote"}
          busy={remote.state !== "idle"}
          onClick={() => void remote.request()}
        />
        <ServiceCard
          name={ru ? "Поиск и покупка" : "Search + purchase"}
          price={ru ? "от €2 900" : "from €2,900"}
          sub={ru ? "всё целиком" : "the whole thing"}
          blurb={ru ? "Argos составляет шорт-лист под ваш запрос, затем до трёх проверок сделки, затем покупка." : "Argos builds a shortlist for your brief, then up to three Deal Checks, then the purchase."}
          points={ru ? ["Шорт-лист за неделю", "До 3 проверок сделки", "Покупка под ключ"] : ["Shortlist within a week", "Up to 3 Deal Checks", "The remote purchase"]}
          cta={search.state === "done" ? done : ru ? "Хочу расчёт" : "Request a quote"}
          busy={search.state !== "idle"}
          onClick={() => void search.request()}
        />
      </div>
    </section>
  );
}

function ServiceCard({ name, price, sub, blurb, points, cta, busy, onClick, featured = false, extra, startHere = "Start here" }: {
  name: string; price: string; sub: string; blurb: string; points: string[]; cta: string; busy: boolean; onClick: () => void; featured?: boolean; extra?: React.ReactNode; startHere?: string;
}) {
  return (
    <article className={cn("flex flex-col rounded-2xl border bg-card p-6", featured && "border-azure/50 shadow-[0_18px_40px_-26px_oklch(0.52_0.13_245/0.6)]")}>
      <div className="flex items-center justify-between gap-2">
        <h4 className="font-display text-xl">{name}</h4>
        {featured && <span className="rounded-full bg-azure px-2.5 py-0.5 text-[11px] text-white">{startHere}</span>}
      </div>
      <p className="mt-3 font-display text-4xl leading-none tnum">{price}</p>
      <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
      <p className="mt-3 text-[14px] font-light text-muted-foreground">{blurb}</p>
      <ul className="mt-4 flex-1 space-y-1.5">
        {points.map((p) => (
          <li key={p} className="flex items-start gap-2 text-[13px] font-light leading-snug"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />{p}</li>
        ))}
      </ul>
      <button type="button" onClick={onClick} disabled={busy}
        className={cn("mt-5 h-10 w-full rounded-full text-[14px] transition-colors disabled:opacity-80",
          featured ? "bg-azure text-white hover:bg-azure/90" : "border hover:border-foreground/40")}>
        {cta}
      </button>
      {extra && <div className="mt-3 text-center">{extra}</div>}
    </article>
  );
}

/** Two lines on a listing: check this house, or buy it. */
export function ListingServiceLinks({ listingId, price }: { listingId: string; price: number | null }) {
  const ru = useLang() === "ru";
  const check = useServiceRequest("deal_check", listingId);
  const buy = useServiceRequest("remote_purchase", listingId);
  const fee = purchaseFee(price).toLocaleString(ru ? "ru-RU" : "en-GB");
  return (
    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
      {check.dialog}
      <button type="button" onClick={() => void check.request()} disabled={check.state !== "idle"}
        className="flex items-center justify-center gap-1.5 rounded-full border border-azure/40 px-4 py-2.5 text-[13px] text-azure transition-colors hover:bg-azure-soft disabled:opacity-80">
        {check.state === "done" ? (ru ? "Записали. Напишем сегодня." : "Got it. We'll write today.") : <>{ru ? "Проверка сделки, €290" : "Deal Check, €290"} <ArrowRight className="h-3.5 w-3.5" /></>}
      </button>
      <button type="button" onClick={() => void buy.request()} disabled={buy.state !== "idle"}
        className="rounded-full px-4 py-2.5 text-[13px] text-foreground/70 transition-colors hover:text-foreground disabled:opacity-80">
        {buy.state === "done" ? (ru ? "Записали. Пришлём расчёт." : "Noted. We'll send a quote.") : ru ? `Купить его под ключ, €${fee}` : `Buy it remotely, €${fee}`}
      </button>
    </div>
  );
}
