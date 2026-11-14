import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, CircleHelp, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { openArgos } from "@/components/odys/ArgosDock";
import { chooseLang, useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * What Odysstay is, in five pictures: the ways Italian houses come up for sale (the €1 schemes, court and
 * town-hall auctions, ordinary listings) and what Argos does about them. Opens by itself on a first visit;
 * after that, from the "?" button or the side menu.
 */
const SEEN = "odys-intro-seen-v1";
const EVENT = "odys:guide";
const HIDDEN = ["/tg", "/login", "/onboarding", "/styleguide"];

export function openGuide() {
  window.dispatchEvent(new CustomEvent(EVENT));
}

type Slide = { img: string; pos?: string; title: [string, string]; body: [string, string]; facts: [string, string][] };

const SLIDES: Slide[] = [
  {
    img: "/img/cypress-wide.webp",
    title: ["Italy is quietly selling houses", "Италия тихо распродаёт дома"],
    body: [
      "Every year thousands of homes go on sale in ways most people never hear about: villages giving away empty houses for €1, courts and town halls auctioning property, and ordinary village houses priced like a used car. Odysstay finds them in one place and helps you buy one, from anywhere.",
      "Каждый год тысячи домов продаются так, что о них почти никто не слышит: деревни отдают пустые дома за €1, суды и мэрии продают недвижимость на торгах, а обычный дом в деревне стоит как подержанная машина. Odysstay собирает всё в одном месте и помогает купить, откуда бы вы ни были.",
    ],
    facts: [["€1 houses", "Дома за €1"], ["Court and town sales", "Торги судов и мэрий"], ["Ordinary listings", "Обычные объявления"]],
  },
  {
    img: "/img/civita.webp",
    title: ["Houses for €1. Really.", "Дом за €1. Правда."],
    body: [
      "Villages that are losing people sell abandoned houses for a symbolic euro, to anyone, foreigners included. In return you promise to renovate: usually a plan within a year and the works within about three years, with a deposit of a few thousand euros as a guarantee. The house is nearly free; the renovation is the real price, often €20,000 to €60,000. Rules differ from town to town.",
      "Деревни, из которых уезжают люди, продают заброшенные дома за символический евро. Купить может любой, иностранцы тоже. Взамен вы обещаете ремонт: обычно проект в течение года и работы примерно за три года, плюс залог в несколько тысяч евро как гарантия. Дом почти бесплатный, настоящая цена в ремонте, часто от €20 000 до €60 000. Правила в каждой коммуне свои.",
    ],
    facts: [["€1 to buy", "€1 за дом"], ["€1–5k guarantee", "Залог €1–5 тыс."], ["About 3 years to renovate", "Около 3 лет на ремонт"]],
  },
  {
    img: "/img/argos-deeds.webp", pos: "50% 18%",
    title: ["Court and town hall sales", "Торги судов и мэрий"],
    body: [
      "When an owner can't pay their debts, an Italian court sells the house at auction, often well below its official valuation. If nobody bids, the next round starts lower, by up to a quarter each time. Town halls also sell their own buildings in public tenders. The papers are dense legal Italian. Argos reads them for you.",
      "Когда владелец не может расплатиться с долгами, итальянский суд продаёт дом на торгах, часто заметно ниже официальной оценки. Если ставок нет, следующий раунд начинается дешевле, до четверти каждый раз. Мэрии тоже продают свои здания на открытых конкурсах. Документы написаны тяжёлым юридическим итальянским. Argos прочитает их за вас.",
    ],
    facts: [["Below the court valuation", "Ниже оценки суда"], ["Up to −25% each unsold round", "До −25% после каждого раунда"], ["Bids online or through a delegate", "Ставки онлайн или через делегата"]],
  },
  {
    img: "/img/masseria.webp",
    title: ["And ordinary houses, cheaper than you think", "И обычные дома дешевле, чем кажется"],
    body: [
      "Agencies and private owners sell village houses for €15,000 to €60,000 every day. We check each one against local prices, show what it will really cost with tax, notary and agency, and tell you the catch before you fall in love.",
      "Агентства и владельцы каждый день продают дома в деревнях за €15 000–60 000. Мы сравниваем каждый с местными ценами, показываем полную стоимость с налогом, нотариусом и агентством и честно говорим, в чём подвох, пока вы не влюбились.",
    ],
    facts: [["A deal score for every house", "Оценка сделки для каждого дома"], ["The full cost, to the euro", "Полная стоимость до евро"], ["The catch, in plain words", "Подвох простыми словами"]],
  },
  {
    img: "/img/argos-phones.webp", pos: "50% 12%",
    title: ["Argos does the Italian part", "Argos берёт итальянскую часть на себя"],
    body: [
      "Argos is your AI agent in Italy. He reads the notices, adds up every cost, writes to sellers, agencies and town halls in Italian, follows up, and asks your OK before anything that commits money. Looking is free, and so are your first three deals with Argos.",
      "Argos ваш ИИ-агент в Италии. Он читает объявления, считает все расходы, пишет продавцам, агентствам и мэриям по-итальянски, напоминает о себе и спрашивает ваше «да» перед всем, что касается денег. Смотреть дома бесплатно, первые три сделки с Argos тоже.",
    ],
    facts: [["Writes in Italian for you", "Пишет по-итальянски за вас"], ["Your OK before money", "Деньги только с вашего «да»"], ["Free to start", "Начать бесплатно"]],
  },
];

export function IntroGuide() {
  const ru = useLang() === "ru";
  const i = ru ? 1 : 0;
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [n, setN] = useState(0);
  const touch = useRef<number | null>(null);
  const nextRef = useRef<HTMLButtonElement | null>(null);
  const hidden = HIDDEN.some((p) => pathname.startsWith(p));

  // First visit: open once the page has settled, then never again by itself.
  useEffect(() => {
    if (hidden) return;
    let seen = true;
    try { seen = localStorage.getItem(SEEN) === "1"; } catch { /* private mode: don't nag */ }
    if (seen) return;
    const t = window.setTimeout(() => { setN(0); setOpen(true); }, 1800);
    return () => window.clearTimeout(t);
  }, [hidden]);
  useEffect(() => {
    const on = () => { setN(0); setOpen(true); };
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  function change(v: boolean) {
    setOpen(v);
    if (!v) { try { localStorage.setItem(SEEN, "1"); } catch { /* private mode */ } }
  }
  const last = n === SLIDES.length - 1;
  const go = (d: number) => setN((x) => Math.min(SLIDES.length - 1, Math.max(0, x + d)));
  const s = SLIDES[n]!;

  return (
    <>
      {!hidden && (
        <button type="button" onClick={openGuide} aria-label={ru ? "Как это работает" : "How it works"} title={ru ? "Как это работает" : "How it works"}
          className={cn("fixed left-3 z-40 flex h-10 w-10 items-center justify-center rounded-full border border-white/60 bg-white/55 text-foreground/70 shadow-[0_8px_24px_-12px_rgba(15,30,60,0.45)] backdrop-blur-xl backdrop-saturate-150 transition hover:text-foreground dark:border-white/10 dark:bg-white/10",
            "bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] md:bottom-6",
            pathname === "/" ? "md:left-6" : "md:hidden")}>
          <CircleHelp className="h-[18px] w-[18px]" />
        </button>
      )}
      <DialogPrimitive.Root open={open} onOpenChange={change}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#0d1620]/30 backdrop-blur-[3px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content
            onOpenAutoFocus={(e) => { e.preventDefault(); nextRef.current?.focus({ preventScroll: true }); }}
            onKeyDown={(e) => { if (e.key === "ArrowRight") go(1); if (e.key === "ArrowLeft") go(-1); }}
            onTouchStart={(e) => { touch.current = e.touches[0]?.clientX ?? null; }}
            onTouchEnd={(e) => {
              const x0 = touch.current, x1 = e.changedTouches[0]?.clientX;
              if (x0 != null && x1 != null && Math.abs(x1 - x0) > 50) go(x1 < x0 ? 1 : -1);
              touch.current = null;
            }}
            className={cn(
              "fixed z-50 flex flex-col overflow-hidden border border-white/60 bg-white/[0.72] shadow-[0_40px_120px_-30px_rgba(10,25,45,0.55)] backdrop-blur-2xl backdrop-saturate-150 outline-none dark:border-white/10 dark:bg-[#141b23]/[0.78]",
              // One fixed size for every slide: the card never jumps. A floating card on phones, centred on larger screens.
              "inset-x-3 bottom-3 h-[min(560px,calc(100dvh-24px))] rounded-[24px] sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:h-[min(620px,calc(100dvh-48px))] sm:w-[540px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[28px]",
              "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-6 sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=open]:zoom-in-[0.97]",
            )}>
            <div className="relative shrink-0 p-2 pb-0 sm:p-2.5 sm:pb-0">
              <div className="relative aspect-[2/1] overflow-hidden rounded-[18px] bg-muted sm:aspect-[16/9] sm:rounded-[20px]">
                {SLIDES.map((sl, k) => (
                  <img key={sl.img} src={sl.img} alt="" aria-hidden={k !== n} style={{ objectPosition: sl.pos ?? "50% 50%" }}
                    className={cn("absolute inset-0 h-full w-full object-cover transition-[opacity,transform] duration-700 ease-out", k === n ? "scale-100 opacity-100" : "scale-[1.03] opacity-0")} />
                ))}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/25 to-transparent" />
                <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
                  {SLIDES.map((_, k) => (
                    <button key={k} type="button" onClick={() => setN(k)} aria-label={`${k + 1}`}
                      className={cn("h-1.5 rounded-full bg-white transition-all duration-300", k === n ? "w-6 opacity-100" : "w-1.5 opacity-60 hover:opacity-90")} />
                  ))}
                </div>
              </div>
              {/* Language, right on the photo: the guide is often the first thing a visitor reads. */}
              <div role="group" aria-label={ru ? "Язык" : "Language"}
                className="absolute left-5 top-5 flex h-8 items-center rounded-full border border-white/50 bg-white/60 p-0.5 text-[12.5px] backdrop-blur-md dark:border-white/10 dark:bg-black/30">
                {(["en", "ru"] as const).map((l) => (
                  <button key={l} type="button" onClick={() => chooseLang(l)} aria-pressed={(l === "ru") === ru}
                    className={cn("h-7 rounded-full px-3 font-medium uppercase tracking-wide transition", (l === "ru") === ru ? "bg-foreground text-background" : "text-foreground/65 hover:text-foreground")}>
                    {l}
                  </button>
                ))}
              </div>
              <DialogPrimitive.Close aria-label={ru ? "Закрыть" : "Close"}
                className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full border border-white/50 bg-white/60 text-foreground/75 backdrop-blur-md transition hover:text-foreground dark:border-white/10 dark:bg-black/30">
                <X className="h-4 w-4" />
              </DialogPrimitive.Close>
            </div>

            <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-4 sm:px-7 sm:pt-5">
              <div key={n} className="animate-in fade-in-0 slide-in-from-bottom-1 duration-500">
                <DialogPrimitive.Title className="font-display text-[23px] leading-[1.1] tracking-[-0.01em] sm:text-[30px]">{s.title[i]}</DialogPrimitive.Title>
                <DialogPrimitive.Description className="mt-2.5 text-[14px] leading-[1.55] text-foreground/75 sm:text-[15px] sm:leading-[1.6]">{s.body[i]}</DialogPrimitive.Description>
                <ul className="mt-3 flex flex-wrap gap-1.5 pb-3">
                  {s.facts.map((f) => (
                    <li key={f[0]} className="rounded-full border border-foreground/10 bg-white/60 px-2.5 py-0.5 text-[12px] text-foreground/80 dark:bg-white/5 sm:text-[12.5px]">{f[i]}</li>
                  ))}
                </ul>
              </div>

              </div>
              <div className="flex shrink-0 items-center gap-2 border-t border-foreground/[0.06] px-5 py-3 sm:px-7 sm:py-4">
                {n > 0 ? (
                  <button type="button" onClick={() => go(-1)} aria-label={ru ? "Назад" : "Back"}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-foreground/10 bg-white/50 text-foreground/70 transition hover:text-foreground dark:bg-white/5">
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                ) : (
                  <button type="button" onClick={() => change(false)} className="h-9 px-1 text-[13.5px] text-foreground/55 transition hover:text-foreground">
                    {ru ? "Пропустить" : "Skip"}
                  </button>
                )}
                <div className="ml-auto flex gap-2">
                  {last && (
                    <button type="button" onClick={() => { change(false); openArgos({ mode: "chat" }); }}
                      className="h-9 rounded-full border border-foreground/[0.12] bg-white/55 px-4 text-[13.5px] transition hover:border-foreground/30 dark:bg-white/5">
                      {ru ? "Спросить Argos" : "Ask Argos"}
                    </button>
                  )}
                  <button ref={nextRef} type="button"
                    onClick={() => { if (last) { change(false); void navigate({ to: "/discover", search: { sort: "best" } as never }); } else go(1); }}
                    className="flex h-9 items-center gap-1.5 rounded-full bg-foreground px-4 text-[13.5px] text-background transition hover:opacity-90">
                    {last ? (ru ? "Смотреть дома" : "Show me houses") : (ru ? "Далее" : "Next")}
                    {!last && <ArrowRight className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}
