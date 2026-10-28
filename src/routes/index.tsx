import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Check, Info, MailCheck } from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";

import { ArgosComposer } from "@/components/odys/ArgosComposer";
import { ListingCard, ListingCardSkeleton } from "@/components/odys/ListingCard";
import { SourceQuote, Wordmark } from "@/components/odys/primitives";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { setLang, useLang, type Lang } from "@/lib/i18n";
import { exampleFactQuery, sendMagicLink, sourceCountsQuery, topListingsQuery } from "@/lib/public";
import { cn } from "@/lib/utils";

const TITLE = "Odysstay | Tell me about your dream house";
const DESC =
  "Italy sells houses below the court's valuation and nobody tells you where. Argos finds them, reads the Italian and makes the calls. Sprezzatura, on your behalf.";

/** Invented sample testimonials, for the internal demo only. Set VITE_DEMO_CONTENT=false before any public launch. */
const DEMO_CONTENT = import.meta.env["VITE_DEMO_CONTENT"] !== "false";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "/video/hero-poster.jpg" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

/** Italic emphasis inside a headline, the Balance way: *like this*. */
function Em({ children }: { children: ReactNode }) {
  return <em className="font-display italic">{children}</em>;
}

const COPY = {
  en: {
    nav: { how: "How it works", browse: "Browse", pricing: "Pricing", signIn: "Sign in" },
    eyebrow: "sprezzatura, on your behalf.",
    hero: "Tell me about your dream house.",
    placeholder: "A stone house in Puglia under €40k, near a bar, some work is fine…",
    help: "Just talk, like you would to a friend: where, how much, sea or hills, how much work you'll take on. I'll find it and do the Italian.",
    howTalk: "Talk to me like this:",
    examples: ["Somewhere in Sicily under 30k. A house, not a flat. I can renovate.", "Show me the €1 towns in Sardinia.", "Something by the sea in the south, ready to live in, under 80k."],
    howTalkEnd: "Tap the mic and speak, or type. Real houses appear while we talk.",
    chips: ["A stone house under €50k, some work is fine", "Show me the €1 houses", "Court auctions in Sicily under €30k", "Surprise me"],
    browseAll: "Rather browse? See every listing",
    powered: "Argos, your AI agent in Italy · powered by Claude and GPT",
    statement: [<>Italy sells houses <Em>below the court's valuation</Em>.</>, " Nobody tells you where."],
    statementBody: "Courts, notaries and town halls sell thousands of homes a year through notices nobody markets, in Italian, on websites from another century. We read every one of them, every day.",
    numbers: ["court sales open now", "notary and public-body sales", "towns selling houses for €1", "private auctions, added daily"],
    howEyebrow: "How it works",
    howTitle: <>Ten phone calls. <Em>One shrug.</Em></>,
    howBody: "Behind the curtain: courts, town halls, a geometra, a notary, a deadline at noon on a Tuesday. In front of it: you, unbothered.",
    steps: [
      { title: "Say it", body: "Budget, region, how much work you'll take on. Out loud, in English or Russian.", chip: "Answered in seconds" },
      { title: "Argos does Italy", body: "Every notice read, the Italian translated, emails and calls to delegates and notaries. You approve each one.", chip: "Approved by you" },
      { title: "You pick. You own.", body: "A shortlist, one deal room, one notary, your name on the deed.", chip: "Never brave on the phone" },
    ],
    mockYou: "Puglia, under 40k, walk to a bar.",
    mockArgos: "Three. One's a wreck, one's fine, one's lovely and won't last.",
    mockMailTo: "To the sale delegate, Tribunale di Brindisi",
    mockMail: "Gentile Avvocato, Le scrivo per conto di un acquirente interessato al lotto 1…",
    mockDeal: ["Ceglie Messapica", "Offer filed", "Notary booked"],
    sprezz: { word: "sprezzatura", pron: "/sprets-ah-TOO-rah/ · noun · Italian", def: "The art of making the difficult look effortless.", note: "Castiglione, 1528. Back then it took a household of servants. Now it takes Argos.", sign: "Buying a house in Italy, apparently without effort." },
    housesTitle: <>The house you'll swear you <Em>found by accident</Em>.</>,
    housesBody: "Real ones, open for offers today. Most need work and a little love. That's the whole discount.",
    seeAll: "See them all",
    proofEyebrow: "No source, no fact",
    proofTitle: <>If the notice doesn't say it, <Em>we don't either</Em>.</>,
    proofBody: "Every price, size and deadline links to the line it came from, with the translation beside it. If the document is silent, Argos says so. An agent that guesses is worse than no agent.",
    exampleLabel: "Example · Offer deadline",
    voicesTitle: <>They <Em>barely tried</Em>.</>,
    voices: [
      { quote: "I said 'something in Puglia, under forty, walk to a bar'. Nine days later I was standing in it.", name: "Hannah & Tom", where: "Bristol → Ceglie Messapica" },
      { quote: "I don't speak a word of Italian. Argos called the notary, I drank coffee.", name: "Olga S.", where: "Moscow → Sciacca" },
      { quote: "The court papers were 84 pages. Argos told me the three lines that mattered.", name: "Marco & Lena", where: "Munich → Spoleto" },
      { quote: "Bought a house for 19 thousand. My friends think I searched for ages.", name: "Dmitri K.", where: "St Petersburg → Agrigento" },
    ],
    faqTitle: <>Fair <Em>questions</Em>.</>,
    faq: [
      { q: "So who actually buys the house?", a: "You do. Argos finds it, reads every document, writes and calls in Italian, and keeps every deadline. You approve each message and you sign with the notary. We are a technology service, not an estate agency, law firm or notary." },
      { q: "Do I need to speak Italian?", a: "No. Talk to Argos in English or Russian. Everything Italian is translated, with the original one tap away, and every message Argos sends is shown to you in your language first." },
      { q: "Why are these houses so cheap?", a: "Most are sold by courts, notaries and towns, not agents, so nobody markets them. Most need work and a little love. That's the whole discount." },
      { q: "What about the €1 houses?", a: "Real, with conditions: a renovation within a few years and a deposit of a few thousand euros. Argos shows each town's actual rules and the houses still on offer." },
      { q: "Can foreigners buy property in Italy?", a: "Most nationalities can. It depends on your citizenship and Italy's reciprocity rules. Argos checks it for you, and the notary confirms it before you commit." },
      { q: "What does it cost?", a: "Exploring and talking to Argos is free to start. Pro adds unlimited deals, outreach and calls. Fees to the court, the notary or a surveyor are paid by you, directly to them." },
    ],
    finalTitle: <>Your house is in an Italian PDF <Em>somewhere</Em>.</>,
    finalBody: "Argos is already reading it. Free to start, no password, no card.",
    finalPoints: ["No obligation", "Real listings from day one", "Talk in English or Russian"],
    getStarted: "Get started",
    sending: "Sending",
    sent: "Check your inbox for the sign-in link.",
    footerTag: "Your agent for buying a house in Italy. Found, read, handled.",
    footerCols: { explore: "Explore", company: "Company" },
    legal: "Odysstay is a technology service, not an estate agency, law firm or notary. Always confirm with a qualified professional before committing.",
  },
  ru: {
    nav: { how: "Как это работает", browse: "Каталог", pricing: "Цены", signIn: "Войти" },
    eyebrow: "sprezzatura, от вашего имени.",
    hero: "Расскажите о доме своей мечты.",
    placeholder: "Каменный дом в Апулии до 40 тысяч, рядом бар, можно с ремонтом…",
    help: "Говорите как с другом: где, сколько, море или холмы, готовы ли к ремонту. Я найду и возьму итальянский на себя.",
    howTalk: "Говорите со мной так:",
    examples: ["Где-нибудь на Сицилии до 30 тысяч. Дом, не квартира. Ремонт не пугает.", "Покажи города с домами за 1 евро на Сардинии.", "Что-нибудь у моря на юге, сразу жить, до 80 тысяч."],
    howTalkEnd: "Нажмите на микрофон и говорите или пишите. Настоящие дома появятся, пока мы разговариваем.",
    chips: ["Каменный дом до €50 тыс., можно с ремонтом", "Покажи дома за €1", "Судебные торги на Сицилии до €30 тыс.", "Удиви меня"],
    browseAll: "Хотите просто посмотреть? Все объявления",
    powered: "Argos, ваш ИИ-агент в Италии · на Claude и GPT",
    statement: [<>Италия продаёт дома <Em>ниже судебной оценки</Em>.</>, " Только никто не говорит где."],
    statementBody: "Суды, нотариусы и муниципалитеты продают тысячи домов в год через объявления, которые никто не рекламирует: на итальянском, на сайтах из прошлого века. Мы читаем каждое, каждый день.",
    numbers: ["судебных продаж сейчас", "нотариальных и государственных продаж", "городов продают дома за €1", "частные аукционы, каждый день"],
    howEyebrow: "Как это работает",
    howTitle: <>Десять звонков. <Em>Одно пожатие плеч.</Em></>,
    howBody: "За кулисами: суды, мэрии, геометр, нотариус, дедлайн во вторник в полдень. На сцене: вы, совершенно спокойный.",
    steps: [
      { title: "Скажите", body: "Бюджет, регион, готовность к ремонту. Голосом, по-русски или по-английски.", chip: "Ответ за секунды" },
      { title: "Argos берёт Италию на себя", body: "Каждое объявление прочитано, итальянский переведён, письма и звонки делегатам и нотариусам. Каждое вы одобряете.", chip: "Одобрено вами" },
      { title: "Вы выбираете. Вы владеете.", body: "Шорт-лист, одна сделка, один нотариус, ваше имя в договоре.", chip: "Никаких звонков на итальянском" },
    ],
    mockYou: "Апулия, до 40 тысяч, пешком до бара.",
    mockArgos: "Три. Один в руинах, один нормальный, один прелестный и долго не простоит.",
    mockMailTo: "Делегату по продаже, суд Бриндизи",
    mockMail: "Gentile Avvocato, Le scrivo per conto di un acquirente interessato al lotto 1…",
    mockDeal: ["Челье-Мессапика", "Предложение подано", "Нотариус назначен"],
    sprezz: { word: "sprezzatura", pron: "/спреццату́ра/ · сущ. · итал.", def: "Искусство делать трудное так, будто это ничего не стоит.", note: "Кастильоне, 1528. Тогда для этого нужен был целый штат слуг. Теперь достаточно Argos.", sign: "Купить дом в Италии, будто бы без усилий." },
    housesTitle: <>Дом, который вы <Em>будто нашли случайно</Em>.</>,
    housesBody: "Настоящие, открыты для предложений сегодня. Большинству нужен ремонт и немного любви. В этом вся скидка.",
    seeAll: "Смотреть все",
    proofEyebrow: "Нет источника, нет факта",
    proofTitle: <>Если в объявлении этого нет, <Em>мы тоже не скажем</Em>.</>,
    proofBody: "Каждая цена, площадь и срок ведут к строке, откуда они взяты, с переводом рядом. Если в документе пусто, Argos так и скажет. Агент, который гадает, хуже, чем никакой.",
    exampleLabel: "Пример · Срок подачи",
    voicesTitle: <>Они <Em>почти не старались</Em>.</>,
    voices: [
      { quote: "Я сказала: «Апулия, до сорока, пешком до бара». Через девять дней я стояла внутри.", name: "Ханна и Том", where: "Бристоль → Челье-Мессапика" },
      { quote: "Я не говорю по-итальянски ни слова. Argos звонил нотариусу, я пила кофе.", name: "Ольга С.", where: "Москва → Шакка" },
      { quote: "Судебные документы были на 84 страницы. Argos показал три строки, которые имели значение.", name: "Марко и Лена", where: "Мюнхен → Сполето" },
      { quote: "Купил дом за 19 тысяч. Друзья думают, что я долго искал.", name: "Дмитрий К.", where: "Санкт-Петербург → Агридженто" },
    ],
    faqTitle: <>Честные <Em>вопросы</Em>.</>,
    faq: [
      { q: "Так кто в итоге покупает дом?", a: "Вы. Argos находит, читает все документы, пишет и звонит по-итальянски, следит за сроками. Каждое сообщение вы одобряете, а подписываете у нотариуса. Мы технологический сервис, не агентство, не юристы и не нотариус." },
      { q: "Нужно ли знать итальянский?", a: "Нет. Говорите с Argos по-русски или по-английски. Всё итальянское переведено, оригинал в одно касание, и каждое сообщение Argos сначала показывает вам на вашем языке." },
      { q: "Почему эти дома такие дешёвые?", a: "Большинство продают суды, нотариусы и муниципалитеты, не агенты, поэтому их никто не рекламирует. Большинству нужен ремонт и немного любви. В этом вся скидка." },
      { q: "А дома за 1 евро?", a: "Настоящие, но с условиями: ремонт за несколько лет и залог в несколько тысяч евро. Argos показывает реальные правила каждого города и дома, которые ещё доступны." },
      { q: "Могут ли иностранцы покупать недвижимость в Италии?", a: "Граждане большинства стран могут. Это зависит от гражданства и принципа взаимности. Argos проверит, а нотариус подтвердит до сделки." },
      { q: "Сколько это стоит?", a: "Смотреть и говорить с Argos можно бесплатно. Pro добавляет неограниченные сделки, переписку и звонки. Пошлины суду, нотариусу или геометру вы платите им напрямую." },
    ],
    finalTitle: <>Ваш дом где-то в <Em>итальянском PDF</Em>.</>,
    finalBody: "Argos его уже читает. Бесплатно, без пароля и без карты.",
    finalPoints: ["Без обязательств", "Настоящие объявления с первого дня", "По-русски или по-английски"],
    getStarted: "Начать",
    sending: "Отправляем",
    sent: "Проверьте почту: там ссылка для входа.",
    footerTag: "Ваш агент для покупки дома в Италии. Найдено, прочитано, сделано.",
    footerCols: { explore: "Сервис", company: "Компания" },
    legal: "Odysstay — технологический сервис, а не агентство недвижимости, юристы или нотариус. Перед решением всегда консультируйтесь со специалистом.",
  },
} as const;

type Copy = (typeof COPY)["en"];
const useCopy = (): [Copy, Lang] => {
  const lang = useLang();
  return [COPY[lang] as unknown as Copy, lang];
};

function Index() {
  const lang = useLang();
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  return (
    <div className="min-h-screen bg-background">
      <Hero />
      <Statement />
      <HowItWorks />
      <Sprezzatura />
      <Houses />
      <Proof />
      {DEMO_CONTENT && <Voices />}
      <Faq />
      <Final />
      <Footer />
    </div>
  );
}

export function LangToggle({ light = false }: { light?: boolean }) {
  const lang = useLang();
  return (
    <div className={cn("flex items-center gap-1 text-sm", light ? "text-white/70" : "text-muted-foreground")}>
      {(["en", "ru"] as const).map((l, i) => (
        <span key={l} className="flex items-center gap-1">
          {i > 0 && <span aria-hidden>·</span>}
          <button type="button" onClick={() => setLang(l)} aria-pressed={lang === l}
            className={cn("uppercase tracking-wide transition-colors", lang === l ? (light ? "text-white" : "text-foreground") : "hover:opacity-80")}>
            {l}
          </button>
        </span>
      ))}
    </div>
  );
}

function PillLink({ to, children, light = false }: { to: string; children: ReactNode; light?: boolean }) {
  return (
    <Link to={to}
      className={cn("inline-flex h-9 items-center gap-2 rounded-full pl-4 pr-1 text-[15px] transition-colors",
        light ? "bg-white text-foreground hover:bg-white/90" : "bg-foreground text-background hover:bg-foreground/90")}>
      {children}
      <span className={cn("flex h-7 w-7 items-center justify-center rounded-full border", light ? "border-foreground/20" : "border-white/30")}>
        <ArrowRight className="h-3.5 w-3.5" />
      </span>
    </Link>
  );
}

function HeroVideo() {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setSrc(window.innerWidth < 900 ? "/video/hero-720.mp4" : "/video/hero-1080.mp4");
    }
  }, []);
  const look = "absolute inset-0 h-full w-full object-cover [filter:brightness(1.18)_contrast(1.04)_saturate(1.08)]";
  return (
    <>
      <img src="/video/hero-poster.jpg" alt="" aria-hidden className={look} />
      {src && <video src={src} autoPlay muted loop playsInline preload="auto" aria-hidden className={look} />}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,oklch(0.2_0.02_245/0.28),oklch(0.15_0.02_245/0.12)_70%)]" />
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/30 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/35 to-transparent" />
    </>
  );
}

