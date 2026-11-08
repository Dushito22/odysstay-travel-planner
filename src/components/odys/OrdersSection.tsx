import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { useServiceRequest, type ServiceKind } from "@/components/odys/PurchaseService";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Order = { id: string; kind: ServiceKind; status: string; payment_ref: string | null; paid_claimed_at: string | null; created_at: string; listing_id: string | null; listing: { comune: string | null; price_eur: number | null } | null };

const KIND = { en: { deal_check: "Deal Check", remote_purchase: "Remote purchase", search_purchase: "Search + purchase" }, ru: { deal_check: "Проверка сделки", remote_purchase: "Покупка под ключ", search_purchase: "Поиск и покупка" } };

/** The buyer's plan and everything they've ordered, with what's paid and what's waiting. */
export function OrdersSection({ plan }: { plan: string | null | undefined }) {
  const ru = useLang() === "ru";
  const q = useQuery({
    queryKey: ["my-orders"],
    queryFn: async () => {
      const { data } = await supabase.from("purchase_requests" as never)
        .select("id, kind, status, payment_ref, paid_claimed_at, created_at, listing_id, listing:listings(comune, price_eur)")
        .order("created_at", { ascending: false });
      return (data ?? []) as unknown as Order[];
    },
  });
  const paid = plan && plan !== "free";
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted px-4 py-3">
        <div>
          <p className="text-[12px] uppercase tracking-[0.1em] text-foreground/50">{ru ? "Ваш тариф" : "Your plan"}</p>
          <p className="font-display text-[22px] leading-tight">{paid ? (ru ? "Покупатель" : "Buyer") : ru ? "Бесплатно" : "Free"}</p>
        </div>
        {!paid && <Link to="/pricing" className="rounded-full border border-foreground/20 px-4 py-2 text-[13px] hover:border-foreground/40">{ru ? "Тарифы и услуги" : "Plans and services"}</Link>}
      </div>
      {q.data && q.data.length > 0 ? (
        <ul className="divide-y divide-border rounded-xl border">
          {q.data.map((o) => <OrderRow key={o.id} o={o} />)}
        </ul>
      ) : (
        <p className="text-[14px] font-light text-foreground/60">
          {ru ? "Заказов пока нет. Проверку сделки можно заказать на странице любого дома." : "No orders yet. You can order a Deal Check from any house."}
        </p>
      )}
    </div>
  );
}

function OrderRow({ o }: { o: Order }) {
  const lang = useLang();
  const ru = lang === "ru";
  const pay = useServiceRequest(o.kind, o.listing_id ?? undefined);
  const state = o.status === "paid" || o.status === "in_progress" ? { t: ru ? "Оплачено, в работе" : "Paid, in progress", c: "text-success" }
    : o.status === "done" ? { t: ru ? "Готово" : "Done", c: "text-success" }
    : o.status === "cancelled" ? { t: ru ? "Отменено" : "Cancelled", c: "text-foreground/50" }
    : o.paid_claimed_at ? { t: ru ? "Проверяем оплату" : "Checking your payment", c: "text-[oklch(0.55_0.13_45)]" }
    : o.kind === "deal_check" ? { t: ru ? "Ждёт оплаты" : "Awaiting payment", c: "text-[oklch(0.55_0.13_45)]" }
    : { t: ru ? "Готовим расчёт" : "Preparing your quote", c: "text-foreground/60" };
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      {pay.dialog}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px]">{KIND[lang][o.kind]}{o.listing?.comune ? <span className="text-foreground/60"> · {o.listing.comune}</span> : null}</p>
        <p className="text-[12px] font-light text-foreground/50">
          <span className={state.c}>{state.t}</span> · {o.payment_ref ?? ""} · {new Date(o.created_at).toLocaleDateString(ru ? "ru-RU" : "en-GB", { day: "numeric", month: "short" })}
        </p>
      </div>
      {o.kind === "deal_check" && o.status === "new" && !o.paid_claimed_at && (
        <button type="button" onClick={() => void pay.request()} className="shrink-0 rounded-full bg-azure px-3.5 py-1.5 text-[13px] text-white">{ru ? "Оплатить" : "Pay now"}</button>
      )}
    </li>
  );
}
