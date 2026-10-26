import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Bell, BellOff, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/odys/AppShell";
import { CardImage } from "@/components/odys/ListingCard";
import { DeadlinePill, Money, ScoreBadge } from "@/components/odys/primitives";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { TYPE_LABELS } from "@/lib/feed";
import {
  deleteSearch,
  saveListingNote,
  savedListingsQuery,
  savedSearchesQuery,
  searchFromFilters,
  setSearchNotify,
  summarizeFilters,
  unsaveListing,
  type SavedListing,
  type SavedSearch,
} from "@/lib/saved";

export const Route = createFileRoute("/_authenticated/saved")({
  head: () => ({ meta: [{ title: "Saved | Odysstay" }] }),
  component: SavedPage,
});

function SavedPage() {
  const listings = useQuery(savedListingsQuery);
  const searches = useQuery(savedSearchesQuery);
  return (
    <>
      <PageHeader
        title="Saved"
        intro="Properties you're watching and the searches we check for you."
      />
      <Tabs defaultValue="properties">
        <TabsList>
          <TabsTrigger value="properties">
            Properties{listings.data?.length ? ` (${listings.data.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="searches">
            Searches{searches.data?.length ? ` (${searches.data.length})` : ""}
          </TabsTrigger>
        </TabsList>
        <div className="mt-6">
          <TabsContent value="properties">
            {listings.error ? (
              <ErrorBox onRetry={() => listings.refetch()} />
            ) : listings.isLoading ? (
              <Loading />
            ) : !listings.data?.length ? (
              <Empty
                text="No saved properties yet. Tap the heart on any listing to keep it here."
                cta={{ to: "/discover", label: "Browse listings" }}
              />
            ) : (
              <ul className="space-y-4">
                {listings.data.map((s) => (
                  <SavedRow key={s.listing_id} s={s} />
                ))}
              </ul>
            )}
          </TabsContent>
          <TabsContent value="searches">
            {searches.error ? (
              <ErrorBox onRetry={() => searches.refetch()} />
            ) : searches.isLoading ? (
              <Loading />
            ) : !searches.data?.length ? (
              <Empty
                text="No saved searches yet. Set filters on Discover and press Save this search."
                cta={{ to: "/discover", label: "Go to Discover" }}
              />
            ) : (
              <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
                {searches.data.map((s) => (
                  <SearchRow key={s.id} s={s} />
                ))}
              </ul>
            )}
          </TabsContent>
        </div>
      </Tabs>
    </>
  );
}

function SavedRow({ s }: { s: SavedListing }) {
  const qc = useQueryClient();
  const [note, setNote] = useState(s.note ?? "");
  const [busy, setBusy] = useState(false);
  const l = s.listing;
  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["saved-listings"] }),
      qc.invalidateQueries({ queryKey: ["saved-ids"] }),
    ]);

  return (
    <li className="flex flex-col gap-4 rounded-2xl border bg-card p-4 sm:flex-row">
      {l ? (
        <Link to="/listing/$id" params={{ id: s.listing_id }} className="w-full shrink-0 sm:w-48">
          <CardImage row={l} compact />
        </Link>
      ) : (
        <div className="flex aspect-[4/3] w-full shrink-0 items-center justify-center rounded-xl bg-muted text-sm text-muted-foreground sm:w-48">
          No longer available
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div>
            {l ? (
              <Link
                to="/listing/$id"
                params={{ id: s.listing_id }}
                className="font-display text-xl font-semibold hover:underline"
              >
                {l.comune ?? "Unknown comune"}
              </Link>
            ) : (
              <p className="font-display text-xl font-semibold text-muted-foreground">
                Listing removed
              </p>
            )}
            {l && (
              <p className="text-sm text-muted-foreground">
                {[
                  l.property_type ? (TYPE_LABELS[l.property_type] ?? l.property_type) : null,
                  l.region,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          </div>
          {l && <ScoreBadge score={l.score} reasons={l.score_reasons} size="sm" />}
        </div>
        {l && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Money value={l.price_eur} />
            <DeadlinePill deadline={l.deadline_at} />
          </div>
        )}
        <div className="mt-3 space-y-2">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Private note"
            aria-label="Private note"
            maxLength={1000}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={busy || note === (s.note ?? "")}
              onClick={async () => {
                setBusy(true);
                try {
                  await saveListingNote(s.listing_id, note);
                  await refresh();
                  toast.success("Note saved");
                } catch {
                  toast.error("Could not save the note");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Save note
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await unsaveListing(s.listing_id);
                  await refresh();
                  toast.success("Removed from saved");
                } catch {
                  toast.error("Could not remove it");
                  setBusy(false);
                }
              }}
            >
              <Trash2 /> Remove
            </Button>
          </div>
        </div>
      </div>
    </li>
  );
}

function SearchRow({ s }: { s: SavedSearch }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ["saved-searches"] });

  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center md:p-5">
      <div className="min-w-0 flex-1">
        <p className="font-medium">{s.name}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{summarizeFilters(s.filters)}</p>
      </div>
      <label className="flex items-center gap-2 text-sm">
        {s.notify_email ? (
          <Bell className="h-4 w-4" />
        ) : (
          <BellOff className="h-4 w-4 text-muted-foreground" />
        )}
        Email alerts
        <Switch
          checked={s.notify_email}
          disabled={busy}
          onCheckedChange={async (on) => {
            setBusy(true);
            try {
              await setSearchNotify(s.id, on);
              await refresh();
            } catch {
              toast.error("Could not update alerts");
            } finally {
              setBusy(false);
            }
          }}
        />
      </label>
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => navigate({ to: "/discover", search: searchFromFilters(s.filters) })}
        >
          <Search /> Open
        </Button>
        <Button
          size="sm"
          variant="ghost"
          aria-label={`Delete ${s.name}`}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await deleteSearch(s.id);
              await refresh();
              toast.success("Search deleted");
            } catch {
              toast.error("Could not delete it");
              setBusy(false);
            }
          }}
        >
          <Trash2 />
        </Button>
      </div>
    </li>
  );
}

function Loading() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton key={i} className="h-28 rounded-2xl" />
      ))}
    </div>
  );
}

function ErrorBox({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-2xl border bg-card p-8">
      <p className="text-warning">Could not load this.</p>
      <Button className="mt-4" variant="outline" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

function Empty({ text, cta }: { text: string; cta: { to: "/discover"; label: string } }) {
  return (
    <div className="rounded-2xl border border-dashed bg-card p-12 text-center">
      <p className="text-muted-foreground">{text}</p>
      <Button asChild variant="outline" className="mt-6">
        <Link to={cta.to}>{cta.label}</Link>
      </Button>
    </div>
  );
}