function Hero() {
  const [c, lang] = useCopy();
  const navigate = useNavigate();
  const [hint, setHint] = useState(false);
  const go = (q: string, spoken = false) => navigate({ to: "/argos", search: { q, ...(spoken ? { voice: true } : {}) } });
  return (
    <section className="relative flex min-h-[100svh] flex-col overflow-hidden bg-foreground text-white">
      <HeroVideo />
      <header className="relative z-10 mx-auto flex w-full max-w-[1440px] items-center justify-between px-5 py-5 md:px-14">
        <Link to="/" aria-label="Odysstay home"><Wordmark size="lg" tone="dark" /></Link>
        <nav className="flex items-center gap-6">
          <a href="#how" className="hidden text-[15px] text-white/85 hover:text-white md:block">{c.nav.how}</a>
          <Link to="/explore" className="hidden text-[15px] text-white/85 hover:text-white md:block">{c.nav.browse}</Link>
          <Link to="/pricing" className="hidden text-[15px] text-white/85 hover:text-white md:block">{c.nav.pricing}</Link>
          <LangToggle light />
          <PillLink to="/login" light>{c.nav.signIn}</PillLink>
        </nav>
      </header>

      <div className="relative z-10 mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-5 pb-20 text-center">
        <p className="font-display text-2xl font-[200] italic text-white/90 md:text-[32px]">{c.eyebrow}</p>
        <h1 className="mt-2 text-[40px] font-[200] leading-[1.02] md:text-[60px]">{c.hero}</h1>
        <div className="mt-8 w-full max-w-[620px]">
          <ArgosComposer onSubmit={go} placeholder={c.placeholder} lang={lang === "ru" ? "ru-RU" : "en-GB"} />
        </div>
        <div className="mt-3 flex max-w-[560px] items-start justify-center gap-2 text-[13px] leading-relaxed text-white/80">
          <p>{c.help}</p>
          <button type="button" onClick={() => setHint(!hint)} aria-label="How to talk to Argos" className="mt-0.5 shrink-0 text-white/70 hover:text-white">
            <Info className="h-3.5 w-3.5" />
          </button>
        </div>
        {hint && (
          <div className="frost mt-3 w-full max-w-[560px] rounded-2xl p-4 text-left text-[13px] leading-relaxed text-white/90">
            <p className="text-white">{c.howTalk}</p>
            <ul className="mt-1.5 space-y-1 text-white/80">{c.examples.map((e) => <li key={e}>“{e}”</li>)}</ul>
            <p className="mt-2 text-white/70">{c.howTalkEnd}</p>
          </div>
        )}
        <div className="mt-5 flex flex-wrap justify-center gap-1.5">
          {c.chips.map((chip) => (
            <button key={chip} type="button" onClick={() => go(chip)}
              className="frost h-8 rounded-full px-3.5 text-[13px] text-white/90 transition-colors hover:bg-white/20">
              {chip}
            </button>
          ))}
        </div>
        <Link to="/explore" className="mt-6 inline-flex items-center gap-1.5 text-[13px] text-white/80 underline-offset-4 hover:text-white hover:underline">
          {c.browseAll} <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <p className="relative z-10 pb-5 text-center text-xs text-white/60">{c.powered}</p>
    </section>
  );
}

