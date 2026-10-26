import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Bookmark, Compass, Handshake, Inbox, LogOut, Map, User } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
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
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  if (pathname === "/onboarding") return <Outlet />;

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  }

  return (
    <div className="min-h-screen md:flex">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r bg-sidebar px-4 py-6 md:flex">
        <Link to="/discover" className="px-3">
          <Wordmark />
        </Link>
        <nav className="mt-8 flex flex-col gap-1">
          {desktopNav.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              activeProps={{ className: "bg-accent text-foreground font-medium" }}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-1 border-t pt-4">
          <Link
            to="/profile"
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            activeProps={{ className: "bg-accent text-foreground font-medium" }}
          >
            <User className="h-4 w-4" /> Profile
          </Link>
          <button
            onClick={signOut}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col pb-20 md:pb-0">
        <header className="flex items-center border-b px-5 py-4 md:hidden">
          <Wordmark className="text-xl" />
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

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-card md:hidden">
        {mobileNav.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex flex-col items-center gap-1 py-2.5 text-[11px] text-muted-foreground"
            activeProps={{ className: "text-primary font-medium" }}
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function PageHeader({ title, intro }: { title: string; intro?: string }) {
  return (
    <div className="mb-8">
      <h1 className="text-3xl font-medium md:text-4xl">{title}</h1>
      {intro && <p className="mt-2 max-w-xl text-muted-foreground">{intro}</p>}
    </div>
  );
}

export function ComingSoon({ title, intro }: { title: string; intro: string }) {
  return (
    <>
      <PageHeader title={title} />
      <div className="rounded-lg border border-dashed bg-card p-10 text-center text-muted-foreground">{intro}</div>
    </>
  );
}
