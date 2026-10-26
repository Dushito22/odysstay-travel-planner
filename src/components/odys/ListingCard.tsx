import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { budgetFit, inRegions, renderUrl, SALE_TYPE_LABELS, TYPE_LABELS, type FeedRow } from "@/lib/feed";
import type { Profile } from "@/lib/profile";
import { cn } from "@/lib/utils";
import { DeadlinePill, formatEur, IllustrationLabel, Money, ScoreBadge } from "./primitives";

/** Single OSM tile around a point, used as a warm designed placeholder. */
function osmTile(lat: number, lng: number, z = 11) {
  const n = 2 ** z;
  const x = Math.floor(((lng + 180) / 360) * n);
  const r = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n);
  return `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
}

export function CardImage({ row, compact }: { row: FeedRow; compact?: boolean }) {
  const render = renderUrl(row.latest_render_path) ?? renderUrl(row.hero_image_path);
  const isRender = !!row.latest_render_path;
  return (
    <div className={cn("relative aspect-[4/3] overflow-hidden bg-muted", !compact && "rounded-2xl")}>
      {render ? (
        <img src={render} alt={row.title_en ?? row.comune ?? "Property"} referrerPolicy="no-referrer" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" loading="lazy" />
      ) : (
        <>
          {row.lat != null && row.lng != null ? (
            <img src={osmTile(row.lat, row.lng)} alt="" aria-hidden className="map-tone h-full w-full scale-125 object-cover transition-transform duration-700 group-hover:scale-[1.32]" loading="lazy" />
          ) : (
            <div className="texture-muted h-full w-full" />
          )}
          <div className="absolute inset-0 flex items-end bg-gradient-to-t from-foreground/55 via-foreground/5 to-transparent p-4">
            <span className={cn("font-display font-semibold text-background", compact ? "text-lg" : "text-2xl")}>
              {row.comune ?? "Unknown comune"}
            </span>
          </div>
        </>
      )}
      {isRender && <IllustrationLabel />}
    </div>
  );
}

function Chip({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "terra" | "warn" | "success" | "brand" }) {
  const tones = {
    muted: "bg-muted text-muted-foreground",
    terra: "bg-caution-soft text-caution",
    warn: "bg-warning-soft text-warning",
    success: "bg-success-soft text-success",
    brand: "border text-brand",
  };
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium", tones[tone])}>{children}</span>;
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
    onSuccess: () => qc.invalidateQueries({ queryKey: savedQuery.queryKey }),
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

export function ListingCard({ row, profile, compact }: { row: FeedRow; profile: Profile | null; compact?: boolean }) {
  if (!row.id) return null;
  const fit = budgetFit(row, profile);
  return (
    <article className={cn("group", compact && "overflow-hidden rounded-2xl bg-card")}>
      <Link to="/listing/$id" params={{ id: row.id }} className="block">
        <div className="relative">
          <CardImage row={row} compact={!!compact} />
          <div className="absolute right-3 top-3" onClick={(e) => e.preventDefault()}>
            <ScoreBadge score={row.score} reasons={row.score_reasons} size={compact ? "sm" : "md"} />
          </div>
          {row.is_demo && (
            <span className="absolute left-3 top-3 rounded-full bg-card/95 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide shadow-sm backdrop-blur">Demo</span>
          )}
        </div>
      </Link>
      <div className={cn("space-y-3", compact ? "p-4" : "px-1 pt-4")}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link to="/listing/$id" params={{ id: row.id }}>
              <h3 className="truncate text-lg font-semibold">{row.comune ?? "Unknown comune"}</h3>
            </Link>
            <p className="truncate text-sm text-muted-foreground">
              {[row.province, row.region].filter(Boolean).join(" · ") || "Location not stated"}
            </p>
          </div>
          <SaveButton id={row.id} />
        </div>
        <div>
          <Money value={row.price_eur} className={cn("font-semibold", compact ? "text-xl" : "text-2xl")} />
          {row.min_offer_eur != null && row.price_eur != null && row.min_offer_eur < row.price_eur && (
            <p className="mt-0.5 text-sm tnum">Offers from {formatEur(row.min_offer_eur)}</p>
          )}
          <p className="mt-1 text-sm text-muted-foreground tnum">
            {[
              row.surface_sqm != null ? `${row.surface_sqm} m²` : null,
              row.price_per_sqm != null && row.price_eur !== 1 ? `${formatEur(Math.round(row.price_per_sqm))}/m²` : null,
            ].filter(Boolean).join(" · ") || "Surface not stated"}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {row.property_type && <Chip>{TYPE_LABELS[row.property_type] ?? row.property_type}</Chip>}
          {row.sale_type && row.sale_type !== "sale" && row.sale_type !== "one_euro" && (
            <Chip tone="brand">{SALE_TYPE_LABELS[row.sale_type] ?? row.sale_type}</Chip>
          )}
          {(row.discount_pct ?? 0) >= 15 && <Chip tone="success">{row.discount_pct}% below appraisal</Chip>}
          {row.occupancy === "free" && <Chip>Vacant</Chip>}
          {row.occupancy === "occupied" && <Chip tone="warn">Occupied</Chip>}
          {row.previous_auction_failed && <Chip tone="terra">Unsold before</Chip>}
          <DeadlinePill deadline={row.deadline_at ?? row.auction_at} />
          {(row.red_flag_count ?? 0) > 0 && (
            <Chip tone="warn">{row.red_flag_count} red flag{row.red_flag_count === 1 ? "" : "s"}</Chip>
          )}
          {fit === "within" && <Chip tone="success">Matches your budget</Chip>}
          {inRegions(row, profile) && <Chip tone="success">In your regions</Chip>}
        </div>
        {!compact && row.summary_en && <p className="line-clamp-2 text-sm text-muted-foreground">{row.summary_en}</p>}
        {compact && (
          <Link to="/listing/$id" params={{ id: row.id }} className="inline-block text-sm font-medium text-brand hover:underline">
            View
          </Link>
        )}
      </div>
    </article>
  );
}

export function ListingCardSkeleton() {
  return (
    <div>
      <div className="aspect-[4/3] animate-pulse rounded-2xl bg-muted" />
      <div className="space-y-3 px-1 pt-4">
        <div className="h-5 w-1/2 animate-pulse rounded bg-muted" />
        <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
        <div className="h-7 w-2/5 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}
