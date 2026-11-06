import { chooseLang, useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** EN / RU switch, shown in every header. Remembered per browser and, when signed in, on the account. */
export function LangToggle({ light = false, className }: { light?: boolean; className?: string }) {
  const lang = useLang();
  return (
    <div className={cn("flex items-center gap-1.5 text-[13px]", className)}>
      {(["en", "ru"] as const).map((l, i) => (
        <span key={l} className="flex items-center gap-1.5">
          {i > 0 && <span aria-hidden className={light ? "text-white/45" : "text-foreground/45"}>·</span>}
          <button type="button" onClick={() => chooseLang(l)} aria-pressed={lang === l}
            className={cn("uppercase transition-colors",
              lang === l ? (light ? "text-white" : "text-foreground") : light ? "font-light text-white/45 hover:text-white/80" : "font-light text-foreground/45 hover:text-foreground/80")}>
            {l}
          </button>
        </span>
      ))}
    </div>
  );
}
