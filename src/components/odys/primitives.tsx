import { differenceInCalendarDays } from "date-fns";
import { ExternalLink, Quote } from "lucide-react";
import type { ReactNode } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const eur = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export function formatEur(value: number) {
  return eur.format(value);
}

export function NotStated({ className }: { className?: string }) {
  return (
    <span className={cn("text-sm italic text-muted-foreground", className)}>
      Not stated in the notice
    </span>
  );
}

export function Money({
  value,
  className,
  showOneEuroChip = true,
}: {
  value: number | null | undefined;
  className?: string;
  showOneEuroChip?: boolean;
}) {
  if (value == null) return <NotStated />;
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className="font-display tnum">{formatEur(value)}</span>
      {value === 1 && showOneEuroChip && (
        <span className="rounded-full bg-brand-soft px-2 py-0.5 font-sans text-xs font-medium text-brand">
          One-euro scheme
        </span>
      )}
    </span>
  );
}

export function ScoreBadge({
  score,
  reasons,
  size = "md",
}: {
  score: number | null | undefined;
  reasons?: unknown;
  size?: "sm" | "md";
}) {
  if (score == null) return null;
  const list = parseReasons(reasons);
  const strong = score >= 70;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Score ${score} out of 100`}
          className={cn(
            "inline-flex shrink-0 items-center justify-center rounded-full font-display tnum transition-shadow hover:shadow-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            size === "sm" ? "h-9 w-9 text-sm" : "h-12 w-12 text-lg",
            strong ? "bg-sea text-white" : "bg-card text-foreground ring-1 ring-border",
          )}
        >
          {score}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 rounded-2xl">
        <p className="font-display text-base">Why it scores {score}</p>
        {list.length ? (
          <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-muted-foreground">
            {list.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">No reasons recorded.</p>
        )}
      </PopoverContent>
    </Popover>
  );
}

function parseReasons(reasons: unknown): string[] {
  if (Array.isArray(reasons)) return reasons.filter((r): r is string => typeof r === "string");
  if (typeof reasons === "string") {
    try {
      return parseReasons(JSON.parse(reasons));
    } catch {
      return [];
    }
  }
  return [];
}

export function DeadlinePill({
  deadline,
  now = new Date(),
}: {
  deadline: string | Date | null | undefined;
  now?: Date;
}) {
  if (!deadline) return null;
  const days = differenceInCalendarDays(new Date(deadline), now);
  let label: string;
  let tone: string;
  if (days < 0) {
    label = "Closed";
    tone = "bg-warning-soft text-warning";
  } else if (days < 15) {
    label = days === 0 ? "Closes today" : `Closes in ${days} day${days === 1 ? "" : "s"}`;
    tone = "bg-caution-soft text-caution";
  } else {
    label = `${days} days left`;
    tone = "bg-success-soft text-success";
  }
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium tnum",
        tone,
      )}
    >
      {label}
    </span>
  );
}

export function IllustrationLabel({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "pointer-events-none absolute bottom-2 left-2 rounded-full bg-foreground/80 px-2.5 py-1 text-[11px] font-medium text-background backdrop-blur",
        className,
      )}
    >
      Illustration. Not the actual property.
    </span>
  );
}

type QuoteProps = {
  quote: string | null | undefined;
  quoteEn?: string | null | undefined;
  page?: number | null | undefined;
  sourceUrl?: string | null | undefined;
  /** What the quote comes from, e.g. "Appraisal report". Defaults to "Official notice". */
  docLabel?: string;
};

export function translateUrl(text: string) {
  return `https://translate.google.com/?sl=it&tl=en&op=translate&text=${encodeURIComponent(text)}`;
}

/** The Italian quote, its English translation and a link to the original notice. */
export function QuoteDetails({ quote, quoteEn, page, sourceUrl, docLabel = "Official notice" }: QuoteProps) {
  return (
    <>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {docLabel}{page ? `, page ${page}` : ""}
      </p>
      <blockquote
        lang="it"
        className="mt-2 border-l-2 border-foreground pl-3 text-sm font-medium leading-relaxed"
      >
        {quote}
      </blockquote>
      {quoteEn && <p className="mt-2 text-sm text-muted-foreground">{quoteEn}</p>}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        {!quoteEn && quote && (
          <a
            href={translateUrl(quote)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm text-brand underline-offset-4 hover:underline"
          >
            Translate <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
        {sourceUrl && (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm text-brand underline-offset-4 hover:underline"
          >
            Open the original <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    </>
  );
}

/** A small labelled chip that reveals the source quote. Used for agent citations. */
export function SourceChip({ label, ...q }: QuoteProps & { label: string }) {
  if (!q.quote) {
    return q.sourceUrl ? (
      <a
        href={q.sourceUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-brand hover:bg-muted"
      >
        <ExternalLink className="h-3 w-3" /> {label}
      </a>
    ) : (
      <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
        {label}
      </span>
    );
  }
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-brand hover:bg-muted"
        >
          <Quote className="h-3 w-3" aria-hidden /> {label}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 rounded-2xl">
        <QuoteDetails {...q} />
      </PopoverContent>
    </Popover>
  );
}

export function SourceQuote({ children, ...q }: QuoteProps & { children: ReactNode }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span>{children}</span>
      {q.quote && (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Show the source in the official notice"
              className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium text-brand hover:bg-muted"
            >
              <Quote className="h-3 w-3" aria-hidden />
              Source
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-80 rounded-2xl">
            <QuoteDetails {...q} />
          </PopoverContent>
        </Popover>
      )}
    </span>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn("inline-flex items-baseline font-display text-[1.45rem] leading-none tracking-[-0.01em]", className)}
    >
      Odysstay
      <span className="ml-[0.08em] inline-block h-[0.16em] w-[0.16em] rounded-full bg-azure" aria-hidden />
    </span>
  );
}

export const LEGAL_LINE =
  "Odysstay is a technology service. We are not an estate agency, law firm or notary. Always confirm with a qualified professional before committing.";
