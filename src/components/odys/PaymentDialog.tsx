import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { callFunction } from "@/lib/agent";
import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type PayInfo = {
  amount_eur: number;
  amount_usd: number;
  bank: { name: string; eur: { iban: string; bic: string } | null; gbp: string | null; usd: string | null };
  crypto: { usdt_tron: string | null; usdc_base: string | null };
};

type Method = "eur" | "gbp" | "usd" | "usdt" | "usdc";

/** How to pay for a Deal Check while there's no card checkout: a bank transfer with the order
 * reference, or stablecoins to our address. The buyer then taps "I've paid" and we confirm by hand. */
export function PaymentDialog({ open, onClose, orderId, payRef, pay }: { open: boolean; onClose: () => void; orderId: string; payRef: string; pay: PayInfo }) {
  const ru = useLang() === "ru";
  const methods: { id: Method; label: string }[] = [
    ...(pay.bank.eur ? [{ id: "eur" as const, label: ru ? "Перевод в евро" : "Bank transfer, EUR" }] : []),
    ...(pay.bank.gbp ? [{ id: "gbp" as const, label: "GBP" }] : []),
    ...(pay.bank.usd ? [{ id: "usd" as const, label: "USD" }] : []),
    ...(pay.crypto.usdt_tron ? [{ id: "usdt" as const, label: "USDT · TRON" }] : []),
    ...(pay.crypto.usdc_base ? [{ id: "usdc" as const, label: "USDC · Base" }] : []),
  ];
  const [m, setM] = useState<Method>(ru && pay.crypto.usdt_tron ? "usdt" : methods[0]?.id ?? "eur");
  const [tx, setTx] = useState("");
  const [sent, setSent] = useState(false);
  const crypto = m === "usdt" || m === "usdc";

  async function claim() {
    try {
      await callFunction("service-request", { action: "claim", id: orderId, note: tx });
      setSent(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Please try again.");
    }
  }

  const rows: [string, string][] =
    m === "eur" && pay.bank.eur ? [[ru ? "Получатель" : "Name", pay.bank.name], ["IBAN", pay.bank.eur.iban], ["BIC", pay.bank.eur.bic], [ru ? "Сумма" : "Amount", `€${pay.amount_eur}`], [ru ? "Назначение" : "Reference", payRef]]
    : m === "gbp" ? [[ru ? "Получатель" : "Name", pay.bank.name], [ru ? "Счёт" : "Account", pay.bank.gbp ?? ""], [ru ? "Сумма" : "Amount", `€${pay.amount_eur} ${ru ? "в фунтах по курсу" : "in pounds at today's rate"}`], [ru ? "Назначение" : "Reference", payRef]]
    : m === "usd" ? [[ru ? "Получатель" : "Name", pay.bank.name], [ru ? "Счёт" : "Account", pay.bank.usd ?? ""], [ru ? "Сумма" : "Amount", `$${pay.amount_usd}`], [ru ? "Назначение" : "Reference", payRef]]
    : m === "usdt" ? [[ru ? "Сеть" : "Network", "TRON (TRC20)"], [ru ? "Адрес" : "Address", pay.crypto.usdt_tron ?? ""], [ru ? "Сумма" : "Amount", `${pay.amount_usd} USDT`]]
    : [[ru ? "Сеть" : "Network", "Base"], [ru ? "Адрес" : "Address", pay.crypto.usdc_base ?? ""], [ru ? "Сумма" : "Amount", `${pay.amount_usd} USDC`]];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-[26px] font-normal">{ru ? "Оплата проверки сделки" : "Pay for your Deal Check"}</DialogTitle>
          <DialogDescription>
            {ru ? <>Заказ <b className="text-foreground">{payRef}</b>. Как только оплата придёт, Argos начнёт, отчёт будет у вас в течение 48 часов.</>
              : <>Order <b className="text-foreground">{payRef}</b>. Argos starts as soon as the payment arrives, and the report reaches you within 48 hours.</>}
          </DialogDescription>
        </DialogHeader>
        {sent ? (
          <div className="rounded-xl bg-azure-soft p-5 text-center">
            <Check className="mx-auto h-6 w-6 text-azure" />
            <p className="mt-2 text-[15px]">{ru ? "Спасибо. Проверим оплату и напишем вам." : "Thank you. We'll confirm the payment and email you."}</p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5">
              {methods.map((x) => (
                <button key={x.id} type="button" onClick={() => setM(x.id)}
                  className={cn("h-8 rounded-full border px-3 text-[13px] transition-colors", m === x.id ? "border-foreground bg-foreground text-background" : "border-foreground/15 hover:border-foreground/40")}>
                  {x.label}
                </button>
              ))}
            </div>
            <dl className="divide-y divide-border rounded-xl border">
              {rows.map(([k, v]) => <CopyRow key={k} k={k} v={v} />)}
            </dl>
            <p className="text-[12px] font-light leading-snug text-foreground/55">
              {crypto
                ? (ru ? "Отправляйте только в указанной сети. Перевод в другой сети потеряется." : "Send only on the network shown. Coins sent on another network are lost.")
                : (ru ? "Обязательно укажите номер заказа в назначении платежа. Переводы из российских банков мы принять не можем." : "Put the order number in the payment reference so we can match it.")}
            </p>
            {crypto && (
              <input value={tx} onChange={(e) => setTx(e.target.value)} placeholder={ru ? "ID транзакции (необязательно)" : "Transaction ID (optional)"}
                className="h-10 w-full rounded-lg border bg-background px-3 text-[14px] outline-none focus:border-foreground/40" />
            )}
            <button type="button" onClick={() => void claim()} className="h-11 w-full rounded-full bg-azure text-[15px] text-white hover:bg-azure/90">
              {ru ? "Я оплатил" : "I've paid"}
            </button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CopyRow({ k, v }: { k: string; v: string }) {
  const [ok, setOk] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
      <div className="min-w-0">
        <dt className="text-[11px] uppercase tracking-wide text-foreground/50">{k}</dt>
        <dd className="break-all font-mono text-[13px]">{v}</dd>
      </div>
      <button type="button" aria-label={`Copy ${k}`} onClick={() => { void navigator.clipboard?.writeText(v); setOk(true); setTimeout(() => setOk(false), 1200); }}
        className="shrink-0 rounded-md p-1.5 text-foreground/50 hover:bg-muted hover:text-foreground">
        {ok ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  );
}
