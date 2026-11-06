import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Phone, Send } from "lucide-react";
import { useEffect, useRef } from "react";

import { openArgos } from "@/components/odys/ArgosDock";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/i18n";

type Pick = { id: string; comune: string; region: string; price_eur: number | null; surface_sqm: number | null; photo: string | null; why: string; tradeoff: string };
type Drop = { week: string; script: string | null; audio_url: string | null; picks: Pick[] };

/** Argos's five picks of the week, with his voice note and a way to talk them through. */
export function WeeklyDrop() {
  const ru = useLang() === "ru";
  const box = useRef<HTMLElement>(null);
  const q = useQuery({
    queryKey: ["weekly-drop"],
    queryFn: async () => {
      const { data } = await supabase.from("weekly_drops" as never).select("week, script, audio_url, picks").order("week", { ascending: false }).limit(1).maybeSingle();
      return (data ?? null) as Drop | null;
    },
  });
  useEffect(() => {
    if (q.data && typeof window !== "undefined" && window.location.hash === "#drop") box.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [q.data]);

  if (q.isLoading) return null;
  const d = q.data;
  const money = (n: number | null) => (n == null ? "" : `€${n.toLocaleString(ru ? "ru-RU" : "en-GB")}`);

  if (!d || !d.picks?.length) {
    return (
      <section ref={box} id="drop" className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-[12px] bg-muted px-4 py-3">
        <p className="text-[14px] font-light text-foreground/75">
          {ru ? "Каждую субботу Argos присылает 5 лучших домов под ваш запрос, с голосовым сообщением." : "Every Saturday Argos sends you his 5 best houses for your brief, with a voice note."}
        </p>
        <Link to="/profile" className="inline-flex h-8 items-center gap-1.5 rounded-full bg-foreground px-3.5 text-[13px] text-background">
          <Send className="h-3.5 w-3.5" /> {ru ? "Получать в Telegram" : "Get it on Telegram"}
        </Link>
      </section>
    );
  }

  const date = new Date(`${d.week}T12:00:00Z`).toLocaleDateString(ru ? "ru-RU" : "en-GB", { day: "numeric", month: "long" });
  const context = `${d.script ?? ""}\n${d.picks.map((p, i) => `${i + 1}. ${p.comune}, ${p.region}, ${money(p.price_eur)}. ${p.why} ${ru ? "Минус" : "Catch"}: ${p.tradeoff}`).join("\n")}`;
  const call = () => openArgos({ mode: "call", context, hello: ru ? "Ciao, это Argos. Какой из домов этой недели вам понравился?" : "Ciao, Argos here. Which of this week's houses caught your eye?" });

  return (
    <section ref={box} id="drop" className="mt-8 scroll-mt-20 rounded-[14px] border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-[24px] leading-tight sm:text-[28px]">
          {ru ? <>Дома недели от <em className="italic text-azure">Argos</em></> : <>This week from <em className="italic text-azure">Argos</em></>}
        </h2>
        <span className="text-[12px] text-foreground/50">{ru ? `неделя с ${date}` : `week of ${date}`}</span>
      </div>
      {d.audio_url && (
        <audio controls preload="none" src={d.audio_url} className="mt-3 h-10 w-full max-w-md" />
      )}
      <ol className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {d.picks.map((p, i) => (
          <li key={p.id}>
            <Link to="/listing/$id" params={{ id: p.id }} className="flex gap-3 rounded-[10px] p-2 transition-colors hover:bg-muted">
              <div className="h-16 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
                {p.photo && <img src={p.photo} alt="" loading="lazy" className="h-full w-full object-cover" />}
              </div>
              <div className="min-w-0 text-[13px] leading-snug">
                <div className="truncate font-medium">{i + 1}. {p.comune} <span className="font-normal text-foreground/60">· {money(p.price_eur)}</span></div>
                <div className="mt-0.5 line-clamp-2 font-light text-foreground/75">{p.why}</div>
                {p.tradeoff && <div className="mt-0.5 line-clamp-1 font-light text-foreground/50">{ru ? "Минус" : "Catch"}: {p.tradeoff}</div>}
              </div>
            </Link>
          </li>
        ))}
      </ol>
      <button type="button" onClick={call} className="mt-4 inline-flex h-9 items-center gap-2 rounded-full bg-azure px-4 text-[14px] text-white">
        <Phone className="h-4 w-4" /> {ru ? "Обсудить с Argos по звонку" : "Talk them through with Argos"}
      </button>
    </section>
  );
}
