import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { ConfirmRequired } from "./deal";

/** Query keys that depend on deal data. Invalidated after every deal action and realtime change. */
function invalidateDealKeys(qc: ReturnType<typeof useQueryClient>, dealId: string) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: ["deal", dealId] }),
    qc.invalidateQueries({ queryKey: ["deals"] }),
    qc.invalidateQueries({ queryKey: ["deals-attention"] }),
    qc.invalidateQueries({ queryKey: ["inbox"] }),
    qc.invalidateQueries({ queryKey: ["inbox-count"] }),
  ]);
}

/** Runs a deal action with one pending flag, a toast on success, a readable toast on failure, and a refresh. */
export function useDealAction(dealId: string) {
  const qc = useQueryClient();
  const [pending, setPending] = useState<string | null>(null);

  const run = useCallback(
    async (key: string, fn: () => Promise<unknown>, success?: string) => {
      setPending(key);
      try {
        await fn();
        if (success) toast.success(success);
        await invalidateDealKeys(qc, dealId);
        return true;
      } catch (e) {
        if (e instanceof ConfirmRequired) toast.error(e.message);
        else
          toast.error(e instanceof Error ? e.message : "Something went wrong. Please try again.");
        return false;
      } finally {
        setPending(null);
      }
    },
    [qc, dealId],
  );

  return { run, pending };
}

/** Live updates for an open deal. RLS limits the rows each user receives. */
export function useDealRealtime(dealId: string) {
  const qc = useQueryClient();
  useEffect(() => {
    const refresh = () => void invalidateDealKeys(qc, dealId);
    const channel = supabase
      .channel(`deal-${dealId}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "deal_tasks", filter: `deal_id=eq.${dealId}` },
        refresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "threads", filter: `deal_id=eq.${dealId}` },
        refresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "quotes", filter: `deal_id=eq.${dealId}` },
        refresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "deal_events", filter: `deal_id=eq.${dealId}` },
        refresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "deals", filter: `id=eq.${dealId}` },
        refresh,
      )
      // messages has no deal_id column; RLS only delivers this user's rows, so refresh on any change.
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, refresh)
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [qc, dealId]);
}

/** Inbox and nav badge stay fresh across all deals. */
export function useInboxRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    const refresh = () => {
      void qc.invalidateQueries({ queryKey: ["inbox"] });
      void qc.invalidateQueries({ queryKey: ["inbox-count"] });
      void qc.invalidateQueries({ queryKey: ["deals-attention"] });
    };
    const channel = supabase
      .channel(`inbox-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "deal_tasks" }, refresh)
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [qc]);
}
