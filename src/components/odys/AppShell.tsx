import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bookmark, Compass, FolderLock, Shield, Handshake, Inbox, LogOut, Map, Sparkles, User } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { inboxCountQuery } from "@/lib/deal";
import { useInboxRealtime } from "@/lib/use-deal";
import { useT } from "@/lib/tr";
import { LangToggle } from "./LangToggle";
import { LEGAL_LINE, Wordmark } from "./primitives";

const desktopNav = [
  { to: "/discover", label: "Discover", icon: Compass },
  { to: "/map", label: "Map", icon: Map },
  { to: "/deals", label: "Deals", icon: Handshake },
  { to: "/inbox", label: "Inbox", icon: Inbox },
  { to: "/saved", label: "Saved", icon: Bookmark },
] as const;

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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isAdmin = useQuery({
    queryKey: ["is-admin"],
    staleTime: 30 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.rpc("is_admin" as never);
      return data === true;
    },
  }).data === true;
  const inboxCount = useQuery({ ...inboxCountQuery, refetchInterval: 60_000 }).data ?? 0;
  useInboxRealtime();

  if (pathname === "/onboarding") return <Outlet />;

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login", search: { mode: "signin" }, replace: true });
  }

  return (
    <div className="min-h-screen md:flex">
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r bg-sidebar px-3 py-6 md:flex">
        <Link to="/discover" className="px-3" aria-label="odysstay home">
          <Wordmark size="md" />
        </Link>
        <Link to="/argos" search={{ q: "", voice: false }}
          className="mx-1 mt-6 flex items-center gap-2.5 rounded-full border border-azure/25 bg-azure-soft/60 px-3 py-2 text-[15px] text-foreground transition-colors hover:bg-azure-soft">
          <Sparkles className="h-4 w-4 text-azure" /> {t("Ask Argos")}
        </Link>
        <nav className="mt-4 flex flex-col gap-0.5">
          {desktopNav.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-[15px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              activeProps={{ className: "!bg-azure-soft !text-foreground" }}
            >
              <Icon className="h-4 w-4" />
              {t(label)}
              {to === "/inbox" && inboxCount > 0 && <CountBadge n={inboxCount} className="ml-auto" />}
            </Link>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-1 border-t pt-4">
          <LangToggle className="px-3 pb-2" />
          <Link
            to="/profile"
            className="flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-[15px] text-muted-foreground hover:bg-muted hover:text-foreground"
            activeProps={{ className: "!bg-azure-soft !text-foreground" }}
          >
            <User className="h-4 w-4" /> {t("Profile")}
          </Link>
          <Link
            to="/vault"
            className="flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-[15px] text-muted-foreground hover:bg-muted hover:text-foreground"
            activeProps={{ className: "!bg-azure-soft !text-foreground" }}
          >
            <FolderLock className="h-4 w-4" /> {t("Documents")}
          </Link>
          {isAdmin && (
            <Link
              to="/admin"
              className="flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-[15px] text-muted-foreground hover:bg-muted hover:text-foreground"
              activeProps={{ className: "!bg-azure-soft !text-foreground" }}
            >
              <Shield className="h-4 w-4" /> Admin
            </Link>
          )}
          <button
            onClick={signOut}
            className="flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-left text-[15px] text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <LogOut className="h-4 w-4" /> {t("Sign out")}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col pb-20 md:pb-0">
        <header className="sticky top-0 z-30 flex items-center border-b bg-background/85 px-5 py-4 backdrop-blur-xl md:hidden">
          <Wordmark size="sm" />
          <LangToggle className="ml-auto" />
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

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-card/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
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
      </nav>
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
