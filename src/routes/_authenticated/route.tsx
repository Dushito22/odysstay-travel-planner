import { createFileRoute, redirect } from "@tanstack/react-router";

import { AppShell } from "@/components/odys/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { feedSearchSchema, fetchFeed, filtersOf } from "@/lib/feed";
import { profileQuery } from "@/lib/profile";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ context, location }) => {
    // Opening the feed: ask for the houses now, in parallel with the session and profile checks
    // (they used to run first and held the feed back by about two seconds).
    const raw = location.search as Record<string, unknown>;
    if (location.pathname === "/discover" && raw["sort"]) {
      const search = feedSearchSchema.parse(raw);
      void context.queryClient.prefetchQuery({ queryKey: ["feed", filtersOf(search), search.sort ?? "best"], queryFn: () => fetchFeed(filtersOf(search), search.sort ?? "best") });
    }
    // The session is read locally; the server still checks the token on every query.
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user ?? null;
    // The feed is open to everyone: a taste first, then a sign-in (see SignInGate).
    if (!user && location.pathname === "/discover") return { user: null };
    if (!user) throw redirect({ to: "/login", search: { redirect: location.href } });
    const profile = await context.queryClient.ensureQueryData(profileQuery);
    if (!profile?.onboarded && location.pathname !== "/onboarding") {
      throw redirect({ to: "/onboarding" });
    }
    return { user };
  },
  component: AppShell,
});
