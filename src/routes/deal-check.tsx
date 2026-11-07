import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Check } from "lucide-react";

import { useServiceRequest } from "@/components/odys/PurchaseService";
import { PublicShell } from "@/components/odys/PublicShell";
import { useLang } from "@/lib/i18n";

export const Route = createFileRoute("/deal-check")({
  head: () => ({
    meta: [
      { title: "Deal Check | Odysstay" },
      { name: "description", content: "A full write-up of one Italian house before you bid: auction papers, court valuation, hidden costs and the most you should pay. €290, in 48 hours." },
      { property: "og:title", content: "Deal Check | Odysstay" },
      { property: "og:description", content: "Know exactly what you're bidding on. €290, in 48 hours, counted toward your purchase." },
    ],
  }),
  component: DealCheck,
});

const C = {
  en: {
    kicker: "Deal Check · €290",
    title: <>Know exactly what you're <em className="italic text-azure">bidding on</em>.</>,
    sub: "One house, read end to end by Argos and signed off by an Italian professional. In your inbox within 48 hours. The €290 counts toward a purchase.",
    order: "Order a Deal Check", done: "Got it. We'll be in touch within a day.",
    sample: "Sample report", sampleNote: "An example property. The figures show the format, not a real lot.",
    what: "What you get",
    gets: ["A plain verdict: go, go with care, or walk away", "Everything in the auction papers and the court's survey, translated and explained", "Occupants, debts, building issues and easements", "The full cost, to the euro: taxes, court or notary, lawyer, survey, work", "The most you should bid, and why", "Questions to ask, and Argos ready to ask them in Italian"],
  },
  ru: {
    kicker: "Проверка сделки · €290",
    title: <>Знайте точно, <em className="italic text-azure">на что вы ставите</em>.</>,
    sub: "Один дом, прочитанный Argos от начала до конца и проверенный итальянским специалистом. Отчёт за 48 часов. €290 засчитываются в покупку.",
    order: "Заказать проверку", done: "Записали. Напишем в течение дня.",
    sample: "Пример отчёта", sampleNote: "Пример объекта. Цифры показывают формат, это не реальный лот.",
    what: "Что вы получите",
    gets: ["Ясный вывод: брать, брать осторожно или пройти мимо", "Всё из документов торгов и оценки суда, переведено и объяснено", "Жильцы, долги, нарушения и сервитуты", "Полная стоимость до евро: налоги, суд или нотариус, юрист, проверка, ремонт", "Максимальная ставка и почему", "Вопросы, которые стоит задать, и Argos задаст их по-итальянски"],
  },
};

const SAMPLE = {
  en: {
    head: "Stone house, 3 rooms, 96 m². Province of Chieti, Abruzzo",
    tag: "Court auction · second round",
    verdict: "Go, with care", verdictWhy: "Priced 36% under the court's valuation and empty. The catch is an unpermitted veranda you'll need to legalise or remove, and a roof due in about five years.",
    rows: [["Base price", "€38,400"], ["Minimum bid", "€28,800"], ["Court valuation", "€60,000"], ["Previous round", "Unsold at €51,200"]],
    papers: ["Empty since 2023, keys with the custodian. No eviction needed.", "Veranda on the back built without a permit. Legalising costs about €2,500 to €4,000; removing it about €1,500.", "No condominium. Unpaid local property tax from the old owner is cleared by the court, not passed to you.", "Right of way across the garden for the neighbour's field. Stated in the deed, low impact."],
    costs: [["Winning bid (our target)", "€34,000"], ["Registration tax, 9%", "€3,060"], ["Mortgage and land registry fees", "€100"], ["Court transfer and clearing", "€1,500"], ["Lawyer to file the bid", "€1,200"], ["Veranda permit", "€3,000"], ["Total to own it", "€42,860"]],
    maxBid: "Most to bid: €36,500", maxWhy: "Comparable houses within 10 km sell at €700 to €850 per m² in good condition. With the roof and the veranda, above €36,500 you'd pay close to market price for a house that needs work.",
    ask: ["Is the roof original? Ask the custodian for the 2019 survey photos.", "Has anyone booked a viewing? Fewer viewings means fewer rivals."],
  },
  ru: {
    head: "Каменный дом, 3 комнаты, 96 м². Провинция Кьети, Абруццо",
    tag: "Судебные торги · второй тур",
    verdict: "Брать, но осторожно", verdictWhy: "Цена на 36% ниже оценки суда, дом пустой. Минус: незаконная веранда, которую нужно узаконить или снести, и крыша примерно через пять лет.",
    rows: [["Стартовая цена", "€38 400"], ["Минимальная ставка", "€28 800"], ["Оценка суда", "€60 000"], ["Прошлый тур", "Не продан за €51 200"]],
    papers: ["Пустует с 2023 года, ключи у хранителя. Выселять никого не нужно.", "Веранда сзади построена без разрешения. Узаконить около €2 500–4 000, снести около €1 500.", "Кондоминиума нет. Долг прежнего владельца по налогу на недвижимость снимает суд, вам он не переходит.", "Право прохода через сад к полю соседа. Записано в документах, мешает мало."],
    costs: [["Выигрышная ставка (наша цель)", "€34 000"], ["Налог на регистрацию, 9%", "€3 060"], ["Ипотечный и кадастровый сборы", "€100"], ["Переход права и снятие обременений", "€1 500"], ["Юрист для подачи ставки", "€1 200"], ["Разрешение на веранду", "€3 000"], ["Итого, чтобы владеть", "€42 860"]],
    maxBid: "Максимальная ставка: €36 500", maxWhy: "Похожие дома в радиусе 10 км в хорошем состоянии продаются по €700–850 за м². С учётом крыши и веранды выше €36 500 вы заплатите почти рыночную цену за дом, который требует работ.",
    ask: ["Крыша родная? Попросите у хранителя фото оценки 2019 года.", "Кто-то уже записывался на осмотр? Меньше осмотров, меньше соперников."],
  },
};