const Wrap = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn("mx-auto w-full max-w-[1440px] px-5 md:px-14", className)}>{children}</div>
);
const Eyebrow = ({ children, className }: { children: ReactNode; className?: string }) => (
  <p className={cn("text-xs uppercase tracking-[0.18em] text-muted-foreground", className)}>{children}</p>
);
const H2 = ({ children, className }: { children: ReactNode; className?: string }) => (
  <h2 className={cn("max-w-4xl text-[34px] font-[200] leading-[1.06] md:text-[52px]", className)}>{children}</h2>
);

function Statement() {
  const [c] = useCopy();
  const n = useQuery(sourceCountsQuery).data;
  const fmt = (v: number | undefined, f: string) => (v ? v.toLocaleString("en-GB") : f);
  const nums = [fmt(n?.court, "16,000"), fmt(n?.notary, "99"), fmt(n?.oneEuro, "73"), n?.privateSales ? n.privateSales.toLocaleString("en-GB") : "+"];
  return (
    <section className="py-20 md:py-28">
      <Wrap>
        <H2>{c.statement[0]}{c.statement[1]}</H2>
        <p className="mt-6 max-w-2xl text-lg font-light leading-relaxed text-muted-foreground">{c.statementBody}</p>
        <dl className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {nums.map((v, i) => (
            <div key={i} className="rounded-xl border bg-card p-6">
              <dt className="font-display text-[44px] font-[200] leading-none tnum">{v}</dt>
              <dd className="mt-3 text-sm text-muted-foreground">{c.numbers[i]}</dd>
            </div>
          ))}
        </dl>
      </Wrap>
    </section>
  );
}

