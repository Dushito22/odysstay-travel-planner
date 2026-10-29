import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { budgetFit, CONDITION_LABELS, inRegions, isCourtPhoto, renderUrl, SALE_TYPE_LABELS, TYPE_LABELS, type FeedRow } from "@/lib/feed";
import { useLang } from "@/lib/i18n";
import { useT } from "@/lib/tr";
import type { Profile } from "@/lib/profile";
import { cn } from "@/lib/utils";
import { DeadlinePill, formatEur, IllustrationLabel, Money } from "./primitives";

/** Satellite photo of the exact spot (Esri World Imagery), used when the court published no photos. */
export function satelliteUrl(lat: number, lng: number, w = 800, h = 600, halfKm = 0.18) {
  const dLat = halfKm / 111;
  const dLng = (halfKm / (111 * Math.cos((lat * Math.PI) / 180))) * (w / h);
  const bbox = [lng - dLng, lat - dLat, lng + dLng, lat + dLat].map((v) => v.toFixed(6)).join(",");
  return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${bbox}&bboxSR=4326&imageSR=3857&size=${w},${h}&format=jpg&f=image`;
}

/** The listing photo. Always the same 4:3 frame. Scanned court photos (tall pages with white margins)
 * sit on a blurred copy of themselves so every card looks the same shape. */
export function CardImage({ row, compact }: { row: FeedRow; compact?: boolean }) {
  const t = useT();
  // Court inspection photos are low-resolution scanned pages. When we know where the house is, a satellite view is the better cover.
  const scan = !row.latest_render_path && isCourtPhoto(row.hero_image_path) && row.lat != null && row.lng != null;
  const render = scan ? null : renderUrl(row.latest_render_path) ?? renderUrl(row.hero_image_path);
  const isRender = !!row.latest_render_path;
  const [fit, setFit] = useState<"cover" | "contain">("cover");
  return (
    <div className={cn("relative aspect-[4/3] overflow-hidden bg-muted", !compact && "rounded-[10px]")}>
      {render ? (
        <>
          {fit === "contain" && (
            <img src={render} alt="" aria-hidden referrerPolicy="no-referrer" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-70 blur-xl" />
          )}
          <img
            src={render}
            alt={row.title_en ?? row.comune ?? "Property"}
            referrerPolicy="no-referrer"
            loading="lazy"
            onLoad={(e) => {
              const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
              if (h && w / h < 1.05) setFit("contain");
            }}
            className={cn(
              "relative h-full w-full transition-transform duration-500 group-hover:scale-[1.03]",
              fit === "cover" ? "object-cover" : "object-contain",
            )}
          />
        </>
      ) : (
        <>
          {row.lat != null && row.lng != null ? (
            <img src={satelliteUrl(row.lat, row.lng)} alt={`Satellite view of ${row.comune ?? "the location"}`} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]" loading="lazy" />
          ) : (
            <div className="texture-muted h-full w-full" />
          )}
          {row.lat != null && (
            <span className="absolute bottom-3 left-3 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-light text-white/90 backdrop-blur">
              {t("Satellite view · no photos published")}
            </span>
          )}
        </>
      )}
      {isRender && <IllustrationLabel />}
    </div>
  );
}

function Chip({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "terra" | "warn" | "success" | "brand" }) {
  const tones = {
    muted: "bg-muted text-foreground/65",
    terra: "bg-caution-soft text-caution",
    warn: "bg-warning-soft text-warning",
    success: "bg-success-soft text-success",
    brand: "bg-azure-soft text-azure",
  };
  return <span className={cn("inline-flex h-6 shrink-0 items-center whitespace-nowrap rounded-full px-2.5 text-[12px] font-light", tones[tone])}>{children}</span>;
}

export const savedQuery = {
  queryKey: ["saved-ids"],
  queryFn: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return null;
    const { data, error } = await supabase.from("saved_listings").select("listing_id");
    if (error) throw error;
    return new Set(data.map((d) => d.listing_id));
  },
};

export function SaveButton({ id }: { id: string }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: saved } = useQuery(savedQuery);
  const isSaved = !!saved?.has(id);
  const m = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("signin");
      const r = isSaved
        ? await supabase.from("saved_listings").delete().eq("listing_id", id).eq("user_id", u.user.id)
        : await supabase.from("saved_listings").insert({ listing_id: id, user_id: u.user.id });
      if (r.error) throw r.error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: savedQuery.queryKey });
      qc.invalidateQueries({ queryKey: ["listing", id] });
      if (!isSaved) toast("Saved. We are reading the court documents for you, usually within the hour.");
    },
    onError: (e) => {
      if (e instanceof Error && e.message === "signin") {
        toast("Sign in to save listings", { action: { label: "Sign in", onClick: () => navigate({ to: "/login", search: { redirect: window.location.pathname + window.location.search } }) } });
      } else toast.error("Could not save. Please try again.");
    },
  });
  return (
    <button
      type="button"
      aria-label={isSaved ? "Remove from saved" : "Save listing"}
      aria-pressed={isSaved}
      onClick={(e) => { e.preventDefault(); m.mutate(); }}
      className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-brand"
    >
      <Heart className={cn("h-5 w-5", isSaved && "fill-primary text-brand")} />
    </button>
  );
}

/** One listing, Balance-calm: same frame, same rhythm, three facts that matter, the rest on the page. */
export function ListingCard({ row, profile, compact }: { row: FeedRow; profile: Profile | null; compact?: boolean }) {
  const t = useT();
  const lang = useLang();
  if (!row.id) return null;
  const fit = budgetFit(row, profile);
  const days = row.deadline_at ?? row.auction_at;
  const chips = [
    row.sale_type && row.sale_type !== "sale" && row.sale_type !== "one_euro" ? (
      <Chip key="sale" tone="brand">{t(SALE_TYPE_LABELS[row.sale_type] ?? row.sale_type)}</Chip>
    ) : row.sale_type === "one_euro" ? (
      <Chip key="sale" tone="brand">{t("€1 scheme")}</Chip>
    ) : null,
    row.condition ? <Chip key="cond" tone={row.condition === "ruin" ? "terra" : row.condition === "ready" ? "success" : "warn"}>{t(CONDITION_LABELS[row.condition] ?? row.condition)}</Chip> : null,
    (row.discount_pct ?? 0) >= 15 ? <Chip key="disc" tone="success">{t("below valuation") === "below valuation" ? `${row.discount_pct}% below valuation` : `на ${row.discount_pct}% ниже оценки`}</Chip> : null,
    days ? <DeadlinePill key="dl" deadline={days} /> : null,
    row.occupancy === "free" ? <Chip key="occ">{t("Vacant")}</Chip> : row.occupancy === "occupied" ? <Chip key="occ" tone="warn">{t("Occupied")}</Chip> : null,
    fit === "within" ? <Chip key="fit" tone="success">{t("In budget")}</Chip> : null,
    inRegions(row, profile) ? <Chip key="reg" tone="success">{t("Your regions")}</Chip> : null,
  ].filter(Boolean).slice(0, 3);
  const meta = [
    row.property_type ? t(TYPE_LABELS[row.property_type] ?? row.property_type) : null,
    row.surface_sqm != null ? `${Math.round(row.surface_sqm).toLocaleString("en-GB")} ${lang === "ru" ? "м²" : "m²"}` : row.land_sqm != null ? `${Math.round(row.land_sqm).toLocaleString("en-GB")} ${lang === "ru" ? "м² земли" : "m² land"}` : null,
    row.price_per_sqm != null && row.price_eur !== 1 ? `${formatEur(Math.round(row.price_per_sqm))}/m²` : null,
  ].filter(Boolean).join(" · ");
  return (
    <article className={cn(
      "group flex h-full flex-col overflow-hidden rounded-[10px] border border-foreground/[0.08] bg-card transition-shadow hover:shadow-[0_18px_40px_-24px_oklch(0.2_0.02_245/0.35)]",
    )}>
      <Link to="/listing/$id" params={{ id: row.id }} className="relative block">
        <CardImage row={row} compact />
        {row.is_demo && (
          <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] uppercase tracking-[0.1em] backdrop-blur">Demo</span>
        )}
      </Link>
      <div className={cn("flex flex-1 flex-col", compact ? "p-4" : "p-5")}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link to="/listing/$id" params={{ id: row.id }}>
              <h3 className={cn("truncate font-display leading-tight", compact ? "text-[20px]" : "text-[24px]")}>{row.comune ?? t("Unknown comune")}</h3>
            </Link>
            <p className="mt-0.5 truncate text-[13px] font-light text-foreground/55">
              {[row.province, row.region ? t(row.region) : null].filter(Boolean).join(" · ") || t("Location not stated")}
            </p>
          </div>
          <div className="-mr-2 -mt-1"><SaveButton id={row.id} /></div>
        </div>
        <div className="mt-4 flex items-baseline justify-between gap-3">
          <Money value={row.price_eur} className={cn(compact ? "text-[20px]" : "text-[26px]", "leading-none")} showOneEuroChip={false} />
          {row.min_offer_eur != null && row.price_eur != null && row.min_offer_eur < row.price_eur && (
            <span className="text-[13px] font-light text-foreground/60 tnum">{t("offers from")} {formatEur(row.min_offer_eur)}</span>
          )}
        </div>
        <p className="mt-2 truncate text-[13px] font-light text-foreground/55 tnum">{meta || t("Surface not stated")}</p>
        <div className="mt-4 flex h-6 flex-wrap gap-1.5 overflow-hidden">{chips}</div>
        <div className="min-h-4 flex-1" />
        <div className="flex items-center justify-between border-t border-foreground/[0.08] pt-3.5 text-[13px] font-light">
          {row.score != null ? (
            <span className="flex items-center gap-2 text-foreground/60">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-azure" />
              {t("Deal score")} <span className="text-foreground tnum">{row.score}</span>
              {(row.red_flag_count ?? 0) > 0 && <span className="text-warning">· {lang === "ru" ? `тревожных сигналов: ${row.red_flag_count}` : `${row.red_flag_count} red flag${row.red_flag_count === 1 ? "" : "s"}`}</span>}
            </span>
          ) : <span />}
          <Link to="/listing/$id" params={{ id: row.id }} className="text-foreground/70 transition-colors hover:text-azure">
            {t("View →")}
          </Link>
        </div>
      </div>
    </article>
  );
}

export function ListingCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[10px] border border-foreground/[0.08]">
      <div className="aspect-[4/3] animate-pulse bg-muted" />
      <div className="space-y-3 p-5">
        <div className="h-5 w-1/2 animate-pulse rounded bg-muted" />
        <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
        <div className="h-7 w-2/5 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}
