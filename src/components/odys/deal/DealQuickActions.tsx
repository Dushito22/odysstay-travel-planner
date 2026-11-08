import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Archive, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Close (or reopen) and delete a deal in one tap, from the list or the deal itself. */
export function DealQuickActions({ deal, compact = false, afterDelete }: { deal: { id: string; stage: string }; compact?: boolean; afterDelete?: () => void }) {
  const ru = useLang() === "ru";
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [ask, setAsk] = useState(false);
  const closed = ["won", "lost", "withdrawn"].includes(deal.stage);

  const refresh = () => qc.invalidateQueries({ predicate: (q) => String(q.queryKey[0] ?? "").startsWith("deal") || q.queryKey[0] === "inbox" });

  async function toggle(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    const { error } = await supabase.from("deals").update({ stage: closed ? "interested" : "withdrawn" }).eq("id", deal.id);
    if (error) { toast.error(error.message); return; }
    toast(closed ? (ru ? "Сделка снова открыта" : "Deal reopened") : (ru ? "Сделка закрыта" : "Deal closed"));
    void refresh();
  }
  async function remove() {
    const { error } = await supabase.rpc("delete_deal" as never, { target: deal.id } as never);
    if (error) { toast.error(error.message); return; }
    toast(ru ? "Сделка удалена" : "Deal deleted");
    await refresh();
    if (afterDelete) afterDelete(); else void navigate({ to: "/deals" });
  }

  const btn = cn("inline-flex items-center gap-1.5 rounded-full border border-foreground/12 text-foreground/70 transition-colors hover:border-foreground/35 hover:text-foreground",
    compact ? "h-8 w-8 justify-center" : "h-9 px-3.5 text-[13px]");
  return (
    <>
      <button type="button" onClick={toggle} className={btn} aria-label={closed ? "Reopen deal" : "Close deal"} title={closed ? (ru ? "Открыть снова" : "Reopen") : (ru ? "Закрыть" : "Close")}>
        {closed ? <RotateCcw className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
        {!compact && (closed ? (ru ? "Открыть снова" : "Reopen") : ru ? "Закрыть сделку" : "Close deal")}
      </button>
      <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setAsk(true); }} className={cn(btn, "hover:border-destructive/50 hover:text-destructive")} aria-label="Delete deal" title={ru ? "Удалить" : "Delete"}>
        <Trash2 className="h-3.5 w-3.5" />{!compact && (ru ? "Удалить" : "Delete")}
      </button>
      <AlertDialog open={ask} onOpenChange={setAsk}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>{ru ? "Удалить сделку?" : "Delete this deal?"}</AlertDialogTitle>
            <AlertDialogDescription>{ru ? "Удалятся план, сообщения и заметки. Это нельзя отменить." : "Its plan, messages and notes go too. This can't be undone."}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{ru ? "Отмена" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void remove()} className="bg-destructive text-white hover:bg-destructive/90">{ru ? "Удалить" : "Delete"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
