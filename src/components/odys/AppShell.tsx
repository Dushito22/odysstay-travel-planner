import { Link, Outlet, useLocation } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Compass, Handshake, Inbox, Map, User } from "lucide-react";

import { useEffect } from "react";

import { inboxCountQuery } from "@/lib/deal";
import { setLang, useLang } from "@/lib/i18n";
import { profileQuery } from "@/lib/profile";
import { useSignedIn } from "@/lib/signed-in";
import { useInboxRealtime } from "@/lib/use-deal";
import { useT } from "@/lib/tr";
import { LangToggle } from "./LangToggle";
import { LEGAL_LINE, Wordmark } from "./primitives";

const mobileNav = [
  { to: "/discover", label: "Discover", icon: Compass },
  { to: "/map", label: "Map", icon: Map },
  { to: "/deals", label: "Deals", icon: Handshake },
  { to: "/inbox", label: "Inbox", icon: Inbox },
  { to: "/profile", label: "Profile", icon: User },
] as const;

export function AppShell() {
  const t = useT();
  const { pathname } = useLocation();
  const signedIn = useSignedIn();
  const inboxCount = useQuery({ ...inboxCountQuery, refetchInterval: 60_000 }).data ?? 0;
  useInboxRealtime();
  // The account's language wins over the browser's, so every device opens in the buyer's language.
  const accountLang = useQuery(profileQuery).data?.language;
  const lang = useLang();
  useEffect(() => {
    if ((accountLang === "en" || accountLang === "ru") && accountLang !== lang) setLang(accountLang);
  }, [accountLang]); // eslint-disable-line react-hooks/exhaustive-deps

  if (pathname === "/onboarding") return <Outlet />;

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex min-w-0 flex-1 flex-col pb-20 md:pb-0">
        <header className="sticky top-0 z-30 flex items-center border-b bg-background/85 px-5 py-4 backdrop-blur-xl md:hidden">
          <Wordmark size="sm" />
          <LangToggle className="ml-auto" />
          {signedIn === false && (
            <Link to="/login" search={{ redirect: pathname }} className="ml-3 rounded-full bg-foreground px-4 py-1.5 text-[14px] text-background">{t("Sign in")}</Link>
          )}
        </header>
        {pathname === "/map" ? (
          <main className="relative flex-1">
            <Outlet />
          </main>
        ) : (
          <>
            <main className="mx-auto w-full max-w-7xl flex-1 px-5 py-8 md:px-10 md:py-12">
              <Outlet />
            </main>
            <footer className="mx-auto w-full max-w-7xl px-5 pb-8 text-xs text-muted-foreground md:px-10">
              {LEGAL_LINE}
            </footer>
          </>
        )}
      </div>

      {signedIn !== false && <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-card/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
        {mobileNav.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex flex-col items-center gap-1 py-2.5 text-[11px] text-muted-foreground"
            activeProps={{ className: "!text-foreground font-semibold" }}
          >
            <span className="relative">
              <Icon className="h-5 w-5" />
              {to === "/inbox" && inboxCount > 0 && <CountBadge n={inboxCount} className="absolute -right-3 -top-2" />}
            </span>
            {t(label)}
          </Link>
        ))}
      </nav>}
    </div>
  );
}

function CountBadge({ n, className }: { n: number; className?: string }) {
  return (
    <span
      aria-label={`${n} item${n === 1 ? "" : "s"} need you`}
      className={`inline-flex min-w-5 items-center justify-center rounded-full bg-caution px-1.5 text-[11px] font-semibold leading-5 text-background tnum ${className ?? ""}`}
    >
      {n > 99 ? "99+" : n}
    </span>
  );
}

export function PageHeader({ title, intro }: { title: string; intro?: string }) {
  return (
    <div className="mb-8">
      <h1 className="type-h2">{title}</h1>
      {intro && <p className="mt-3 max-w-xl type-body text-foreground/60">{intro}</p>}
    </div>
  );
}

export function ComingSoon({ title, intro }: { title: string; intro: string }) {
  return (
    <>
      <PageHeader title={title} />
      <div className="grain rounded-[10px] bg-muted p-10 text-center type-body text-foreground/60">{intro}</div>
    </>
  );
}
