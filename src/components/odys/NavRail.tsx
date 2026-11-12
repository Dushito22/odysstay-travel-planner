import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Bookmark, Compass, FolderLock, Handshake, Inbox, LogIn, LogOut, Map, PanelLeftClose, PanelLeftOpen, Sparkles, Tag, User, Shield } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { supabase } from "@/integrations/supabase/client";
import { inboxCountQuery } from "@/lib/deal";
import { chooseLang, useLang } from "@/lib/i18n";
import { useSignedIn } from "@/lib/signed-in";
import { useT } from "@/lib/tr";
import { cn } from "@/lib/utils";

/** Pages that have their own full-screen layout and no side menu. */
const NO_RAIL = ["/", "/login", "/onboarding", "/argos", "/styleguide"];
const KEY = "odys-rail";

const signedInNav = [
  { to: "/discover", label: "Discover", icon: Compass },
  { to: "/map", label: "Map", icon: Map },
  { to: "/deals", label: "Deals", icon: Handshake },
  { to: "/inbox", label: "Inbox", icon: Inbox },
  { to: "/saved", label: "Saved", icon: Bookmark },
] as const;
const publicNav = [
  { to: "/explore", label: "Explore", icon: Compass },
  { to: "/guide", label: "Guides", icon: BookOpen },
  { to: "/pricing", label: "Pricing", icon: Tag },
] as const;

/** The side menu on every page: icons only by default, one tap opens the labels, and the choice is remembered. */
export function NavRail() {
  const { pathname } = useLocation();
  const t = useT();
  const lang = useLang();
  const signedIn = useSignedIn() === true;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  useEffect(() => { try { setOpen(localStorage.getItem(KEY) === "open"); } catch { /* private mode */ } }, []);
  function toggle() {
    setOpen((o) => { try { localStorage.setItem(KEY, o ? "closed" : "open"); } catch { /* ignore */ } return !o; });
  }
  const isAdmin = useQuery({
    queryKey: ["is-admin"], staleTime: 30 * 60_000, enabled: signedIn,
    queryFn: async () => { const { data } = await supabase.rpc("is_admin" as never); return data === true; },
  }).data === true;
  const inboxCount = useQuery({ ...inboxCountQuery, enabled: signedIn, refetchInterval: 60_000 }).data ?? 0;

  if (NO_RAIL.includes(pathname)) return null;

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login", search: { mode: "signin" }, replace: true });
  }
  const nav = signedIn ? signedInNav : publicNav;
  const item = "group relative flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";
  const active = { className: "!bg-azure-soft !text-foreground" };
  const label = (s: string) => <span className={cn("truncate", !open && "sr-only")}>{s}</span>;
  const Item = ({ to, text, icon: Icon, badge }: { to: string; text: string; icon: typeof Compass; badge?: ReactNode }) => (
    <Link to={to} title={open ? undefined : text} className={item} activeProps={active}>
      <Icon className="h-4 w-4 shrink-0" />
      {label(text)}
      {badge}
    </Link>
  );

  return (
    <aside className={cn("sticky top-0 z-20 hidden h-screen shrink-0 self-start flex-col border-r bg-sidebar px-2 py-3 transition-[width] duration-200 md:flex", open ? "w-[176px]" : "w-[52px]")}>
      <div className="flex h-8 items-center">
        <button type="button" onClick={toggle} aria-label={open ? t("Hide menu") : t("Show menu")} title={open ? t("Hide menu") : t("Show menu")}
          className={cn("flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground", !open && "mx-auto")}>
          {open ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
        </button>
      </div>

      <Link to="/argos" search={{ q: "", voice: false }} title={open ? undefined : t("Ask Argos")}
        className={cn("mt-3 flex h-8 items-center gap-2 rounded-full border border-azure/25 bg-azure-soft/60 text-[13.5px] text-foreground transition-colors hover:bg-azure-soft", open ? "px-3" : "justify-center")}>
        <Sparkles className="h-4 w-4 shrink-0 text-azure" />
        {label(t("Ask Argos"))}
      </Link>

      <nav className="mt-3 flex flex-col gap-0.5">
        {nav.map(({ to, label: l, icon }) => (
          <Item key={to} to={to} text={t(l)} icon={icon}
            badge={to === "/inbox" && inboxCount > 0 ? <CountBadge n={inboxCount} className={open ? "ml-auto" : "absolute right-0.5 top-0.5"} /> : undefined} />
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-0.5 border-t pt-2">
        <button type="button" onClick={() => chooseLang(lang === "ru" ? "en" : "ru")} title={lang === "ru" ? "English" : "Русский"}
          className={cn(item, "justify-start text-[12.5px] uppercase")}>
          <span className="flex h-4 w-4 shrink-0 items-center justify-center text-[11px] font-semibold">{lang === "ru" ? "RU" : "EN"}</span>
          <span className={cn("truncate normal-case", !open && "sr-only")}>{lang === "ru" ? "Русский · English" : "English · Русский"}</span>
        </button>
        {signedIn ? (
          <>
            <Item to="/profile" text={t("Profile")} icon={User} />
            <Item to="/vault" text={t("Documents")} icon={FolderLock} />
            {isAdmin && <Item to="/admin" text="Admin" icon={Shield} />}
            <button type="button" onClick={signOut} title={open ? undefined : t("Sign out")} className={cn(item, "text-left")}>
              <LogOut className="h-4 w-4 shrink-0" /> {label(t("Sign out"))}
            </button>
          </>
        ) : (
          <Link to="/login" title={open ? undefined : t("Sign in")} className={item}>
            <LogIn className="h-4 w-4 shrink-0" /> {label(t("Sign in"))}
          </Link>
        )}
      </div>
    </aside>
  );
}

function CountBadge({ n, className }: { n: number; className?: string }) {
  return (
    <span aria-label={`${n} item${n === 1 ? "" : "s"} need you`}
      className={cn("inline-flex min-w-4 items-center justify-center rounded-full bg-caution px-1 text-[10px] font-semibold leading-4 text-background tnum", className)}>
      {n > 99 ? "99+" : n}
    </span>
  );
}
