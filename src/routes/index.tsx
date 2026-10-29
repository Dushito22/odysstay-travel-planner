import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Check, MailCheck } from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";

import { ArgosComposer } from "@/components/odys/ArgosComposer";
import { ListingCard, ListingCardSkeleton } from "@/components/odys/ListingCard";
import { SourceQuote, Wordmark } from "@/components/odys/primitives";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LangToggle } from "@/components/odys/LangToggle";
import { useLang, type Lang } from "@/lib/i18n";
import { exampleFactQuery, sendMagicLink, sourceCountsQuery, topListingsQuery } from "@/lib/public";
import { cn } from "@/lib/utils";

const TITLE = "Odysstay | Describe your dream house";
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
      { property: "og:image", content: "/video/atrani-poster.jpg" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

/** Italic emphasis inside a headline, the Balance way: *like this*. */
function Em({ children }: { children: ReactNode }) {
  return <em className="font-display italic text-azure">{children}</em>;
}

/** Italic emphasis in azure, for accent phrases. */
function EmA({ children }: { children: ReactNode }) {
  return <em className="font-display italic text-azure">{children}</em>;
}
/** A single azure word inside a headline. */
function Az({ children }: { children: ReactNode }) {
  return <span className="text-azure">{children}</span>;
}

/** Azure accent words inside the hero help pop-up. */
function Hi({ children }: { children: ReactNode }) {
  return <span className="text-[oklch(0.8_0.1_238)]">{children}</span>;
}

/** Set to "/img/argos.webp" once the sketch arrives; until then a lettered card stands in. */
const ARGOS_SKETCH: string | null = "/img/argos-deeds.webp";

const COPY = {
  en: {
    nav: { how: "How it works", browse: "Browse", pricing: "Pricing", signIn: "Sign in" },
    eyebrow: "sprezzatura, on your behalf.",
    hero: "Describe your dream house.",
    placeholder: "A stone house in Puglia under €40k, near a bar, some work is fine…",
    helpTitle: "Talk to me like a friend.",
    help: <>Tell me <Hi>where</Hi>, <Hi>how much</Hi>, <Hi>sea or hills</Hi> and <Hi>how much work</Hi> you'll take on. I'll find it and do the Italian.</>,
    howTalk: "For example:",
    examples: ["Somewhere in Sicily under 30k. A house, not a flat. I can renovate.", "Show me the €1 towns in Sardinia.", "Something by the sea in the south, ready to live in, under 80k."],
    howTalkEnd: <>Tap the <Hi>mic</Hi> and speak any language, or type. Real houses appear while we talk.</>,
    helpLabel: "How to talk to Argos",
    chips: ["A stone house under €50k, some work is fine", "Show me the €1 houses", "Court auctions in Sicily under €30k", "Surprise me"],
    browseAll: "Rather browse? See every listing",
    powered: "Argos, your AI agent in Italy · powered by Claude and GPT",
    statement: [<>Italy sells houses <Em>below the court's valuation</Em>.</>, " Nobody tells you where."],
    argosLabel: "Your agent",
    argosTitle: <>Meet <Em>Argos</Em>.</>,
    argosStory: "Odysseus was gone for twenty years. When he finally came home in disguise, nobody knew him. Except Argos, his dog, who had waited the whole time.",
    argosNow: "Ours doesn't wait around. Every morning he reads every court notice in Italy, writes to notaries in better Italian than yours, calls when it's quicker, and tells you only what matters. Loyal, tireless, always by your side. And yes, he talks.",
    argosFacts: ["Reads every notice, every morning", "Writes and calls in Italian for you", "Speaks your language, whatever it is", "Never sleeps. Never sheds."],
    argosCta: "Talk to Argos",
    argosMeaning: "ἄργος · swift, bright",
    placesTitle: <>Where the houses are, <Em>if you know where to look</Em>.</>,
    placesLink: "Ask Argos",
    places: [
      { img: "coast", n: "01", title: "Puglia", body: "Coves, whitewash and masserie, many sold by the court below their valuation.", q: "A house near the sea in Puglia" },
      { img: "amalfi", n: "02", title: "The Amalfi Coast", body: "Rare and never cheap, but the courts sell here too. Argos watches every notice.", q: "Something on the Amalfi Coast" },
      { img: "tuscany", n: "03", title: "Tuscany", body: "Farmhouses at the end of cypress roads. Fewer bargains, better stories.", q: "A farmhouse in Tuscany" },
      { img: "alps", n: "04", title: "The Dolomites", body: "Wooden farmhouses under the peaks, for people who prefer snow to sea.", q: "A mountain house in Trentino" },
    ],
    notListedTitle: "Somewhere else?",
    notListedBody: "Argos reads every region, from the Alps to Lampedusa. Tell him where you'd like to wake up.",
    notListedCta: "Talk to Argos",
    statementBody: "Courts, notaries and town halls sell thousands of homes a year through notices nobody markets, in Italian, on websites from another century. We read every one of them, every day.",
    statMini: [
      { a: "Tribunale di Sciacca", b: "Base price vs the court's valuation", bar: true },
      { a: "Notary · sealed bids", b: "The envelopes open at noon" },
      { a: "Sicily, Sardinia, Molise…", b: "From €1, with a renovation pledge" },
      { a: "Added today", b: "Read by Argos before breakfast" },
    ],
    numbers: ["court sales open now", "notary and public-body sales", "towns selling houses for €1", "private auctions, added daily"],
    howEyebrow: "How it works",
    howTitle: <>Ten phone calls. <Em>One shrug.</Em></>,
    howBody: "Behind the curtain: courts, town halls, a geometra, a notary, a deadline at noon on a Tuesday. In front of it: you, unbothered.",
    steps: [
      { title: "Say it", body: "Budget, region, how much work you'll take on. Out loud, in any language.", chip: "Answered in seconds" },
      { title: "Argos does Italy", body: "Every notice read, the Italian translated, emails and calls to delegates and notaries. You approve each one.", chip: "Approved by you" },
      { title: "You pick. You own.", body: "A shortlist, one deal room, one notary, your name on the deed.", chip: "Never brave on the phone" },
    ],
    mockYou: "Puglia, under 40k, walk to a bar.",
    mockArgos: "Three. One's a wreck, one's fine, one's lovely and won't last.",
    mockMailTo: "To the sale delegate, Tribunale di Brindisi",
    mockMail: "Gentile Avvocato, Le scrivo per conto di un acquirente interessato al lotto 1…",
    mockDeal: ["Ceglie Messapica", "Offer filed", "Notary booked"],
    sprezz: { word: "sprezzatura", pron: "/sprets-ah-TOO-rah/ · noun · Italian", def: "The art of making the difficult look effortless.", note: "Castiglione, 1528. Back then it took a household of servants. Now it takes Argos.", sign: "Buying a house in Italy, apparently without effort." },
    housesTitle: <>The house you'll swear you <Em><Az>found</Az> by accident</Em>.</>,
    housesBody: "Real ones, open for offers today. Most need work and a little love. That's the whole discount.",
    seeAll: "See them all",
    proofEyebrow: "No source, no fact",
    proofTitle: <>If the notice doesn't say it, <Em>we don't either</Em>.</>,
    proofBody: "Every price, size and deadline links to the line it came from, with the translation beside it. If the document is silent, Argos says so. An agent that guesses is worse than no agent.",
    exampleLabel: "Example · Offer deadline",
    voicesTitle: <>They <EmA>barely tried</EmA>.</>,
    voices: [
      { img: "masseria", quote: "I said 'something in Puglia, under forty, walk to a bar'. Nine days later I was standing in it.", name: "Hannah & Tom", where: "Bristol → Ceglie Messapica" },
      { img: "cefalu", quote: "I don't speak a word of Italian. Argos called the notary, I drank coffee.", name: "Olga S.", where: "Moscow → Sciacca" },
      { img: "civita", quote: "The court papers were 84 pages. Argos told me the three lines that mattered.", name: "Marco & Lena", where: "Munich → Spoleto" },
      { img: "oranges", quote: "Bought a house for 19 thousand. My friends think I searched for ages.", name: "Dmitri K.", where: "St Petersburg → Agrigento" },
    ],
    faqTitle: <>Fair <Em>questions</Em>.</>,
    faq: [
      { q: "So who actually buys the house?", a: "You do. Argos finds it, reads every document, writes and calls in Italian, and keeps every deadline. You approve each message and you sign with the notary. We are a technology service, not an estate agency, law firm or notary." },
      { q: "Do I need to speak Italian?", a: "No. Talk to Argos in any language you like, out loud or typed. Everything Italian is translated, with the original one tap away, and every message Argos sends is shown to you in your language first." },
      { q: "Why are these houses so cheap?", a: "Most are sold by courts, notaries and towns, not agents, so nobody markets them. Most need work and a little love. That's the whole discount." },
      { q: "What about the €1 houses?", a: "Real, with conditions: a renovation within a few years and a deposit of a few thousand euros. Argos shows each town's actual rules and the houses still on offer." },
      { q: "Can foreigners buy property in Italy?", a: "Most nationalities can. It depends on your citizenship and Italy's reciprocity rules. Argos checks it for you, and the notary confirms it before you commit." },
      { q: "What does it cost?", a: "Exploring and talking to Argos is free to start. Pro adds unlimited deals, outreach and calls. Fees to the court, the notary or a surveyor are paid by you, directly to them." },
    ],
    finalTitle: <>Somewhere in Italy, a door is <Em>waiting for your key</Em>.</>,
    finalBody: "Argos is already looking for it. Free to start, no password, no card.",
    finalPoints: ["No obligation", "Real houses from day one", "Speak any language you like"],
    getStarted: "Get started",
    sending: "Sending",
    sent: "Check your inbox for the sign-in link.",
    footerTag: "Your agent for buying a house in Italy. Found, read, handled.",
    footerCols: { explore: "Explore", company: "Company" },
    credits: "Photo credits",
    legal: "Odysstay is a technology service, not an estate agency, law firm or notary. Always confirm with a qualified professional before committing.",
  },
  ru: {
    nav: { how: "Как это работает", browse: "Все дома", pricing: "Цены", signIn: "Войти" },
    eyebrow: "sprezzatura: искусство жить.",
    hero: "Расскажите, о каком доме мечтаете.",
    placeholder: "Каменный дом в Апулии до €40 000, чтобы бар рядом, ремонт не страшен…",
    helpTitle: "Говорите со мной как с другом.",
    help: <>Скажите, <Hi>где</Hi>, <Hi>за сколько</Hi>, <Hi>у моря или в холмах</Hi> и <Hi>сколько ремонта</Hi> готовы взять на себя. Найду сам, итальянский беру на себя.</>,
    howTalk: "Например:",
    examples: ["Что-нибудь на Сицилии до 30 тысяч. Именно дом, не квартиру. Ремонт не пугает.", "Покажи города на Сардинии, где дома продают за 1 евро.", "У моря на юге, чтобы сразу заехать, до 80 тысяч."],
    howTalkEnd: <>Нажмите на <Hi>микрофон</Hi> и говорите на любом языке или просто напишите. Дома начнут появляться прямо по ходу разговора.</>,
    helpLabel: "Как говорить с Argos",
    chips: ["Каменный дом до €50 тыс., ремонт не пугает", "Покажи дома за €1", "Суды на Сицилии, до €30 тыс.", "Удиви меня"],
    browseAll: "Просто посмотреть? Все объявления",
    powered: "Argos, ваш ИИ-агент в Италии · работает на Claude и GPT",
    statement: [<>Италия продаёт дома <Em>дешевле судебной оценки</Em>.</>, " Просто об этом никто не рассказывает."],
    argosLabel: "Ваш агент",
    argosTitle: <>Знакомьтесь, <Em>Argos</Em>.</>,
    argosStory: "Одиссей скитался двадцать лет. Когда он вернулся домой в лохмотьях нищего, его не узнал никто. Кроме Аргоса, старого пса, который ждал его все эти годы.",
    argosNow: "Наш Argos ждать не любит. Каждое утро он прочитывает все судебные объявления Италии, пишет нотариусам на таком итальянском, что позавидуют местные, звонит, когда так быстрее, а вам рассказывает только главное. Верный, неутомимый, всегда рядом. И да, он умеет говорить.",
    argosFacts: ["Каждое утро читает все объявления", "Пишет и звонит по-итальянски вместо вас", "Говорит на вашем языке, на любом", "Не спит. Не линяет."],
    argosCta: "Поговорить с Argos",
    argosMeaning: "ἄργος · быстрый, сияющий",
    placesTitle: <>Дома есть везде. <Em>Надо знать, где искать</Em>.</>,
    placesLink: "Спросить Argos",
    places: [
      { img: "coast", n: "01", title: "Апулия", body: "Бухты, белые стены и старые массерии. Многие продаёт суд дешевле оценки.", q: "Дом у моря в Апулии" },
      { img: "amalfi", n: "02", title: "Амальфитанское побережье", body: "Редкость, и недёшево, но суды продают и здесь. Argos не пропустит ни одного объявления.", q: "Что-нибудь на Амальфитанском побережье" },
      { img: "tuscany", n: "03", title: "Тоскана", body: "Фермерские дома в конце кипарисовых аллей. Скидок меньше, историй больше.", q: "Фермерский дом в Тоскане" },
      { img: "alps", n: "04", title: "Доломиты", body: "Деревянные дома под самыми вершинами. Для тех, кто снег любит больше моря.", q: "Горный дом в Трентино" },
    ],
    notListedTitle: "Ищете в другом месте?",
    notListedBody: "Argos знает всю Италию, от Альп до Лампедузы. Просто скажите, где хотите просыпаться.",
    notListedCta: "Поговорить с Argos",
    statementBody: "Суды, нотариусы и мэрии продают тысячи домов в год. Объявления никто не рекламирует: они на итальянском, на сайтах, застрявших в девяностых. Мы читаем их все, каждый день.",
    statMini: [
      { a: "Суд Шакки", b: "Стартовая цена и судебная оценка", bar: true },
      { a: "Нотариус · закрытые конверты", b: "Конверты вскроют в полдень" },
      { a: "Сицилия, Сардиния, Молизе…", b: "От €1, если возьмётесь за ремонт" },
      { a: "Новое сегодня", b: "Argos прочитал ещё до завтрака" },
    ],
    numbers: ["судебных продаж открыто", "продаж через нотариусов и госорганы", "городов продают дома за €1", "частных аукционов, новые каждый день"],
    howEyebrow: "Как это работает",
    howTitle: <>Десять звонков. <Em>Ноль нервов.</Em></>,
    howBody: "За кулисами: суды, мэрии, геометр, нотариус и дедлайн во вторник в полдень. На сцене: вы, с бокалом и в полном спокойствии.",
    steps: [
      { title: "Расскажите", body: "Бюджет, регион, сколько ремонта готовы взять на себя. Голосом, на любом языке.", chip: "Ответ за секунды" },
      { title: "Италию Argos берёт на себя", body: "Читает объявления, переводит итальянский, пишет и звонит делегатам и нотариусам. Без вашего «да» ничего не уходит.", chip: "Только с вашего одобрения" },
      { title: "Вы выбираете. Дом ваш.", body: "Короткий список, одна сделка, один нотариус и ваше имя в документах.", chip: "Звонить в Италию не придётся" },
    ],
    mockYou: "Апулия, до 40 тысяч, чтобы бар был рядом.",
    mockArgos: "Нашёл три. Один в руинах, второй неплох, а третий прелесть, и его быстро заберут.",
    mockMailTo: "Делегату по продаже, суд Бриндизи",
    mockMail: "Gentile Avvocato, Le scrivo per conto di un acquirente interessato al lotto 1…",
    mockDeal: ["Челье-Мессапика", "Предложение подано", "Нотариус назначен"],
    sprezz: { word: "sprezzatura", pron: "/спреццату́ра/ · сущ. · итал.", def: "Умение делать сложное так, будто это совсем легко.", note: "Кастильоне, 1528 год. Тогда для этого требовался целый штат слуг. Сегодня хватит одного Argos.", sign: "Купить дом в Италии, словно между делом." },
    housesTitle: <>Дом, который вы <Em>как будто <Az>нашли</Az> случайно</Em>.</>,
    housesBody: "Настоящие дома, открытые для предложений прямо сейчас. Почти всем нужен ремонт и немного любви. В этом и весь секрет цены.",
    seeAll: "Смотреть все",
    proofEyebrow: "Нет источника, нет факта",
    proofTitle: <>Чего нет в документах, <Em>того нет и у нас</Em>.</>,
    proofBody: "Каждая цена, площадь и срок ведут к строчке, откуда они взяты, и рядом перевод. Если в документе об этом ни слова, Argos так и скажет. Агент, который додумывает, хуже, чем никакого.",
    exampleLabel: "Пример · Срок подачи",
    voicesTitle: <>Они <EmA>даже не напрягались</EmA>.</>,
    voices: [
      { img: "masseria", quote: "Я сказала: «Апулия, до сорока тысяч, чтобы бар был рядом». Через девять дней я уже стояла на пороге.", name: "Ханна и Том", where: "Бристоль → Челье-Мессапика" },
      { img: "cefalu", quote: "Я не знаю ни слова по-итальянски. Argos звонил нотариусу, а я пила кофе.", name: "Ольга С.", where: "Москва → Шакка" },
      { img: "civita", quote: "Судебные документы на 84 страницы. Argos показал три строчки, которые действительно важны.", name: "Марко и Лена", where: "Мюнхен → Сполето" },
      { img: "oranges", quote: "Купил дом за 19 тысяч. Друзья уверены, что я искал его годами.", name: "Дмитрий К.", where: "Санкт-Петербург → Агридженто" },
    ],
    faqTitle: <>Вопросы, <Em>которые задают все</Em>.</>,
    faq: [
      { q: "Так кто же покупает дом?", a: "Вы. Argos находит дом, читает все документы, пишет и звонит по-итальянски и следит за сроками. Каждое письмо вы одобряете сами, а подписываете у нотариуса. Мы технологический сервис, а не агентство, юристы или нотариус." },
      { q: "Нужно ли знать итальянский?", a: "Нет. Говорите с Argos на любом языке, голосом или текстом. Всё итальянское переведено, оригинал в одно касание, а каждое письмо Argos сначала показывает вам на вашем языке." },
      { q: "Почему эти дома такие дешёвые?", a: "Их продают суды, нотариусы и мэрии, а не агенты, поэтому рекламой никто не занимается. Почти всем нужен ремонт и немного любви. В этом и весь секрет цены." },
      { q: "А дома за 1 евро правда существуют?", a: "Да, но с условиями: ремонт за несколько лет и залог в несколько тысяч евро. Argos покажет реальные правила каждого города и дома, которые ещё свободны." },
      { q: "Может ли иностранец купить дом в Италии?", a: "Граждане большинства стран могут. Всё зависит от гражданства и принципа взаимности. Argos проверит, а нотариус подтвердит ещё до сделки." },
      { q: "Сколько это стоит?", a: "Смотреть дома и говорить с Argos можно бесплатно. Pro открывает неограниченные сделки, переписку и звонки. Пошлины суду, нотариусу или геометру вы платите им напрямую." },
    ],
    finalTitle: <>Где-то в Италии дверь <Em>уже ждёт ваш ключ</Em>.</>,
    finalBody: "Argos уже ищет её. Бесплатно, без пароля и без карты.",
    finalPoints: ["Ни к чему не обязывает", "Настоящие дома с первого дня", "На любом языке"],
    getStarted: "Начать",
    sending: "Отправляем",
    sent: "Загляните в почту: там ссылка для входа.",
    footerTag: "Ваш агент по покупке дома в Италии. Найдёт, прочитает, договорится.",
    footerCols: { explore: "Сервис", company: "Компания" },
    credits: "Авторы фото",
    legal: "Odysstay: технологический сервис, а не агентство недвижимости, юристы или нотариус. Перед решением всегда консультируйтесь со специалистом.",
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
      <SiteHeader />
      <Hero />
      <MeetArgos />
      <Statement />
      <Places />
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

/** Balance's button: a pill with the label and an arrow in a small circle. */
function PillLink({ to, children, light = false, search }: { to: string; children: ReactNode; light?: boolean; search?: Record<string, unknown> }) {
  return (
    <Link to={to} search={search as never}
      className={cn("group inline-flex h-10 items-center gap-2.5 rounded-full pl-[18px] pr-1 text-[15px] font-light transition-colors",
        light ? "bg-white/90 text-foreground hover:bg-white" : "bg-foreground text-background hover:bg-foreground/90")}>
      {children}
      <span className={cn("flex h-8 w-8 items-center justify-center rounded-full border transition-transform group-hover:translate-x-0.5",
        light ? "border-foreground/25" : "border-white/30")}>
        <ArrowRight className="h-3.5 w-3.5" />
      </span>
    </Link>
  );
}

/** Underlined text link with an arrow, as Balance's "Explore services". */
function ArrowLink({ to, children, search, light = false }: { to: string; children: ReactNode; search?: Record<string, unknown>; light?: boolean }) {
  return (
    <Link to={to} search={search as never}
      className={cn("group inline-flex items-center gap-2 border-b pb-1 text-[17px] font-light transition-colors",
        light ? "border-white/30 hover:border-white" : "border-foreground/25 hover:border-foreground")}>
      {children} <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

/** Fixed header: transparent over the video, frosted white once you scroll into the page. */
function SiteHeader() {
  const [c] = useCopy();
  const [solid, setSolid] = useState(false);
  useEffect(() => {
    const on = () => setSolid(window.scrollY > window.innerHeight - 90);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  const link = cn("hidden text-[15px] font-light transition-colors md:block", solid ? "text-foreground/75 hover:text-foreground" : "text-white/85 hover:text-white");
  return (
    <header className={cn("fixed inset-x-0 top-0 z-40 transition-[background-color,border-color] duration-300",
      solid ? "border-b border-foreground/10 bg-white/70 backdrop-blur-[28px]" : "border-b border-transparent")}>
      <div className="mx-auto grid h-16 w-full max-w-[1440px] grid-cols-[1fr_auto_1fr] items-center px-5 md:px-14">
        <Link to="/" aria-label="Odysstay home" className="justify-self-start"><Wordmark size="md" tone={solid ? "light" : "dark"} /></Link>
        <nav className="flex items-center gap-8">
          <a href="#how" className={link}>{c.nav.how}</a>
          <Link to="/explore" className={link}>{c.nav.browse}</Link>
          <Link to="/pricing" className={link}>{c.nav.pricing}</Link>
        </nav>
        <div className="flex items-center gap-5 justify-self-end">
          <LangToggle light={!solid} />
          <PillLink to="/login" light={!solid}>{c.nav.signIn}</PillLink>
        </div>
      </div>
    </header>
  );
}

function HeroVideo() {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setSrc(window.innerWidth < 900 ? "/video/atrani-720.mp4" : "/video/atrani-1080.mp4");
    }
  }, []);
  const look = "absolute inset-0 h-full w-full object-cover [filter:brightness(1.16)_contrast(1.02)_saturate(0.92)]";
  return (
    <>
      <img src="/video/atrani-poster.jpg" alt="" aria-hidden className={look} />
      {src && <video src={src} autoPlay muted loop playsInline preload="auto" aria-hidden className={look} />}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,oklch(0.18_0.02_250/0.34),oklch(0.15_0.02_250/0.1)_72%)]" />
      <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/30 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/30 to-transparent" />
      <div className="grain-overlay opacity-[0.3]" />
    </>
  );
}

function Hero() {
  const [c, lang] = useCopy();
  const navigate = useNavigate();
  const go = (q: string, spoken = false) => navigate({ to: "/argos", search: { q, ...(spoken ? { voice: true } : {}) } });
  return (
    <section className="relative flex min-h-[100svh] flex-col overflow-hidden bg-foreground text-white">
      <HeroVideo />
      <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-5 pb-16 pt-24 text-center">
        <p className="font-display text-[24px] italic leading-none text-white/90 md:text-[30px]">
          <span className="text-[oklch(0.84_0.085_236)]">{c.eyebrow.split(/[,:]/)[0]}</span>{c.eyebrow.slice(c.eyebrow.split(/[,:]/)[0]!.length)}
        </p>
        <h1 className="mt-6 type-h1 text-[38px] md:mt-7 md:text-[52px]">{c.hero}</h1>
        <div className="mt-9 flex w-full max-w-[640px] items-center gap-2.5">
          <span aria-hidden className="hidden w-7 shrink-0 sm:block" />
          <div className="min-w-0 flex-1">
            <ArgosComposer onSubmit={go} placeholder={c.placeholder} lang={lang === "ru" ? "ru-RU" : "en-GB"} />
          </div>
          <HelpDot />
        </div>
        <div className="mt-6 flex max-w-[620px] flex-wrap justify-center gap-1.5">
          {c.chips.map((chip) => (
            <button key={chip} type="button" onClick={() => go(chip)}
              className="h-8 rounded-full border border-white/25 bg-white/10 px-3.5 text-[13px] font-light text-white/90 backdrop-blur-md transition-colors hover:bg-white/20">
              {chip}
            </button>
          ))}
        </div>
      </div>
      <div className="relative z-10 flex flex-col items-center gap-4 px-5 pb-6">
        <Link to="/explore"
          className="group inline-flex h-10 items-center gap-2 rounded-full border border-white/25 bg-azure/75 pl-5 pr-1.5 text-[14px] font-light text-white shadow-[0_10px_30px_-12px_oklch(0.52_0.13_245/0.8)] backdrop-blur-md transition-colors hover:bg-azure/90">
          {c.browseAll}
          <span className="flex h-7 w-7 items-center justify-center rounded-full border border-white/35 transition-transform group-hover:translate-x-0.5">
            <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </Link>
        <p className="text-center text-xs font-light text-white/55">{c.powered}</p>
      </div>
    </section>
  );
}

/** The azure "?" dot beside the chatbox, like the dot in the wordmark. Opens a small grainy note on how to talk to Argos. */
function HelpDot() {
  const [c] = useCopy();
  return (
    <Popover>
      <PopoverTrigger
        aria-label={c.helpLabel}
        className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-azure font-display text-[17px] italic leading-none text-white shadow-[0_0_0_4px_oklch(0.52_0.13_245/0.22)] transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
      >
        ?
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="end"
        sideOffset={12}
        className="relative w-[min(340px,calc(100vw-32px))] overflow-hidden rounded-2xl border border-white/20 bg-[oklch(0.22_0.02_245/0.62)] p-5 text-white shadow-[0_24px_60px_-24px_oklch(0_0_0/0.6)] backdrop-blur-2xl"
      >
        <div className="grain-overlay opacity-[0.35]" />
        <div className="relative">
          <p className="font-display text-[22px] italic leading-tight">{c.helpTitle}</p>
          <p className="mt-2 text-[14px] font-light leading-relaxed text-white/85">{c.help}</p>
          <p className="mt-4 text-[11px] uppercase tracking-[0.12em] text-white/50">{c.howTalk}</p>
          <ul className="mt-2 space-y-1.5 text-[13px] font-light leading-relaxed text-white/80">
            {c.examples.map((e) => <li key={e}>“{e}”</li>)}
          </ul>
          <p className="mt-4 border-t border-white/15 pt-3 text-[13px] font-light leading-relaxed text-white/75">{c.howTalkEnd}</p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Argos, right after the hero: who he is, with a wink at the Odyssey. */
function MeetArgos() {
  const [c] = useCopy();
  return (
    <section className="py-20 md:py-32">
      <Wrap className="grid items-center gap-12 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-20">
        <div className="grain relative flex aspect-[4/5] max-h-[600px] w-full flex-col items-center justify-center overflow-hidden rounded-[10px] bg-muted">
          {ARGOS_SKETCH ? (
            <img src={ARGOS_SKETCH} alt="Argos at his desk, reading a property deed" loading="lazy" className="absolute inset-x-0 bottom-0 h-[88%] w-full object-contain object-bottom" />
          ) : (
            <>
              <p className="font-display text-[88px] italic leading-none text-azure tracking-[-0.02em] md:text-[112px]">
                Argos<span className="ml-1 inline-block h-[0.14em] w-[0.14em] rounded-full bg-azure align-baseline" />
              </p>
              <p className="mt-5 text-[13px] font-light tracking-[0.04em] text-foreground/55">{c.argosMeaning}</p>
            </>
          )}
        </div>
        <div>
          <Label>{c.argosLabel}</Label>
          <H2 className="mt-5">{c.argosTitle}</H2>
          <p className="mt-7 max-w-[600px] font-display text-[22px] italic leading-snug text-foreground/80 md:text-[24px]">{c.argosStory}</p>
          <p className="mt-5 max-w-[600px] type-body text-foreground/62">{c.argosNow}</p>
          <ul className="mt-9 grid max-w-[600px] gap-x-8 gap-y-3 sm:grid-cols-2">
            {c.argosFacts.map((f) => (
              <li key={f} className="flex items-start gap-3 text-[15px] font-light">
                <span aria-hidden className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-azure" />
                {f}
              </li>
            ))}
          </ul>
          <div className="mt-10">
            <PillLink to="/argos" search={{ q: "", voice: false }}>{c.argosCta}</PillLink>
          </div>
        </div>
      </Wrap>
    </section>
  );
}

const Wrap = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn("mx-auto w-full max-w-[1440px] px-5 md:px-14", className)}>{children}</div>
);
const Label = ({ children, className }: { children: ReactNode; className?: string }) => (
  <p className={cn("type-label text-foreground/60", className)}>{children}</p>
);
const H2 = ({ children, className }: { children: ReactNode; className?: string }) => (
  <h2 className={cn("max-w-[920px] type-h2", className)}>{children}</h2>
);
const Lead = ({ children, className }: { children: ReactNode; className?: string }) => (
  <p className={cn("max-w-[680px] type-lead text-foreground/65", className)}>{children}</p>
);
/** Section rhythm from Balance: 128px top and bottom on desktop. */
const SECTION = "py-20 md:py-32";

/** A grainy photograph, the Balance way: black and white, soft, film grain baked in. */
function Photo({ name, alt, className }: { name: string; alt: string; className?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-[10px] bg-muted", className)}>
      <img src={`/img/${name}.webp`} alt={alt} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.025]" />
    </div>
  );
}

function Statement() {
  const [c] = useCopy();
  const n = useQuery(sourceCountsQuery).data;
  const fmt = (v: number | undefined, f: string) => (v ? v.toLocaleString("en-GB") : f);
  const nums = [fmt(n?.court, "16,000"), fmt(n?.notary, "99"), fmt(n?.oneEuro, "73"), n?.privateSales ? n.privateSales.toLocaleString("en-GB") : "+"];
  return (
    <section className={SECTION}>
      <Wrap>
        <H2>{c.statement[0]}{c.statement[1]}</H2>
        <Lead className="mt-7">{c.statementBody}</Lead>
        <dl className="mt-12 grid grid-cols-2 gap-3 md:mt-14 lg:grid-cols-4 lg:gap-6">
          {nums.map((v, i) => (
            <div key={i} className="grain flex min-h-[220px] flex-col rounded-[10px] border border-foreground/[0.07] bg-muted p-5 md:min-h-[268px] md:p-7">
              <dt className="font-display text-[38px] leading-none tracking-[-0.02em] tnum md:text-[52px]">{v}</dt>
              <dd className="mt-3 text-[13px] font-light text-foreground/62 md:text-[15px]">{c.numbers[i]}</dd>
              <StatMini {...c.statMini[i]!} />
            </div>
          ))}
        </dl>
      </Wrap>
    </section>
  );
}

/** The little example card at the bottom of each number box, so the boxes show what the number is made of. */
function StatMini({ a, b, bar }: { a: string; b: string; bar?: boolean }) {
  return (
    <div className="mt-auto rounded-[8px] border border-white/80 bg-white/70 px-3.5 py-3 shadow-[0_1px_2px_oklch(0_0_0/0.04)]">
      <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.1em] text-foreground/55">
        <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-azure" />
        <span className="truncate">{a}</span>
      </p>
      {bar && (
        <div aria-hidden className="mt-2.5 space-y-1">
          <div className="h-1.5 w-full rounded-full bg-foreground/12" />
          <div className="h-1.5 w-[51%] rounded-full bg-azure" />
        </div>
      )}
      <p className="mt-2 text-[12px] font-light leading-snug text-foreground/75 md:text-[13px]">{b}</p>
    </div>
  );
}

function Places() {
  const [c] = useCopy();
  return (
    <section className="pb-20 md:pb-32">
      <Wrap>
        <H2>{c.placesTitle}</H2>
        <div className="mt-12 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
          {c.places.map((p) => (
            <Link key={p.n} to="/argos" search={{ q: p.q, voice: false }} className="group block">
              <Photo name={p.img} alt={p.title} className="aspect-[4/5]" />
              <div className="mt-6 flex items-baseline gap-4">
                <span className="font-display text-[28px] leading-none text-foreground/45">{p.n}</span>
                <h3 className="font-sans text-[20px] font-light tracking-normal md:text-[22px]">{p.title}</h3>
              </div>
              <p className="mt-4 text-[15px] font-light leading-relaxed text-foreground/62">{p.body}</p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-light text-foreground/55 transition-colors group-hover:text-azure">
                {c.placesLink} <ArrowRight className="h-3 w-3" />
              </span>
            </Link>
          ))}
        </div>
        <div className="mt-16 flex flex-wrap items-center justify-between gap-6 border-t border-foreground/10 pt-10">
          <div>
            <h3 className="type-h3">{c.notListedTitle}</h3>
            <p className="mt-2 type-body text-foreground/62">{c.notListedBody}</p>
          </div>
          <Link to="/argos" search={{ q: "", voice: false }}
            className="inline-flex h-11 items-center rounded-[10px] bg-foreground px-6 text-[15px] text-background transition-colors hover:bg-foreground/90">
            {c.notListedCta}
          </Link>
        </div>
      </Wrap>
    </section>
  );
}

function MockFrame({ children, chip }: { children: ReactNode; chip: string }) {
  return (
    <div className="mt-8 flex min-h-[250px] flex-col items-center justify-between rounded-[8px] bg-gradient-to-b from-[oklch(0.93_0.02_240)] via-[oklch(0.955_0.012_240)] to-[oklch(0.97_0.008_230)] p-5">
      <div className="w-full flex-1 content-center">{children}</div>
      <span className="mt-5 rounded-full bg-white/70 px-4 py-1.5 text-[13px] font-light text-foreground/70">{chip}</span>
    </div>
  );
}

function HowItWorks() {
  const [c] = useCopy();
  return (
    <section id="how" className={cn("grain scroll-mt-16 bg-muted", SECTION)}>
      <Wrap>
        <div className="grid items-end gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
          <div className="md:pb-6">
            <Label>{c.howEyebrow}</Label>
            <H2 className="mt-5">{c.howTitle}</H2>
            <Lead className="mt-6 max-w-[620px]">{c.howBody}</Lead>
          </div>
          <img src="/img/argos-phones.webp" alt="Argos on two phones at once" loading="lazy"
            className="mx-auto h-[190px] w-auto object-contain [mask-image:linear-gradient(to_bottom,black_88%,transparent)] md:h-[250px]" />
        </div>
        <div className="mt-10 grid gap-5 lg:grid-cols-3 lg:gap-6">
          {c.steps.map((s, i) => (
            <div key={s.title} className="rounded-[10px] border border-white/70 bg-white/55 p-6 md:p-7">
              <h3 className="type-h3">{s.title}</h3>
              <p className="mt-3 type-body text-foreground/62">{s.body}</p>
              <MockFrame chip={s.chip}>
                {i === 0 && (
                  <div className="space-y-2 text-left text-[13px]">
                    <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-foreground px-3 py-2 font-light text-background">{c.mockYou}</p>
                    <div className="w-fit max-w-[90%] rounded-2xl rounded-bl-md border border-foreground/10 bg-white px-3 py-2 shadow-[0_1px_2px_oklch(0_0_0/0.04)]">
                      <p className="font-display text-[15px] italic text-azure">Argos</p>
                      <p className="font-light">{c.mockArgos}</p>
                    </div>
                  </div>
                )}
                {i === 1 && (
                  <div className="rounded-[8px] border border-foreground/10 bg-white p-4 text-left text-[13px] shadow-[0_1px_2px_oklch(0_0_0/0.04)]">
                    <p className="text-[11px] uppercase tracking-[0.12em] text-foreground/50">{c.mockMailTo}</p>
                    <p className="mt-2 font-light italic text-foreground/70" lang="it">{c.mockMail}</p>
                    <p className="mt-3 flex items-center gap-1.5"><span className="flex h-4 w-4 items-center justify-center rounded-full bg-foreground text-background"><Check className="h-2.5 w-2.5" /></span> {c.steps[1]!.chip}</p>
                  </div>
                )}
                {i === 2 && (
                  <div className="rounded-[8px] border border-foreground/10 bg-white p-4 text-left text-[13px] shadow-[0_1px_2px_oklch(0_0_0/0.04)]">
                    <p className="text-[11px] uppercase tracking-[0.12em] text-foreground/50">Deal room</p>
                    <p className="mt-1 font-display text-[22px]">{c.mockDeal[0]}</p>
                    {c.mockDeal.slice(1).map((d) => (
                      <p key={d} className="mt-2 flex items-center gap-1.5"><span className="flex h-4 w-4 items-center justify-center rounded-full bg-foreground text-background"><Check className="h-2.5 w-2.5" /></span> {d}</p>
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
    <section className={SECTION}>
      <Wrap className="grid items-center gap-12 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:gap-20">
        <Photo name="lunch" alt="Lunch by the sea under a fringed umbrella" className="aspect-[4/5] max-h-[620px]" />
        <div className="max-w-xl">
        <img src="/img/lemon.webp" alt="" aria-hidden loading="lazy" className="mb-6 h-[90px] w-auto -rotate-6 object-contain md:h-[115px]" />
        <div className="border-y border-foreground/15 py-10">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
            <p className="font-display text-[48px] italic leading-none tracking-[-0.01em] text-azure">{s.word}</p>
            <p className="type-label text-[11px] text-foreground/50">{s.pron}</p>
          </div>
          <p className="mt-7 type-lead">{s.def}</p>
          <p className="mt-4 type-body text-foreground/62">{s.note}</p>
          <p className="mt-8 text-right font-display text-[20px] italic text-foreground/60">{s.sign}</p>
        </div>
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
    <section className="pb-20 md:pb-32">
      <Wrap>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <H2>{c.housesTitle}</H2>
            <Lead className="mt-6">{c.housesBody}</Lead>
          </div>
          <ArrowLink to="/explore">{c.seeAll}</ArrowLink>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {q.isLoading
            ? Array.from({ length: 3 }, (_, i) => <ListingCardSkeleton key={i} />)
            : (q.data ?? []).slice(0, 6).map((r) => <ListingCard key={r.id} row={r} profile={null} />)}
        </div>
      </Wrap>
    </section>
  );
}

/** Dark band, like Balance's "Your data stays yours." */
function Proof() {
  const [c] = useCopy();
  const top = useQuery(topListingsQuery(3));
  const f = useQuery(exampleFactQuery(top.data?.[0])).data;
  return (
    <section className={cn("relative overflow-hidden", SECTION)}>
      <img src="/img/cypress-wide.webp" alt="" aria-hidden loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-[oklch(0.22_0.03_250/0.72)] via-[oklch(0.25_0.03_250/0.45)] to-[oklch(0.25_0.03_250/0.2)]" />
      <div className="grain-overlay opacity-[0.3]" />
      <Wrap className="relative grid items-center gap-14 text-white md:grid-cols-2">
        <div className="[&_em]:text-[oklch(0.84_0.085_236)]">
          <Label className="text-white/70">{c.proofEyebrow}</Label>
          <H2 className="mt-5 [text-shadow:0_1px_18px_oklch(0.2_0.03_250/0.45)]">{c.proofTitle}</H2>
          <p className="mt-6 max-w-md type-body text-white/85 [text-shadow:0_1px_12px_oklch(0.2_0.03_250/0.5)]">{c.proofBody}</p>
        </div>
        <div className="relative overflow-hidden rounded-[10px] border border-white/25 bg-[oklch(0.22_0.03_250/0.35)] p-7 shadow-[0_24px_60px_-30px_oklch(0_0_0/0.6)] backdrop-blur-xl md:p-8">
          <p className="type-label text-[11px] text-white/60">{f ? `${f.comune ?? ""} · ${f.label_en}` : c.exampleLabel}</p>
          <div className="mt-4 font-display text-[36px] leading-tight [&_button]:border-white/30 [&_button]:text-white [&_button:hover]:bg-white/10">
            {f ? <SourceQuote quote={f.quote} quoteEn={f.quote_en} page={f.page} sourceUrl={f.source_url}>{f.value_text ?? f.value_num}</SourceQuote> : "17 July 2026, 12:00"}
          </div>
          <div className="mt-6 h-px bg-white/20" />
          <blockquote lang="it" className="mt-6 border-l border-[oklch(0.84_0.085_236)] pl-4 text-[15px] font-light leading-relaxed text-white/90">
            “{f ? f.quote : "Le offerte dovranno pervenire entro e non oltre le ore 12:00 del 17 luglio 2026."}”
          </blockquote>
          <p className="mt-2 pl-4 text-[15px] font-light text-white/65">{f ? f.quote_en : "Offers must arrive no later than 12:00 on 17 July 2026."}</p>
        </div>
      </Wrap>
    </section>
  );
}

function Voices() {
  const [c] = useCopy();
  return (
    <section className={SECTION}>
      <Wrap>
        <H2>{c.voicesTitle}</H2>
        <div className="mt-12 grid gap-5 lg:grid-cols-2 lg:gap-6">
          {c.voices.map((t) => (
            <figure key={t.name} className="grain grid gap-6 rounded-[10px] bg-muted p-6 sm:grid-cols-[180px_1fr] md:p-8">
              <Photo name={t.img} alt="" className="aspect-square w-full max-w-[220px] rounded-[8px]" />
              <div className="flex flex-col justify-between gap-6">
                <blockquote className="text-[19px] font-light leading-relaxed">“{t.quote}”</blockquote>
                <figcaption className="flex items-center gap-2 text-[15px] font-light">
                  <span aria-hidden className="text-azure">✦</span>
                  <span>{t.name}</span><span className="text-foreground/50">· {t.where}</span>
                </figcaption>
              </div>
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
    <section className={cn("border-t border-foreground/10", SECTION)}>
      <Wrap className="grid gap-10 md:grid-cols-[1fr_1.5fr]">
        <div className="flex flex-col md:max-w-[420px] md:items-center md:text-center">
          <H2>{c.faqTitle}</H2>
          <img src="/img/medusa.webp" alt="A Sicilian mosaic head of Medusa" loading="lazy" className="mt-10 hidden h-[270px] w-auto object-contain md:block" />
        </div>
        <Accordion type="single" collapsible>
          {c.faq.map((f) => (
            <AccordionItem key={f.q} value={f.q} className="border-foreground/12">
              <AccordionTrigger className="py-5 text-left font-sans text-[19px] font-light tracking-normal hover:no-underline">{f.q}</AccordionTrigger>
              <AccordionContent className="pb-6 type-body text-foreground/62">{f.a}</AccordionContent>
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
    <section className={cn("bg-muted grain", SECTION)}>
      <Wrap className="grid items-center gap-12 md:grid-cols-[1fr_1.35fr] md:gap-16">
        <div>
          <H2>{c.finalTitle}</H2>
          <p className="mt-6 max-w-md type-body text-foreground/62">{c.finalBody}</p>
        </div>
        <div className="relative overflow-hidden rounded-[10px]">
          <img src="/img/sky.webp" alt="" aria-hidden loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
          <div className="relative m-6 rounded-[10px] border border-white/60 bg-white/55 p-7 backdrop-blur-xl md:m-12 md:p-9">
            <p className="type-label text-[11px] text-foreground/55">{c.getStarted}</p>
            <ul className="mt-5 space-y-3 text-[16px] font-light">
              {c.finalPoints.map((p) => <li key={p} className="flex items-center gap-3"><Check className="h-4 w-4 text-foreground/60" /> {p}</li>)}
            </ul>
            {state === "sent" ? (
              <p className="mt-7 flex items-center gap-2 font-light"><MailCheck className="h-4 w-4" /> {c.sent}</p>
            ) : (
              <form onSubmit={submit} className="mt-7 flex items-center gap-2 rounded-full border border-foreground/10 bg-white p-1">
                <input type="email" required autoComplete="email" aria-label="Email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com" className="h-9 min-w-0 flex-1 bg-transparent px-3 text-[15px] font-light outline-none" />
                <button type="submit" disabled={state === "busy"} className="h-9 rounded-full bg-foreground px-5 text-[14px] text-background disabled:opacity-60">
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
  const link = "text-[15px] font-light text-white/80 transition-colors hover:text-white";
  return (
    <footer className="relative overflow-hidden text-white">
      <img src="/img/olives.webp" alt="" aria-hidden loading="lazy" className="absolute inset-0 h-full w-full object-cover object-[50%_70%]" />
      <div className="absolute inset-0 bg-gradient-to-t from-[oklch(0.22_0.03_250/0.72)] via-[oklch(0.25_0.03_250/0.28)] to-transparent" />
      <div className="grain-overlay opacity-[0.3]" />
      <Wrap className="relative grid gap-10 pb-10 pt-40 md:grid-cols-[1.2fr_1fr] md:items-end md:pt-56">
        <div>
          <Wordmark size="lg" tone="dark" />
          <p className="mt-4 max-w-sm text-[17px] font-light leading-relaxed text-white/85">{c.footerTag}</p>
        </div>
        <nav className="flex flex-wrap gap-x-7 gap-y-3 md:justify-end">
          <Link to="/argos" search={{ q: "", voice: false }} className={link}>Argos</Link>
          <Link to="/explore" className={link}>{c.nav.browse}</Link>
          <Link to="/pricing" className={link}>{c.nav.pricing}</Link>
          <Link to="/privacy" className={link}>Privacy</Link>
          <Link to="/terms" className={link}>Terms</Link>
          <Link to="/credits" className={link}>{c.credits}</Link>
          <a href="mailto:hello@odysstay.com" className={link}>hello@odysstay.com</a>
        </nav>
      </Wrap>
      <Wrap className="relative flex flex-wrap items-center justify-between gap-4 border-t border-white/15 py-5 text-[13px] font-light text-white/60">
        <p className="max-w-2xl">{c.legal}</p>
        <LangToggle light />
      </Wrap>
    </footer>
  );
}
