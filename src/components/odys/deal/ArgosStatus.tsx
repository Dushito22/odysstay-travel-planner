import { useQueryClient } from "@tanstack/react-query";
import { Copy, ExternalLink, Globe, Loader2, Mail, MessageCircle, Phone, RotateCw, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Switch } from "@/components/ui/switch";
import { updateDealSettings, type DealBundle } from "@/lib/deal";
import { useLang } from "@/lib/i18n";
import { startAutopilot } from "@/lib/listing";
import { cn } from "@/lib/utils";

type Detail = { summary?: string; question?: string; facts?: string[]; sent_to?: string };

/** The top of a deal: what Argos is doing now, what he needs from you, and a running log of what
 * he did and learned. Argos runs the conversation himself; this is where you follow it. */
export function ArgosStatus({ bundle, onOpenConversations }: { bundle: DealBundle; onOpenConversations: () => void }) {
  const lang = useLang();
  const ru = lang === "ru";
  const qc = useQueryClient();
  const { deal, threads, messages, events } = bundle;
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const auto = deal.autonomy === "auto_info_requests";

  const waiting = messages.find((m) => m.direction === "outbound" && m.status === "awaiting_approval");
  const sent = [...messages].filter((m) => m.direction === "outbound" && m.status === "sent").sort((a, b) => (b.sent_at ?? "").localeCompare(a.sent_at ?? ""))[0];
  const lastReply = [...messages].filter((m) => m.direction === "inbound").sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const thread = threads[0];
  const noEmail = !!thread && !thread.contacts?.email && !thread.contacts?.pec;
  const fresh = !threads.length && Date.now() - new Date(deal.created_at).getTime() < 3 * 60_000;
  const writing = fresh || busy;
  const needs = [...events].find((e) => e.action === "agent_needs_you");
  const needsQuestion = waiting ? ((needs?.detail ?? {}) as Detail).question : undefined;

  // While Argos works, check back every few seconds so his moves appear without a reload.
  useEffect(() => {
    if (!writing) return;
    const t = window.setInterval(() => void qc.invalidateQueries({ queryKey: ["deal", deal.id] }), 4000);
    return () => window.clearInterval(t);
  }, [writing, deal.id, qc]);
  useEffect(() => { if (messages.length) setBusy(false); }, [messages.length]);

  const contact = thread?.contacts as (DealBundle["threads"][number]["contacts"] & { phone?: string | null; stats?: unknown }) | null | undefined;
  const search = ((contact?.stats ?? {}) as { search?: { at?: string; tried?: string[] }; website?: string | null });
  const searched = !!search.search?.at;
  // An old deal that never searched: Argos starts looking by himself the moment you open it.
  const kicked = useRef(false);
  useEffect(() => {
    if (kicked.current || !waiting || !noEmail || searched || busy) return;
    kicked.current = true;
    void go(undefined, true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waiting, noEmail, searched]);

  async function go(withEmail?: string, research = false) {
    setBusy(true);
    try {
      await startAutopilot(deal.id, withEmail, research);
      await qc.invalidateQueries({ queryKey: ["deal", deal.id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Try again.");
    } finally { setBusy(false); }
  }
  async function toggleAuto(on: boolean) {
    try { await updateDealSettings(deal.id, { autonomy: on ? "auto_info_requests" : "ask_before_sending" }); await qc.invalidateQueries({ queryKey: ["deal", deal.id] }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't change it."); }
  }

  let icon = <Mail className="h-4 w-4" />, headline: string, sub: string, cta: { label: string; go: () => void } | null = null;
  if (writing) {
    icon = <Loader2 className="h-4 w-4 animate-spin" />;
    headline = ru ? "Argos пишет продавцу…" : "Argos is writing to the seller…";
    sub = ru ? "Около минуты." : "About a minute.";
  } else if (waiting && noEmail) {
    const names: Record<string, [string, string]> = { book: ["наши контакты", "our contact book"], listing: ["страницу объявления", "the listing page"], web: ["поиск в интернете", "a web search"], site: ["сайт агентства", "the agency's site"] };
    const tried = (search.search?.tried ?? []).map((k) => names[k]?.[ru ? 0 : 1]).filter(Boolean).join(", ");
    headline = ru ? "Почта продавца скрыта" : "The seller's email is hidden";
    sub = ru
      ? `Порталы вроде Immobiliare прячут адреса агентств за своей формой.${tried ? ` Argos проверил ${tried}.` : ""} Письмо на итальянском готово, выберите, как его доставить.`
      : `Portals like Immobiliare hide agencies' addresses behind their own form.${tried ? ` Argos checked ${tried}.` : ""} The Italian message is ready; pick how it gets there.`;
  } else if (waiting) {
    headline = ru ? "Argos ждёт вашего решения" : "Argos needs your decision";
    sub = needsQuestion ?? (ru ? "Письмо готово и ждёт вашего «да»." : "A message is ready and waits for your yes.");
    cta = { label: ru ? "Посмотреть" : "Review it", go: onOpenConversations };
  } else if (lastReply && (!sent || lastReply.created_at > (sent.sent_at ?? ""))) {
    icon = <MessageCircle className="h-4 w-4" />;
    headline = ru ? "Продавец ответил, Argos разбирается" : "The seller replied. Argos is on it";
    sub = ru ? "Он прочитает, ответит сам или спросит вас." : "He'll read it, answer himself or ask you.";
    cta = { label: ru ? "Читать переписку" : "Read the thread", go: onOpenConversations };
  } else if (sent) {
    headline = ru ? "Argos ведёт переписку" : "Argos is handling it";
    sub = ru ? `Последнее письмо ушло ${sent.sent_to ?? "продавцу"}. Если ответа не будет 3 дня, он напомнит сам. Важное придёт вам в Telegram и на почту.`
      : `Last email went to ${sent.sent_to ?? "the seller"}. If there's no answer in 3 days he'll follow up himself. Anything important reaches you on Telegram and by email.`;
    cta = { label: ru ? "Читать переписку" : "Read the thread", go: onOpenConversations };
  } else {
    headline = ru ? "Передайте сделку Argos" : "Hand this deal to Argos";
    sub = ru ? "Он напишет продавцу по-итальянски, узнает всё о доме, договорится об осмотре и будет держать вас в курсе. Ничего обязывающего без вас." : "He writes to the seller in Italian, finds out everything about the house, sets up a viewing and keeps you posted. Nothing binding without you.";
    cta = { label: ru ? "Начать" : "Start", go: () => void go() };
  }

  const log = events.filter((e) => ["agent_update", "agent_learned", "agent_needs_you", "reply_received", "message_sent"].includes(e.action)).slice(0, 8);
  const when = (s: string) => new Date(s).toLocaleDateString(ru ? "ru-RU" : "en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <section className="overflow-hidden rounded-2xl border border-azure/25 bg-gradient-to-b from-azure-soft/70 to-card">
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between md:p-5">
        <div className="flex min-w-0 gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-azure text-white">{icon}</span>
          <div className="min-w-0">
            <p className="text-[12px] uppercase tracking-[0.1em] text-azure">{ru ? "Что делает Argos" : "What Argos is doing"}</p>
            <p className="mt-0.5 font-display text-[22px] leading-tight">{headline}</p>
            <p className="mt-1 text-[14px] font-light leading-snug text-foreground/70">{sub}</p>
          </div>
        </div>
        {cta && (
          <button type="button" onClick={cta.go} disabled={busy}
            className="h-10 shrink-0 rounded-full bg-azure px-5 text-[14px] text-white transition-colors hover:bg-azure/90 disabled:opacity-60">{cta.label}</button>
        )}
      </div>

      {waiting && noEmail && !writing && <NoEmailOptions ru={ru} busy={busy} phone={contact?.phone ?? null} website={search.website ?? null}
        listingUrl={bundle.listing?.source_url ?? null} town={bundle.listing?.comune ?? ""} draft={waiting.body_original} subject={waiting.subject ?? ""}
        onEmail={(e) => void go(e)} onRetry={() => void go(undefined, true)} />}

      {log.length > 0 && (
        <ol className="space-y-3 border-t border-azure/15 bg-card/70 px-4 py-4 md:px-5">
          {log.map((e) => {
            const d = (e.detail ?? {}) as Detail;
            const text = e.action === "agent_learned" ? (d.facts ?? []).join(" · ")
              : e.action === "reply_received" ? `${ru ? "Ответ продавца" : "Seller replied"}${d.summary ? `: ${d.summary}` : ""}`
              : e.action === "message_sent" ? `${ru ? "Письмо отправлено" : "Email sent"}${d.sent_to ? ` → ${d.sent_to}` : ""}`
              : d.summary ?? "";
            if (!text) return null;
            return (
              <li key={e.id} className="flex gap-3">
                <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", e.action === "agent_needs_you" ? "bg-[oklch(0.65_0.15_60)]" : e.action === "agent_learned" ? "bg-success" : "bg-azure")} />
                <div className="min-w-0">
                  <p className="text-[14px] leading-snug">
                    {e.action === "agent_learned" && <Sparkles className="mr-1 inline h-3.5 w-3.5 text-success" />}{text}
                  </p>
                  <p className="mt-0.5 text-[11px] text-foreground/45">{when(e.created_at)}</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <label className="flex cursor-pointer items-center justify-between gap-3 border-t border-azure/15 px-4 py-3 text-[13px] md:px-5">
        <span className="text-foreground/70">
          <span className="text-foreground">{ru ? "Автопилот" : "Autopilot"}</span>{" · "}
          {auto ? (ru ? "обычные вопросы Argos отправляет сам, обязывающее ждёт вас" : "Argos sends routine questions himself; anything binding waits for you")
            : (ru ? "каждое письмо ждёт вашего одобрения" : "every message waits for your OK")}
        </span>
        <Switch checked={auto} onCheckedChange={(v) => void toggleAuto(v)} />
      </label>
    </section>
  );
}

/** Italian mobiles start with 3; only those have WhatsApp. Landlines (0...) get a call button only. */
function waNumber(phone: string) {
  let d = phone.replace(/[^\d+]/g, "").replace(/^\+/, "").replace(/^00/, "");
  if (d.startsWith("39")) d = d.slice(2);
  return /^3\d{8,9}$/.test(d) ? `39${d}` : null;
}

function NoEmailOptions({ ru, busy, phone, website, listingUrl, town, draft, subject, onEmail, onRetry }: {
  ru: boolean; busy: boolean; phone: string | null; website: string | null; listingUrl: string | null; town: string;
  draft: string; subject: string; onEmail: (e: string) => void; onRetry: () => void;
}) {
  const [email, setEmail] = useState("");
  const [copied, setCopied] = useState(false);
  const wa = phone ? waNumber(phone) : null;
  const copy = async () => {
    try { await navigator.clipboard.writeText(`${subject ? `${subject}\n\n` : ""}${draft}`); setCopied(true); window.setTimeout(() => setCopied(false), 2000); }
    catch { toast.error(ru ? "Не удалось скопировать" : "Couldn't copy"); }
  };
  const row = "flex items-start gap-3 px-4 py-3.5 md:px-5";
  const ico = "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-azure/10 text-azure";
  const btn = "inline-flex h-9 items-center gap-1.5 rounded-full border border-foreground/15 bg-background px-4 text-[14px] transition-colors hover:border-foreground/40";
  return (
    <div className="divide-y divide-azure/15 border-t border-azure/15 bg-card/80">
      {wa && (
        <div className={row}>
          <span className={ico}><MessageCircle className="h-4 w-4" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-medium">{ru ? "Написать агентству в WhatsApp" : "Message the agency on WhatsApp"}</p>
            <p className="mt-0.5 text-[14px] text-foreground/65">{ru ? "Итальянские агенты отвечают в WhatsApp быстрее, чем на почту. Откроется ваш WhatsApp с письмом Argos на итальянском. Ответ перешлите сюда, Argos переведёт." : "Italian agents answer WhatsApp faster than email. Your WhatsApp opens with Argos's Italian message filled in. Paste the reply here and Argos translates it."}</p>
          </div>
          <a className={btn} href={`https://wa.me/${wa}?text=${encodeURIComponent(draft.slice(0, 1500))}`} target="_blank" rel="noreferrer">WhatsApp</a>
        </div>
      )}
      {phone && (
        <div className={row}>
          <span className={ico}><Phone className="h-4 w-4" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-medium">{ru ? `Позвонить: ${phone}` : `Call: ${phone}`}</p>
            <p className="mt-0.5 text-[14px] text-foreground/65">{ru ? "Хватит одной фразы, чтобы получить почту:" : "One sentence gets you the email:"} <span className="italic text-foreground/80">«Buongiorno, sono interessato all'immobile{town ? ` a ${town}` : ""}. Mi può dare un indirizzo email?»</span></p>
          </div>
          <a className={btn} href={`tel:${phone.replace(/[^\d+]/g, "")}`}>{ru ? "Позвонить" : "Call"}</a>
        </div>
      )}
      <div className={row}>
        <span className={ico}><Copy className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-medium">{ru ? "Отправить через форму на портале" : "Send it through the portal's form"}</p>
          <p className="mt-0.5 text-[14px] text-foreground/65">{ru ? "Скопируйте письмо и вставьте в форму «Contatta l'agenzia» на странице объявления. Агентство ответит на вашу почту." : "Copy the message and paste it into the listing's \u201cContatta l'agenzia\u201d form. The agency replies to your email."}</p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <button type="button" className={btn} onClick={() => void copy()}><Copy className="h-3.5 w-3.5" />{copied ? (ru ? "Скопировано" : "Copied") : (ru ? "Скопировать письмо" : "Copy the message")}</button>
            {listingUrl && <a className={btn} href={listingUrl} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" />{ru ? "Открыть объявление" : "Open the listing"}</a>}
            {website && <a className={btn} href={website} target="_blank" rel="noreferrer"><Globe className="h-3.5 w-3.5" />{ru ? "Сайт агентства" : "Agency site"}</a>}
          </div>
        </div>
      </div>
      <div className={row}>
        <span className={ico}><Mail className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-medium">{ru ? "Знаете адрес? Argos отправит сам" : "Know the address? Argos sends it"}</p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="info@agenzia.it"
              className="h-9 min-w-0 flex-1 rounded-full border bg-background px-4 text-[14px] outline-none focus:border-foreground/40" />
            <button type="button" disabled={busy || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)} onClick={() => onEmail(email)}
              className="h-9 rounded-full bg-azure px-5 text-[14px] text-white disabled:opacity-40">{ru ? "Отправить" : "Send it"}</button>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between px-4 py-2.5 md:px-5">
        <span className="text-[13px] text-foreground/55">{ru ? "Argos ищет снова каждые 6 часов, пока сделка открыта." : "Argos searches again every 6 hours while the deal is open."}</span>
        <button type="button" disabled={busy} onClick={onRetry} className="inline-flex items-center gap-1.5 text-[13.5px] text-azure hover:underline disabled:opacity-50">
          <RotateCw className={cn("h-3.5 w-3.5", busy && "animate-spin")} />{ru ? "Искать сейчас" : "Search now"}
        </button>
      </div>
    </div>
  );
}