function DealCheck() {
  const lang = useLang();
  const c = C[lang];
  const s = SAMPLE[lang];
  const ru = lang === "ru";
  const order = useServiceRequest("deal_check");
  const cta = (
    <button type="button" onClick={() => void order.request()} disabled={order.state !== "idle"}
      className="inline-flex h-12 items-center rounded-full bg-azure px-7 text-[15px] text-white transition-colors hover:bg-azure/90 disabled:opacity-80">
      {order.state === "done" ? c.done : c.order}
    </button>
  );
  return (
    <PublicShell>
      <div className="mx-auto max-w-3xl">
        <p className="text-[12px] uppercase tracking-[0.12em] text-azure">{c.kicker}</p>
        <h1 className="mt-3 type-h1">{c.title}</h1>
        <p className="mt-4 max-w-2xl type-lead text-foreground/70">{c.sub}</p>
        <div className="mt-7">{cta}</div>

        <h2 className="mt-14 font-display text-[26px]">{c.what}</h2>
        <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
          {c.gets.map((g) => <li key={g} className="flex gap-2.5 text-[15px] font-light leading-snug"><Check className="mt-1 h-4 w-4 shrink-0 text-success" />{g}</li>)}
        </ul>

        <div className="mt-14 flex items-baseline justify-between gap-3">
          <h2 className="font-display text-[26px]">{c.sample}</h2>
          <span className="text-[12px] font-light text-foreground/50">{c.sampleNote}</span>
        </div>
        <article className="mt-4 overflow-hidden rounded-[16px] border border-border bg-card">
          <div className="border-b border-border bg-muted/50 px-5 py-4 sm:px-7">
            <p className="text-[11px] uppercase tracking-[0.12em] text-foreground/50">{s.tag}</p>
            <h3 className="mt-1 font-display text-[22px] leading-tight sm:text-[26px]">{s.head}</h3>
          </div>
          <div className="space-y-8 px-5 py-6 sm:px-7">
            <section>
              <p className="inline-flex rounded-full bg-[oklch(0.95_0.05_85)] px-3 py-1 text-[13px] text-[oklch(0.45_0.1_70)]">{s.verdict}</p>
              <p className="mt-3 text-[15px] font-light leading-relaxed">{s.verdictWhy}</p>
            </section>
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-4">
              {s.rows.map(([k, v]) => (
                <div key={k} className="bg-card px-3 py-3"><dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{k}</dt><dd className="mt-1 font-display text-[19px] tnum">{v}</dd></div>
              ))}
            </dl>
            <section>
              <h4 className="text-[12px] uppercase tracking-[0.1em] text-foreground/55">{ru ? "Что в документах" : "What the papers say"}</h4>
              <ul className="mt-3 space-y-2.5">
                {s.papers.map((p, i) => (
                  <li key={p} className="flex gap-2.5 text-[15px] font-light leading-snug">
                    {i === 1 ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[oklch(0.6_0.13_45)]" /> : <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />}{p}
                  </li>
                ))}
              </ul>
            </section>
            <section>
              <h4 className="text-[12px] uppercase tracking-[0.1em] text-foreground/55">{ru ? "Сколько выйдет всего" : "What it really costs"}</h4>
              <dl className="mt-3 divide-y divide-border text-[14px]">
                {s.costs.map(([k, v], i) => (
                  <div key={k} className={i === s.costs.length - 1 ? "flex justify-between py-2.5 font-medium" : "flex justify-between py-2 font-light"}><dt>{k}</dt><dd className="tnum">{v}</dd></div>
                ))}
              </dl>
            </section>
            <section className="rounded-xl bg-azure-soft px-5 py-4">
              <p className="font-display text-[22px] text-azure">{s.maxBid}</p>
              <p className="mt-1.5 text-[14px] font-light leading-relaxed text-foreground/80">{s.maxWhy}</p>
            </section>
            <section>
              <h4 className="text-[12px] uppercase tracking-[0.1em] text-foreground/55">{ru ? "Что спросить" : "What to ask"}</h4>
              <ul className="mt-3 space-y-2">{s.ask.map((a) => <li key={a} className="text-[15px] font-light leading-snug">{a}</li>)}</ul>
            </section>
          </div>
        </article>
        <div className="mt-10 flex flex-col items-center gap-3 text-center">
          {cta}
          <p className="text-[13px] font-light text-foreground/50">{ru ? "Это не юридическая консультация. Перед ставкой юрист подтверждает всё, что вас обязывает." : "Not legal advice. A lawyer confirms anything binding before you bid."}</p>
        </div>
      </div>
    </PublicShell>
  );
}
