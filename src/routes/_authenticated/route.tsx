import { createFileRoute, redirect } from "@tanstack/react-router";

import { AppShell } from "@/components/odys/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { profileQuery } from "@/lib/profile";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ context, location }) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/login" });
    const profile = await context.queryClient.fetchQuery(profileQuery);
    if (!profile?.onboarded && location.pathname !== "/onboarding") {
      throw redirect({ to: "/onboarding" });
    }
    return { user: data.user };
  },
  component: AppShell,
});
