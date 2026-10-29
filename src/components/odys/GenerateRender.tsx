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
import { useLang } from "@/lib/i18n";
import { useT } from "@/lib/tr";
import { cn } from "@/lib/utils";

/** Lets a signed-in user generate an AI illustration of the listing in a chosen style. */
export function GenerateRender({
  listingId,
  signedIn,
  photo,
  onCreated,
}: {
  listingId: string;
  signedIn: boolean;
  /** The real listing photo that gets restyled. */
  photo?: string | undefined;
  onCreated?: (imageId: string) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<string>(RENDER_STYLES[0].value);
  const [busy, setBusy] = useState(false);
  const [wish, setWish] = useState("");
  const [limit, setLimit] = useState<string | null>(null);
  const lang = useLang();
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
        onClick={() => setOpen(true)}
      >
        <Sparkles /> {t("Imagine it renovated")}
      </Button>
      <Sheet open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{t("Imagine it renovated")}</SheetTitle>
            <SheetDescription>
              {lang === "ru"
                ? "Мы перерисовываем настоящее фото и сохраняем форму здания, окна и окружение. Каждое изображение подписано как иллюстрация."
                : "We restyle the real photo and keep the building's shape, windows and setting. Every image is labelled as an illustration."}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 px-4">
            <label htmlFor="render-wish" className="text-sm font-medium">{t("Describe what you want (optional)")}</label>
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
            <p className="text-center text-[13px] font-light text-foreground/60">{t("Free accounts can create one illustration. Pro is unlimited.")}</p>
            {limit && (
              <div className="rounded-2xl bg-caution-soft p-4 text-sm text-caution">
                <p>{limit}</p>
                <Link to="/pricing" className="mt-1 inline-block font-medium underline">
                  See plans
                </Link>
              </div>
            )}
            <Button className="w-full" onClick={signedIn ? go : () => navigate({ to: "/login", search: { redirect: `/listing/${listingId}` } })} disabled={busy || (signedIn && style === "Custom" && !wish.trim())}>
              {busy ? t("Creating, this takes up to a minute") : signedIn ? t("Create illustration") : t("Sign in to create")}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