function MockFrame({ children, chip }: { children: ReactNode; chip: string }) {
  return (
    <div className="mt-6 flex min-h-[220px] flex-col items-center justify-between rounded-lg bg-gradient-to-b from-azure-soft to-[oklch(0.97_0.012_80)] p-5">
      <div className="w-full flex-1 content-center">{children}</div>
      <span className="mt-4 rounded-full bg-[oklch(0.95_0.02_80)] px-4 py-1.5 text-sm text-muted-foreground">{chip}</span>
    </div>
  );
}

function HowItWorks() {
  const [c] = useCopy();
  return (
    <section id="how" className="scroll-mt-4 bg-muted py-20 md:py-28">
      <Wrap>
        <Eyebrow>{c.howEyebrow}</Eyebrow>
        <H2 className="mt-4">{c.howTitle}</H2>
        <p className="mt-5 max-w-xl text-lg font-light leading-relaxed text-muted-foreground">{c.howBody}</p>
        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {c.steps.map((s, i) => (
            <div key={s.title} className="rounded-xl border bg-background p-6">
              <h3 className="text-[26px] font-normal">{s.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{s.body}</p>
              <MockFrame chip={s.chip}>
                {i === 0 && (
                  <div className="space-y-2 text-left text-sm">
                    <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-foreground px-3 py-2 text-background">{c.mockYou}</p>
                    <div className="w-fit max-w-[90%] rounded-2xl rounded-bl-md border bg-background px-3 py-2">
                      <p className="font-display text-[15px] italic text-azure">Argos</p>
                      <p>{c.mockArgos}</p>
                    </div>
                  </div>
                )}
                {i === 1 && (
                  <div className="rounded-lg border bg-background p-4 text-left text-sm">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{c.mockMailTo}</p>
                    <p className="mt-2 italic text-muted-foreground" lang="it">{c.mockMail}</p>
                    <p className="mt-3 flex items-center gap-1.5 text-success"><Check className="h-3.5 w-3.5" /> {c.steps[1]!.chip}</p>
                  </div>
                )}
                {i === 2 && (
                  <div className="rounded-lg border bg-background p-4 text-left text-sm">
                    <p className="font-display text-xl">{c.mockDeal[0]}</p>
                    {c.mockDeal.slice(1).map((d) => (
                      <p key={d} className="mt-2 flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-success" /> {d}</p>
                    ))}
                  </div>
                )}
              </MockFrame>
            </div>
          ))}
        </div>
      </Wrap>
    </section>
  );
}

function Sprezzatura() {
  const [c] = useCopy();
  const s = c.sprezz;
  return (
    <section className="py-20 md:py-28">
      <Wrap>
        <div className="ml-auto max-w-xl border-y py-9 md:mr-[8%]">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <p className="font-display text-[44px] font-[200] italic leading-none">{s.word}</p>
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{s.pron}</p>
          </div>
          <p className="mt-5 text-lg">{s.def}</p>
          <p className="mt-3 font-light leading-relaxed text-muted-foreground">{s.note}</p>
          <p className="mt-6 text-right font-display text-lg italic text-muted-foreground">{s.sign}</p>
        </div>
      </Wrap>
    </section>
  );
}

function Houses() {
  const [c] = useCopy();
  const q = useQuery(topListingsQuery(6, true));
  if (q.isSuccess && q.data.length === 0) return null;
  return (
    <section className="pb-20 md:pb-28">
      <Wrap>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <H2>{c.housesTitle}</H2>
            <p className="mt-4 max-w-xl text-lg font-light text-muted-foreground">{c.housesBody}</p>
          </div>
          <Link to="/explore" className="inline-flex items-center gap-2 border-b border-foreground/30 pb-1 text-[15px] hover:border-foreground">
            {c.seeAll} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {q.isLoading
            ? Array.from({ length: 3 }, (_, i) => <ListingCardSkeleton key={i} />)
            : (q.data ?? []).slice(0, 6).map((r) => <ListingCard key={r.id} row={r} profile={null} />)}
        </div>
      </Wrap>
    </section>
  );
}

function Proof() {
  const [c] = useCopy();
  const top = useQuery(topListingsQuery(3));
  const f = useQuery(exampleFactQuery(top.data?.[0])).data;
  return (
    <section className="bg-muted py-20 md:py-28">
      <Wrap className="grid items-center gap-12 md:grid-cols-2">
        <div>
          <Eyebrow>{c.proofEyebrow}</Eyebrow>
          <H2 className="mt-4">{c.proofTitle}</H2>
          <p className="mt-5 max-w-md text-lg font-light leading-relaxed text-muted-foreground">{c.proofBody}</p>
        </div>
        <div className="rounded-xl border bg-background p-7">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{f ? `${f.comune ?? ""} · ${f.label_en}` : c.exampleLabel}</p>
          <div className="mt-3 font-display text-[34px] font-[200]">
            {f ? <SourceQuote quote={f.quote} quoteEn={f.quote_en} page={f.page} sourceUrl={f.source_url}>{f.value_text ?? f.value_num}</SourceQuote> : "17 July 2026, 12:00"}
          </div>
          <blockquote lang="it" className="mt-5 border-l-2 border-azure pl-4 text-sm leading-relaxed">
            “{f ? f.quote : "Le offerte dovranno pervenire entro e non oltre le ore 12:00 del 17 luglio 2026."}”
          </blockquote>
          <p className="mt-2 pl-4 text-sm text-muted-foreground">{f ? f.quote_en : "Offers must arrive no later than 12:00 on 17 July 2026."}</p>
        </div>
      </Wrap>
    </section>
  );
}

function Voices() {
  const [c] = useCopy();
  return (
    <section className="py-20 md:py-28">
      <Wrap>
        <H2>{c.voicesTitle}</H2>
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {c.voices.map((t) => (
            <figure key={t.name} className="rounded-xl bg-[oklch(0.975_0.008_80)] p-7">
              <blockquote className="text-lg font-light leading-relaxed">“{t.quote}”</blockquote>
              <figcaption className="mt-5 text-sm">
                <span>{t.name}</span><span className="text-muted-foreground"> · {t.where}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </Wrap>
    </section>
  );
}

function Faq() {
  const [c] = useCopy();
  return (
    <section className="border-t py-20 md:py-28">
      <Wrap className="grid gap-10 md:grid-cols-[1fr_1.5fr]">
        <H2>{c.faqTitle}</H2>
        <Accordion type="single" collapsible>
          {c.faq.map((f) => (
            <AccordionItem key={f.q} value={f.q}>
              <AccordionTrigger className="text-left text-lg font-normal hover:no-underline">{f.q}</AccordionTrigger>
              <AccordionContent className="text-[15px] font-light leading-relaxed text-muted-foreground">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Wrap>
    </section>
  );
}

function Final() {
  const [c] = useCopy();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setState("busy");
    setError(null);
    try {
      await sendMagicLink(email);
      setState("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the link. Please try again.");
      setState("idle");
    }
  }
  return (
    <section className="py-20 md:py-28">
      <Wrap className="grid items-stretch gap-10 md:grid-cols-[1fr_1.2fr]">
        <div className="flex flex-col justify-center">
          <H2>{c.finalTitle}</H2>
          <p className="mt-5 max-w-md text-lg font-light text-muted-foreground">{c.finalBody}</p>
        </div>
        <div className="relative overflow-hidden rounded-xl">
          <img src="/video/hero-poster.jpg" alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover [filter:brightness(1.2)_saturate(1.05)]" />
          <div className="relative m-6 rounded-lg bg-white/80 p-6 backdrop-blur-md md:m-10">
            <ul className="space-y-2 text-[15px]">
              {c.finalPoints.map((p) => <li key={p} className="flex items-center gap-2"><Check className="h-4 w-4 text-success" /> {p}</li>)}
            </ul>
            {state === "sent" ? (
              <p className="mt-5 flex items-center gap-2"><MailCheck className="h-4 w-4" /> {c.sent}</p>
            ) : (
              <form onSubmit={submit} className="mt-5 flex items-center gap-2 rounded-full border bg-background p-1">
                <input type="email" required autoComplete="email" aria-label="Email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com" className="h-8 min-w-0 flex-1 bg-transparent px-3 text-[15px] font-light outline-none" />
                <button type="submit" disabled={state === "busy"} className="h-8 rounded-full bg-foreground px-4 text-sm text-background disabled:opacity-60">
                  {state === "busy" ? c.sending : c.getStarted}
                </button>
              </form>
            )}
            {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
          </div>
        </div>
      </Wrap>
    </section>
  );
}

function Footer() {
  const [c] = useCopy();
  return (
    <footer className="bg-[oklch(0.17_0.006_60)] text-white/85">
      <Wrap className="grid gap-12 py-16 md:grid-cols-[1.3fr_1fr_1fr]">
        <div>
          <Wordmark size="lg" tone="dark" />
          <p className="mt-5 max-w-sm text-lg font-light leading-relaxed text-white/80">{c.footerTag}</p>
          <div className="mt-6"><PillLink to="/login" light>{c.getStarted}</PillLink></div>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-white/50">{c.footerCols.explore}</p>
          <ul className="mt-4 space-y-2.5 text-[15px] font-light">
            <li><Link to="/argos" search={{ q: "", voice: false }} className="hover:text-white">Argos</Link></li>
            <li><Link to="/explore" className="hover:text-white">{c.nav.browse}</Link></li>
            <li><Link to="/pricing" className="hover:text-white">{c.nav.pricing}</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-white/50">{c.footerCols.company}</p>
          <ul className="mt-4 space-y-2.5 text-[15px] font-light">
            <li><Link to="/privacy" className="hover:text-white">Privacy</Link></li>
            <li><Link to="/terms" className="hover:text-white">Terms</Link></li>
            <li><a href="mailto:hello@odysstay.com" className="hover:text-white">hello@odysstay.com</a></li>
          </ul>
        </div>
      </Wrap>
      <Wrap className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 py-6 text-sm text-white/50">
        <p className="max-w-2xl">{c.legal}</p>
        <LangToggle light />
      </Wrap>
    </footer>
  );
}
