import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { isCourtPhoto, renderUrl, type FeedRow } from "@/lib/feed";
import { useLang } from "@/lib/i18n";
import { useT } from "@/lib/tr";
import { topListingsQuery } from "@/lib/public";
import { cn } from "@/lib/utils";
import { formatEur } from "./primitives";

/** Houses a signed-out visitor sees in the feed before the rest is behind a sign-in. */
export const PEEK = 6;
/** Houses a signed-out visitor can open before the sign-in sheet comes up. */
const FREE_LISTINGS = 3;

const here = () => (typeof window === "undefined" ? "/" : window.location.pathname + window.location.search);

function useGoogle() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const url = import.meta.env["VITE_SUPABASE_URL"] as string | undefined;
    const key = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string | undefined;
    if (!url || !key) return;
    fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } })
      .then((r) => (r.ok ? r.json() : null)).then((j) => setOn(!!j?.external?.google)).catch(() => {});
  }, []);
  const go = () => {
    const r = here();
    void supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/login?redirect=${encodeURIComponent(r)}` } });
  };
  return { on, go };
}

function photo(r: FeedRow) {
  return isCourtPhoto(r.hero_image_path) ? null : renderUrl(r.latest_render_path) ?? renderUrl(r.hero_image_path);
}

/** Three real houses: photo and price in the clear, the town held back. The reason to sign in is on screen. */
function Teaser({ rows, ru }: { rows: FeedRow[]; ru: boolean }) {
  const shown = rows.filter((r) => photo(r)).slice(0, 3);
  if (!shown.length) return null;
  return (
    <div className="grid grid-cols-3 gap-2">
      {shown.map((r) => (
        <div key={r.id} className="overflow-hidden rounded-[10px] bg-muted">
          <div className="aspect-[4/3] overflow-hidden">
            <img src={photo(r)!} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" loading="lazy" />
          </div>
          <div className="px-2 py-1.5">
            <p className="font-display text-[17px] leading-none tnum">{r.price_eur ? formatEur(r.price_eur) : "?"}</p>
            <p className="mt-1 truncate text-[12px] text-foreground/55">{r.region ?? ""} · <span className="select-none blur-[3px]">{ru ? "город" : "town"}</span></p>
          </div>
        </div>
      ))}
    </div>
  );
}

function Pitch({ ru, total, teaser, className }: { ru: boolean; total?: number | undefined; teaser: FeedRow[]; className?: string }) {
  const g = useGoogle();
  const points = ru
    ? [total ? `Все ${total.toLocaleString("ru-RU")} домов, карта и фильтры` : "Все дома, карта и фильтры", "Argos пишет продавцу по-итальянски и считает все расходы", "Новые дома по вашему поиску каждое утро в Telegram"]
    : [total ? `All ${total.toLocaleString("en-GB")} houses, the map and filters` : "Every house, the map and filters", "Argos writes to the seller in Italian and adds up every cost", "New houses for your search every morning on Telegram"];
  return (
    <div className={className}>
      <Teaser rows={teaser} ru={ru} />
      <ul className="mt-5 space-y-2">
        {points.map((p) => (
          <li key={p} className="flex gap-2.5 text-[15px] leading-snug"><Check className="mt-0.5 h-4 w-4 shrink-0 text-azure" />{p}</li>
        ))}
      </ul>
      <div className="mt-6 flex flex-col gap-2">
        {g.on && (
          <button type="button" onClick={g.go} className="flex h-12 items-center justify-center gap-2.5 rounded-full bg-foreground text-[15.5px] text-background transition-opacity hover:opacity-90">
            <GoogleMark />{ru ? "Продолжить с Google" : "Continue with Google"}
          </button>
        )}
        <Link to="/login" search={{ redirect: here() }}
          className={cn("flex h-12 items-center justify-center rounded-full text-[15.5px] transition-colors", g.on ? "border border-foreground/15 hover:border-foreground/40" : "bg-foreground text-background hover:opacity-90")}>
          {ru ? "Создать аккаунт по email" : "Sign up with email"}
        </Link>
      </div>
      <p className="mt-3 text-center text-[13px] text-foreground/55">
        {ru ? "Бесплатно. Три сделки с Argos без оплаты." : "Free. Three deals with Argos at no cost."}{" "}
        <Link to="/login" search={{ redirect: here(), mode: "signin" }} className="text-foreground underline-offset-4 hover:underline">{ru ? "Уже есть аккаунт" : "I have an account"}</Link>
      </p>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden>
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8-3.3 0-6-2.8-6-6.1s2.7-6.1 6-6.1c1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.9 3 14.7 2 12 2 6.5 2 2 6.5 2 12s4.5 10 10 10c5.8 0 9.6-4.1 9.6-9.8 0-.7-.1-1.2-.2-1.7H12z" />
    </svg>
  );
}

function SignInSheet({ open, onOpenChange, title, total, teaser }: { open: boolean; onOpenChange: (v: boolean) => void; title: string; total?: number | undefined; teaser: FeedRow[] }) {
  const ru = useLang() === "ru";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-[440px] overflow-y-auto rounded-[22px] p-6 sm:p-7">
        <DialogTitle className="pr-6 font-display text-[28px] font-normal leading-[1.1]">{title}</DialogTitle>
        <DialogDescription className="sr-only">{ru ? "Вход в Odysstay" : "Sign in to Odysstay"}</DialogDescription>
        <Pitch ru={ru} total={total} teaser={teaser} className="mt-4" />
      </DialogContent>
    </Dialog>
  );
}

/** The end of the free part of the feed: the next houses blurred under a sign-in card. The sheet opens
 *  once per visit, when the visitor actually reaches it. */
export function FeedGate({ rows, total, region }: { rows: FeedRow[]; total: number; region?: string | null }) {
  const ru = useLang() === "ru";
  const t = useT();
  const after = rows.slice(PEEK);
  const more = Math.max(0, total - PEEK);
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (!e?.isIntersecting) return;
      try { if (sessionStorage.getItem("gate_feed")) return; sessionStorage.setItem("gate_feed", "1"); } catch { /* storage blocked */ }
      window.setTimeout(() => setOpen(true), 900);
    }, { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  if (!more) return null;
  const where = region ? (ru ? `: ${t(region)}` : ` in ${region}`) : "";
  const title = ru ? `Ещё ${more.toLocaleString("ru-RU")} домов${where}` : `${more.toLocaleString("en-GB")} more houses${where}`;
  return (
    <div ref={ref} className="relative mt-5">
      <div aria-hidden className="pointer-events-none grid select-none gap-5 opacity-70 blur-[6px] sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {after.slice(0, 4).map((r) => (
          <div key={r.id} className="overflow-hidden rounded-[14px] border bg-card">
            <div className="aspect-[4/3] bg-muted">{photo(r) && <img src={photo(r)!} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />}</div>
            <div className="space-y-2 p-4"><div className="h-5 w-24 rounded bg-foreground/15" /><div className="h-4 w-40 rounded bg-foreground/10" /></div>
          </div>
        ))}
      </div>
      <div className="absolute inset-0 flex items-start justify-center bg-gradient-to-b from-background/10 via-background/70 to-background pt-6 sm:pt-10">
        <div className="w-full max-w-[460px] rounded-[22px] border bg-card p-6 shadow-[0_20px_60px_-20px_rgba(15,30,60,0.35)] sm:p-7">
          <p className="font-display text-[28px] leading-[1.1]">{title}</p>
          <p className="mt-1.5 text-[15px] text-foreground/65">{ru ? "Вы посмотрели лучшие. Остальные откроются после входа, это 10 секунд." : "You've seen the best ones. The rest open once you sign in, it takes 10 seconds."}</p>
          <Pitch ru={ru} total={total} teaser={after} className="mt-5" />
        </div>
      </div>
      <div className="h-[560px] sm:h-[420px]" />
      <SignInSheet open={open} onOpenChange={setOpen} title={title} total={total} teaser={after} />
    </div>
  );
}

/** On a house page: the first few houses are free to read; from the next one the sheet asks once per house. */
export function ListingGate({ id, signedIn }: { id: string; signedIn: boolean | null }) {
  const ru = useLang() === "ru";
  const [open, setOpen] = useState(false);
  const teaser = useQuery({ ...topListingsQuery(8, true), enabled: open }).data ?? [];
  useEffect(() => {
    if (signedIn !== false) return;
    let seen: string[] = [];
    try { seen = JSON.parse(localStorage.getItem("seen_listings") ?? "[]") as string[]; } catch { /* storage blocked */ }
    if (!seen.includes(id)) seen = [...seen, id].slice(-50);
    try { localStorage.setItem("seen_listings", JSON.stringify(seen)); } catch { /* storage blocked */ }
    if (seen.length <= FREE_LISTINGS) return;
    const t = window.setTimeout(() => setOpen(true), 6000);
    return () => window.clearTimeout(t);
  }, [id, signedIn]);
  if (signedIn !== false) return null;
  return (
    <SignInSheet open={open} onOpenChange={setOpen} teaser={teaser.filter((r) => r.id !== id)}
      title={ru ? "Нравится? Войдите, и Argos возьмётся за этот дом" : "Like it? Sign in and Argos takes this house on"} />
  );
}
