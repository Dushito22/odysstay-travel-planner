import { Bookmark } from "lucide-react";
import { useT } from "@/lib/tr";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import type { FeedFilters } from "@/lib/feed";

export function SaveSearchButton({ filters, sort, variant = "outline", compact = false }: { filters: FeedFilters; sort: string; variant?: "outline" | "default"; compact?: boolean }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    const n = name.trim();
    if (!n) return;
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      setBusy(false);
      toast.error("Sign in to save searches");
      return;
    }
    const { error } = await supabase.from("saved_searches").insert({
      user_id: u.user.id, name: n.slice(0, 80), filters: { ...filters, sort }, notify_email: true,
    });
    setBusy(false);
    if (error) toast.error("Could not save this search");
    else {
      toast.success("Search saved. We'll email you new matches.");
      setOpen(false);
      setName("");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {compact
          ? <button type="button" aria-label={t("Save this search")} title={t("Save this search")} className="inline-flex h-10 items-center gap-1.5 rounded-full border border-foreground/15 bg-card px-3.5 text-[14px] hover:border-foreground/40"><Bookmark className="h-4 w-4" /><span className="hidden xl:inline">{t("Save")}</span></button>
          : <Button variant={variant}>{t("Save this search")}</Button>}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle className="font-display">{t("Save this search")}</DialogTitle></DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="ss-name">Name</Label>
          <Input id="ss-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="Sicily under €50k" autoFocus />
          <p className="text-xs text-muted-foreground">We'll email you when new notices match.</p>
        </div>
        <DialogFooter><Button onClick={save} disabled={busy || !name.trim()}>Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
