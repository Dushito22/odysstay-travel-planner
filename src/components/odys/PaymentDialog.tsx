import { Check, Copy } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { callFunction } from "@/lib/agent";
import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type PayOption = { coin: "USDT" | "USDC"; network: string; label: string; address: string };
export type PayInfo = { amount_eur: number; amount_usd: number; options: PayOption[] };

/** Paying for a Deal Check in stablecoins: pick the coin, pick the network, scan the QR or copy the
 * address. Card and bank payments are still being set up, so those buyers ask for a link instead. */
export function PaymentDialog({ open, onClose, orderId, payRef, pay }: { open: boolean; onClose: () => void; orderId: string; payRef: string; pay: PayInfo }) {
  const ru = useLang() === "ru";
  const coins = useMemo(() => [...new Set(pay.options.map((o) => o.coin))], [pay.options]);
  const [coin, setCoin] = useState(coins[0] ?? "USDT");
  const nets = pay.options.filter((o) => o.coin === coin);
  const [net, setNet] = useState(nets[0]?.network ?? "");
  const opt = nets.find((o) => o.network === net) ?? nets[0];
  const [qr, setQr] = useState("");
  const [tx, setTx] = useState("");
  const [done, setDone] = useState<null | "paid" | "card">(null);

  useEffect(() => { setNet(pay.options.find((o) => o.coin === coin)?.network ?? ""); }, [coin, pay.options]);
  useEffect(() => {
    if (!opt) return;
    void QRCode.toDataURL(opt.address, { margin: 1, width: 360, color: { dark: "#141414", light: "#ffffff" } }).then(setQr).catch(() => setQr(""));
  }, [opt?.address]); // eslint-disable-line react-hooks/exhaustive-deps

  async function send(action: "claim" | "card") {
    try {
      await callFunction("service-request", { action, id: orderId, note: tx });
      setDone(action === "claim" ? "paid" : "card");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Please try again.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92svh] overflow-y-auto p-5 sm:max-w-[420px] sm:p-6">
        <DialogHeader className="text-left">
          <DialogTitle className="font-display text-[26px] font-normal leading-tight">{ru ? "Оплата проверки сделки" : "Pay for your Deal Check"}</DialogTitle>
          <DialogDescription className="text-[13px]">
            {ru ? <>Заказ <span className="font-medium text-foreground">{payRef}</span> · отчёт в течение 48 часов после оплаты</> : <>Order <span className="font-medium text-foreground">{payRef}</span> · report within 48 hours of payment</>}
          </DialogDescription>
        </DialogHeader>

        {done ? (
          <div className="rounded-2xl bg-azure-soft p-6 text-center">
            <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-azure text-white"><Check className="h-5 w-5" /></span>
            <p className="mt-3 text-[15px] leading-snug">
              {done === "paid"
                ? (ru ? "Спасибо. Как только платёж придёт, Argos начнёт работу, и мы напишем вам." : "Thank you. Argos starts as soon as the payment lands, and we'll email you.")
                : (ru ? "Пришлём ссылку на оплату картой на вашу почту в течение нескольких часов." : "We'll email you a card payment link within a few hours.")}
            </p>
          </div>
        ) : opt ? (
          <>
            <div className="grid grid-cols-2 gap-1 rounded-full bg-muted p-1 text-[14px]">
              {coins.map((c) => (
                <button key={c} type="button" onClick={() => setCoin(c)}
                  className={cn("h-9 rounded-full transition-colors", coin === c ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}>{c}</button>
              ))}
            </div>
            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
              {nets.map((o) => (
                <button key={o.network} type="button" onClick={() => setNet(o.network)}
                  className={cn("h-8 shrink-0 rounded-full border px-3 text-[13px] transition-colors", opt.network === o.network ? "border-foreground bg-foreground text-background" : "border-foreground/15 hover:border-foreground/40")}>
                  {o.label}
                </button>
              ))}
            </div>

            <div className="rounded-2xl border bg-card p-4">
              <div className="flex items-center gap-4">
                {qr ? <img src={qr} alt="" className="h-28 w-28 shrink-0 rounded-lg border sm:h-32 sm:w-32" /> : <div className="h-28 w-28 shrink-0 rounded-lg bg-muted sm:h-32 sm:w-32" />}
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-[0.1em] text-foreground/50">{ru ? "Сумма" : "Amount"}</p>
                  <p className="font-display text-[30px] leading-none tnum">{pay.amount_usd} <span className="text-[16px]">{coin}</span></p>
                  <p className="mt-1 text-[12px] font-light text-foreground/55">≈ €{pay.amount_eur} · {opt.label}</p>
                </div>
              </div>
              <CopyLine label={ru ? "Адрес" : "Address"} value={opt.address} />
            </div>
            <p className="text-[12px] font-light leading-snug text-[oklch(0.55_0.13_45)]">
              {ru ? `Отправляйте только ${coin} в сети ${opt.label}. Монеты в другой сети потеряются.` : `Send only ${coin} on ${opt.label}. Coins sent on another network are lost.`}
            </p>
            <input value={tx} onChange={(e) => setTx(e.target.value)} placeholder={ru ? "ID транзакции (необязательно)" : "Transaction ID (optional)"}
              className="h-10 w-full rounded-xl border bg-background px-3 text-[14px] outline-none focus:border-foreground/40" />
            <button type="button" onClick={() => void send("claim")} className="h-12 w-full rounded-full bg-azure text-[15px] text-white transition-colors hover:bg-azure/90">
              {ru ? "Я оплатил" : "I've paid"}
            </button>
            <p className="text-center text-[12px] font-light text-foreground/50">
              {ru ? "Оплата картой и переводом скоро. " : "Card and bank payments are warming up. "}
              <button type="button" onClick={() => void send("card")} className="text-azure underline-offset-2 hover:underline">{ru ? "Прислать ссылку для оплаты картой" : "Email me a card link instead"}</button>
            </p>
          </>
        ) : (
          <div className="space-y-3">
            <p className="text-[14px] font-light">{ru ? "Онлайн-оплата скоро. Пришлём ссылку для оплаты на почту." : "Online payment is warming up. We'll email you a payment link."}</p>
            <button type="button" onClick={() => void send("card")} className="h-12 w-full rounded-full bg-azure text-[15px] text-white">{ru ? "Прислать ссылку" : "Email me a link"}</button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CopyLine({ label, value }: { label: string; value: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button type="button" onClick={() => { void navigator.clipboard?.writeText(value); setOk(true); setTimeout(() => setOk(false), 1400); }}
      className="mt-3 flex w-full items-center justify-between gap-3 rounded-xl bg-muted px-3 py-2.5 text-left transition-colors hover:bg-muted/70">
      <span className="min-w-0">
        <span className="block text-[11px] uppercase tracking-[0.1em] text-foreground/50">{label}</span>
        <span className="block break-all font-mono text-[12.5px] leading-snug">{value}</span>
      </span>
      {ok ? <Check className="h-4 w-4 shrink-0 text-success" /> : <Copy className="h-4 w-4 shrink-0 text-foreground/50" />}
    </button>
  );
}
