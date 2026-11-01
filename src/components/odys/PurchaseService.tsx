import { useNavigate } from "@tanstack/react-router";
import { FileSignature, HardHat, ShieldCheck, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Saves interest in the purchase service, for one house or in general. Signed out goes to sign-in first. */
function useRequestQuote(listingId?: string) {
  const navigate = useNavigate();
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  async function request() {
    const { data } = await supabase.auth.getSession();
    const uid = data.session?.user.id;
    const back = listingId ? `/listing/${listingId}` : "/pricing";
    if (!uid) { void navigate({ to: "/login", search: { redirect: back } }); return; }
    setState("busy");
    const { error } = await supabase.from("purchase_requests" as never)
      .insert({ user_id: uid, listing_id: listingId ?? null } as never);
    if (error && !/duplicate key/i.test(error.message)) { toast.error(error.message); setState("idle"); return; }
    setState("done");
  }
  return { state, request };
}

const STEPS = [
  { icon: HardHat, en: "A local surveyor (geometra) visits and checks the house, the land registry and the permits", ru: "Местный геометра осматривает дом и проверяет кадастр и разрешения" },
  { icon: Sparkles, en: "Argos runs the offer, the deposit, the documents and every message in Italian", ru: "Argos ведёт предложение, задаток, документы и всю переписку на итальянском" },
  { icon: ShieldCheck, en: "A person at Odysstay checks everything binding before you sign", ru: "Человек из Odysstay проверяет всё, что вас обязывает, до подписи" },
  { icon: FileSignature, en: "You sign at the notary, in person or by power of attorney", ru: "Вы подписываете у нотариуса лично или по доверенности" },
];

/** The wide card under the plans. */
export function PurchaseServiceCard({ className }: { className?: string }) {
  const ru = useLang() === "ru";
  const { state, request } = useRequestQuote();
  return (
    <section className={cn("mx-auto max-w-5xl rounded-2xl border bg-card p-6 md:p-8", className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-display text-2xl">{ru ? "Сопровождение покупки" : "Purchase service"}</h3>
            <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-[11px] text-brand">{ru ? "Скоро" : "Coming soon"}</span>
          </div>
          <p className="mt-2 max-w-xl text-[15px] font-light text-muted-foreground">
            {ru
              ? "Нашли тот самый дом? Мы доведём его от предложения до нотариуса. Фиксированная цена, рассчитанная под конкретный дом, а не процент."
              : "Found the one? We take it from offer to notary. One fixed fee, quoted for that house, not a percentage."}
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-3xl tnum">{ru ? "от €990" : "from €990"}</p>
          <p className="text-xs text-muted-foreground">{ru ? "разово, за дом" : "one-off, per house"}</p>
        </div>
      </div>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {STEPS.map((s) => (
          <li key={s.en} className="flex items-start gap-3 text-[14px] font-light leading-snug">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand"><s.icon className="h-4 w-4" /></span>
            <span className="pt-1">{ru ? s.ru : s.en}</span>
          </li>
        ))}
      </ul>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => void request()} disabled={state !== "idle"}
          className="h-10 rounded-full bg-foreground px-6 text-[15px] text-background transition-colors hover:bg-foreground/85 disabled:opacity-80">
          {state === "done" ? (ru ? "Записали. Напишем вам." : "You're on the list. We'll be in touch.") : ru ? "Хочу расчёт" : "Request a quote"}
        </button>
        <p className="text-xs text-muted-foreground">
          {ru ? "Сборы нотариуса, налоги и работа геометра оплачиваются им напрямую." : "Notary fees, taxes and the surveyor's own fee are paid to them directly."}
        </p>
      </div>
    </section>
  );
}

/** One line on a listing: ask for a quote for this house. */
export function PurchaseQuoteLink({ listingId }: { listingId: string }) {
  const ru = useLang() === "ru";
  const { state, request } = useRequestQuote(listingId);
  return (
    <button type="button" onClick={() => void request()} disabled={state !== "idle"}
      className="mt-3 w-full text-center text-[13px] text-azure hover:underline disabled:no-underline">
      {state === "done"
        ? ru ? "Записали. Пришлём расчёт по этому дому." : "Noted. We'll send a quote for this house."
        : ru ? "Покупаете этот дом? Сопровождение от €990" : "Buying this one? Full purchase service from €990"}
    </button>
  );
}
