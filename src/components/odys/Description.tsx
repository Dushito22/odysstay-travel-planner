import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Languages, Lightbulb } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { translateUrl } from "@/components/odys/primitives";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { setLang, useLang } from "@/lib/i18n";
import { translateListing, type ListingTranslation } from "@/lib/agent";
import { cn } from "@/lib/utils";

const LANGS = [{ code: "en", label: "English" }, { code: "ru", label: "Русский" }] as const;
type Lang = (typeof LANGS)[number]["code"];

/** The official Italian description, its translation and our plain advice. */
export function Description({ listingId, italian }: { listingId: string; italian: string; signedIn?: boolean }) {
  const qc = useQueryClient();
  const lang = useLang();
  const [showItalian, setShowItalian] = useState(false);
  const cached = useQuery({
    queryKey: ["translations", listingId],
    queryFn: async () => {
      const { data, error } = await supabase.from("listing_translations").select("*").eq("listing_id", listingId);
      if (error) throw error;
      return data as ListingTranslation[];
    },
  });
  const tr = cached.data?.find((t) => t.lang === lang) ?? null;
  const make = useMutation({
    mutationFn: () => translateListing(listingId, lang),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["translations", listingId] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Translation failed"),
  });
  // Translate as soon as the page opens in a language that has no translation yet. Once per listing and language.
  const tried = useRef<string | null>(null);
  useEffect(() => {
    if (!cached.isSuccess || tr || make.isPending || tried.current === lang || !italian.trim()) return;
    tried.current = lang;
    make.mutate();
  }, [cached.isSuccess, tr, lang, italian]); // eslint-disable-line react-hooks/exhaustive-deps
  const advice = Array.isArray(tr?.advice) ? (tr!.advice as unknown[]).filter((a): a is string => typeof a === "string") : [];

  function pick(l: Lang) {
    setLang(l);
  }

  return (
    <div className="glass rounded-2xl p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Languages className="h-4 w-4 text-brand" />
        {LANGS.map((l) => (
          <button key={l.code} type="button" onClick={() => pick(l.code)}
            className={cn("rounded-full px-3 py-1 text-sm", lang === l.code ? "bg-sea text-white" : "glass text-muted-foreground hover:text-brand")}>
            {l.label}
          </button>
        ))}
        <button type="button" onClick={() => setShowItalian(!showItalian)} className="ml-auto text-sm text-muted-foreground hover:text-brand">
          {showItalian ? "Hide the Italian original" : "Show the Italian original"}
        </button>
      </div>

      {tr ? (
        <>
          <p className="max-w-2xl text-lg leading-relaxed">{tr.translation}</p>
          {advice.length > 0 && (
            <div className="mt-5 rounded-2xl bg-brand-soft/70 p-4">
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-brand">
                <Lightbulb className="h-4 w-4" /> {lang === "ru" ? "На что обратить внимание" : "What to watch for"}
              </p>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {advice.map((a, i) => <li key={i}>{a}</li>)}
              </ul>
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            {lang === "ru" ? "Перевод сделан ИИ. Юридически значим только итальянский текст." : "Translated by AI. Only the Italian text is legally binding."}
          </p>
        </>
      ) : (
        <div>
          <p className="text-muted-foreground">
            {make.isPending
              ? lang === "ru" ? "Argos переводит описание и отмечает, на что обратить внимание..." : "Argos is translating the description and noting what to watch for..."
              : lang === "ru" ? "Официальное описание опубликовано на итальянском." : "The official description is in Italian."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" disabled={make.isPending}
              onClick={() => make.mutate()}>
              {make.isPending ? (lang === "ru" ? "Переводим..." : "Translating...") : lang === "ru" ? "Перевести с советами" : "Translate with our advice"}
            </Button>
            <a href={translateUrl(italian)} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1 px-2 text-sm text-brand hover:underline">
              Google Translate <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      )}

      {(showItalian || !tr) && (
        <blockquote lang="it" className={cn("mt-4 border-l-2 border-brand/40 pl-3 text-sm leading-relaxed text-muted-foreground", !showItalian && !tr && "line-clamp-4")}>
          {italian}
        </blockquote>
      )}
    </div>
  );
}
