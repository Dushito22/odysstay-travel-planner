import { useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Mail, MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import type { DealBundle } from "@/lib/deal";
import { useLang } from "@/lib/i18n";
import { draftFirstMessage } from "@/lib/listing";
import { cn } from "@/lib/utils";

/** One card at the top of a deal that says, in plain words, what Argos is doing and what he needs. */
export function ArgosStatus({ bundle, onOpenConversations }: { bundle: DealBundle; onOpenConversations: () => void }) {
  const ru = useLang() === "ru";
  const qc = useQueryClient();
  const { deal, threads, messages, listing } = bundle;
  const [asking, setAsking] = useState(false);
  const outbound = messages.filter((m) => m.direction === "outbound");
  const waiting = outbound.find((m) => m.status === "awaiting_approval");
  const sent = [...outbound].filter((m) => m.status === "sent").sort((a, b) => (b.sent_at ?? "").localeCompare(a.sent_at ?? ""))[0];
  const reply = [...messages].filter((m) => m.direction === "inbound").sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const fresh = !threads.length && Date.now() - new Date(deal.created_at).getTime() < 3 * 60_000;
  const writing = fresh || asking;

  // While Argos writes, check back every few seconds so the draft appears without a reload.
  useEffect(() => {
    if (!writing) return;
    const t = window.setInterval(() => void qc.invalidateQueries({ queryKey: ["deal", deal.id] }), 4000);
    return () => window.clearInterval(t);
  }, [writing, deal.id, qc]);
  useEffect(() => { if (threads.length) setAsking(false); }, [threads.length]);

  async function ask() {
    if (!listing) return;
    setAsking(true);
    try { await draftFirstMessage(deal.id, listing); await qc.invalidateQueries({ queryKey: ["deal", deal.id] }); }
    catch (e) { setAsking(false); toast.error(e instanceof Error ? e.message : "Argos couldn't write it. Try again."); }
  }

  const date = (s: string | null | undefined) => (s ? new Date(s).toLocaleDateString(ru ? "ru-RU" : "en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");
  const steps = [
    { done: !!(waiting || sent || reply), now: writing, label: ru ? "Argos пишет продавцу по-итальянски" : "Argos writes to the seller in Italian" },
    { done: !!(sent || reply), now: !!waiting, label: ru ? "Вы читаете и одобряете" : "You read and approve it" },
    { done: !!(sent || reply), now: false, label: ru ? "Argos отправляет с argos@odysstay.xyz" : "Argos sends it from argos@odysstay.xyz" },
    { done: !!reply, now: !!sent && !reply, label: ru ? "Ответ приходит сюда, в Telegram и на почту" : "The reply lands here, on Telegram and by email" },
  ];

  let headline: string, sub: string, cta: { label: string; go: () => void } | null = null;
  if (reply) {
    headline = ru ? "Продавец ответил" : "The seller replied";
    sub = `${date(reply.created_at)}. ${(reply.body_en ?? reply.body_original).slice(0, 160)}${(reply.body_en ?? reply.body_original).length > 160 ? "…" : ""}`;
    cta = { label: ru ? "Прочитать и ответить" : "Read and reply", go: onOpenConversations };
  } else if (waiting) {
    headline = ru ? "Письмо готово. Нужно ваше одобрение" : "A message is ready. It needs your OK";
    sub = ru ? "Прочитайте перевод, поправьте если нужно, и нажмите «Одобрить и отправить»." : "Read the translation, edit if you like, then tap \"Approve and send\".";
    cta = { label: ru ? "Прочитать письмо" : "Read the message", go: onOpenConversations };
  } else if (sent) {
    headline = ru ? "Отправлено. Ждём ответа" : "Sent. Waiting for a reply";
    sub = ru ? `Отправлено ${sent.sent_to ?? ""} ${date(sent.sent_at)}. Обычно отвечают за 1–3 дня. Мы сообщим в Telegram и на почту.` : `Sent to ${sent.sent_to ?? "the seller"} on ${date(sent.sent_at)}. Sellers usually answer in 1 to 3 days. We'll tell you on Telegram and by email.`;
  } else if (writing) {
    headline = ru ? "Argos пишет первое письмо…" : "Argos is writing the first message…";
    sub = ru ? "Около минуты. Ничего не уйдёт без вашего одобрения." : "About a minute. Nothing goes out without your OK.";
  } else {
    headline = ru ? "Argos ещё никому не писал" : "Argos hasn't written to anyone yet";
    sub = ru ? "Он напишет продавцу по-итальянски: доступность, документы, осмотр. Вы одобряете перед отправкой." : "He'll write to the seller in Italian: availability, documents, a viewing. You approve before it goes.";
    cta = { label: ru ? "Пусть Argos напишет" : "Have Argos write to the seller", go: () => void ask() };
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-azure/25 bg-gradient-to-b from-azure-soft/70 to-card">
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between md:p-5">
        <div className="flex min-w-0 gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-azure text-white">
            {writing ? <Loader2 className="h-4 w-4 animate-spin" /> : reply ? <MessageCircle className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
          </span>
          <div className="min-w-0">
            <p className="text-[12px] uppercase tracking-[0.1em] text-azure">{ru ? "Что делает Argos" : "What Argos is doing"}</p>
            <p className="mt-0.5 font-display text-[22px] leading-tight">{headline}</p>
            <p className="mt-1 text-[14px] font-light leading-snug text-foreground/70">{sub}</p>
          </div>
        </div>
        {cta && (
          <button type="button" onClick={cta.go} disabled={asking}
            className="h-10 shrink-0 rounded-full bg-azure px-5 text-[14px] text-white transition-colors hover:bg-azure/90 disabled:opacity-60">{cta.label}</button>
        )}
      </div>
      <ol className="grid grid-cols-2 gap-px border-t border-azure/15 bg-azure/10 text-[12px] sm:grid-cols-4">
        {steps.map((s, i) => (
          <li key={s.label} className={cn("flex items-start gap-2 bg-card/80 px-3 py-2.5 leading-snug", s.now && "bg-card")}>
            <span className={cn("mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px]",
              s.done ? "bg-success text-white" : s.now ? "bg-azure text-white" : "border border-foreground/20 text-foreground/40")}>
              {s.done ? <Check className="h-2.5 w-2.5" /> : i + 1}
            </span>
            <span className={s.done || s.now ? "text-foreground" : "text-foreground/50"}>{s.label}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
