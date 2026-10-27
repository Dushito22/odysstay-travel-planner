import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { generateRender, RENDER_STYLES } from "@/lib/agent";
import { cn } from "@/lib/utils";

/** Lets a signed-in user generate an AI illustration of the listing in a chosen style. */
export function GenerateRender({
  listingId,
  signedIn,
  hasOriginal,
  photo,
  onCreated,
}: {
  listingId: string;
  signedIn: boolean;
  hasOriginal: boolean;
  /** Official photo currently shown, used as the starting point. */
  photo?: string | undefined;
  onCreated?: (imageId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<string>(RENDER_STYLES[0].value);
  const [busy, setBusy] = useState(false);
  const [wish, setWish] = useState("");
  const [limit, setLimit] = useState<string | null>(null);
  const qc = useQueryClient();
  const navigate = useNavigate();

  async function go() {
    setBusy(true);
    setLimit(null);
    try {
      const { image } = await generateRender(listingId, style, photo, wish);
      await qc.invalidateQueries({ queryKey: ["listing-images", listingId] });
      await qc.invalidateQueries({ queryKey: ["feed"] });
      toast.success("Illustration ready");
      onCreated?.(image.id);
      setOpen(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "That didn't work. Please try again.";
      if (/free plan/i.test(msg)) setLimit(msg);
      else toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={() =>
          signedIn
            ? setOpen(true)
            : navigate({ to: "/login", search: { redirect: `/listing/${listingId}` } })
        }
      >
        <Sparkles /> Imagine it renovated
      </Button>
      <Sheet open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Imagine it renovated</SheetTitle>
            <SheetDescription>
              {hasOriginal
                ? "We restyle the real photo and keep the building's shape, windows and setting."
                : "There is no photo in the notice, so this is a concept built only from the facts: type, size and region."}{" "}
              Every image is labelled as an illustration.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 px-4">
            <label htmlFor="render-wish" className="text-sm font-medium">Describe what you want (optional)</label>
            <textarea
              id="render-wish"
              value={wish}
              onChange={(e) => setWish(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="For example: open-plan kitchen, big windows to the garden, pool, light stone floors, olive trees"
              className="glass mt-2 w-full resize-none rounded-2xl p-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 px-4">
            {RENDER_STYLES.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => setStyle(s.value)}
                className={cn(
                  "w-full rounded-2xl border p-3 text-left transition-colors",
                  style === s.value ? "border-transparent bg-sea text-white" : "glass hover:border-brand/40",
                )}
              >
                <p className="font-medium">{s.value}</p>
                <p className={cn("mt-0.5 text-xs", style === s.value ? "text-white/85" : "text-muted-foreground")}>{s.hint}</p>
              </button>
            ))}
          </div>
          <div className="mt-6 space-y-3 px-4 pb-6">
            {limit && (
              <div className="rounded-2xl bg-caution-soft p-4 text-sm text-caution">
                <p>{limit}</p>
                <Link to="/pricing" className="mt-1 inline-block font-medium underline">
                  See plans
                </Link>
              </div>
            )}
            <Button className="w-full" onClick={go} disabled={busy || (style === "Custom" && !wish.trim())}>
              {busy ? "Creating, this takes up to a minute" : "Create illustration"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
