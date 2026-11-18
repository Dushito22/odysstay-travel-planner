import { createFileRoute, Link, notFound } from "@tanstack/react-router";

import { ListingCard } from "@/components/odys/ListingCard";
import { PublicShell } from "@/components/odys/PublicShell";
import { supabase } from "@/integrations/supabase/client";
import { FEED_COLS, type FeedRow } from "@/lib/feed";
import { BANDS, SEO_REGIONS, seoPage, type SeoPage } from "@/lib/seo-pages";

async function load(p: SeoPage) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = supabase.from("listing_feed").select(FEED_COLS)
    .eq("is_demo", false).eq("is_scrap", false).is("duplicate_of", null).not("status", "in", "(closed,withdrawn)");
  if (p.region) q = q.eq("region", p.region);
  if (p.kind === "auction") q = q.in("sale_type", ["auction_judicial", "auction_notary"]).eq("has_real_photo", true);
  else if (p.kind === "one_euro") q = q.eq("sale_type", "one_euro");
  else q = q.eq("sale_type", "sale").eq("has_real_photo", true).in("property_type", ["house", "rural_house", "apartment", "building"]).gte("price_eur", 5000);
  if (p.max) q = q.lte("price_eur", p.max);
  const { data } = await q.order("score", { ascending: false, nullsFirst: false }).limit(24);
  return { rows: (data ?? []) as FeedRow[] };
}

export const Route = createFileRoute("/houses/$slug")({
  loader: async ({ params }) => {
    const p = seoPage(params.slug);
    if (!p) throw notFound();
    return { p, ...(await load(p)) };
  },
  staleTime: 10 * 60_000,
  head: ({ loaderData }) => {
    const d = loaderData;
    if (!d) return { meta: [{ title: "Houses in Italy | Odysstay" }] };
    const desc = d.p.intro.slice(0, 300);
    return {
      meta: [
        { title: `${d.p.title} | Odysstay` }, { name: "description", content: desc },
        { property: "og:title", content: d.p.title }, { property: "og:description", content: desc },
        ...(d.rows[0] ? [{ property: "og:image", content: `https://odysstay.xyz/api/og/${d.rows[0].id}.png` }] : []),
      ],
      links: [{ rel: "canonical", href: `https://odysstay.xyz/houses/${d.p.slug}` }],
    };
  },
  component: Page,
  notFoundComponent: () => (
    <PublicShell><p className="mx-auto max-w-2xl type-body">No such page. <Link to="/houses/$slug" params={{ slug: "italy" }} className="underline">Houses in Italy</Link></p></PublicShell>
  ),
});

function discoverHref(p: SeoPage) {
  const s = new URLSearchParams({ sort: JSON.stringify("best"), utm_source: "seo" });
  if (p.region) s.set("regions", JSON.stringify([p.region]));
  if (p.max) s.set("maxPrice", String(p.max));
  if (p.kind === "auction") s.set("kind", JSON.stringify("auction"));
  if (p.kind === "one_euro") s.set("kind", JSON.stringify("public"));
  return `/discover?${s.toString()}`;
}

function Page() {
  const { p, rows } = Route.useLoaderData();
  const regionSlug = SEO_REGIONS.find((r) => r.region === p.region)?.slug;
  const cheapest = rows.reduce<number | null>((m, r) => (r.price_eur && (m == null || r.price_eur < m) ? r.price_eur : m), null);
  return (
    <PublicShell>
      <div lang="en" className="mx-auto max-w-6xl">
        <nav className="text-[14px] text-foreground/55">
          <Link to="/houses/$slug" params={{ slug: "italy" }} className="hover:text-foreground">Italy</Link>
          {p.regionName && <> / <Link to="/houses/$slug" params={{ slug: regionSlug! }} className="hover:text-foreground">{p.regionName}</Link></>}
        </nav>
        <h1 className="type-h2 mt-3 max-w-3xl">{p.h1}</h1>
        <p className="mt-4 max-w-2xl text-[17px] font-light leading-relaxed text-foreground/75">{p.intro}</p>
        <p className="mt-3 text-[15px] text-foreground/60">
          {rows.length >= 24 ? "The 24 best deals open now" : `${rows.length} ${rows.length === 1 ? "listing" : "listings"} open now`}{cheapest ? `, from €${Math.round(cheapest).toLocaleString("en-US")}` : ""}. Updated daily.
        </p>
        {rows.length ? (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((r) => <ListingCard key={r.id} row={r} profile={null} />)}
          </div>
        ) : (
          <p className="mt-10 type-body">Nothing open here right now. New houses arrive every day.</p>
        )}
        <div className="mt-10">
          <a href={discoverHref(p)} className="inline-flex h-11 items-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground">
            See them all with filters and the map
          </a>
        </div>
        <section className="mt-14 border-t border-foreground/10 pt-8">
          <h2 className="text-xl font-light">{p.regionName ? `More in ${p.regionName}` : "By budget"}</h2>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[15px]">
            {BANDS.map((b) => (
              <Link key={b} to="/houses/$slug" params={{ slug: `${regionSlug ?? "italy"}-under-${b}` }} className="text-azure hover:underline">Under €{b.toLocaleString("en-US")}</Link>
            ))}
            <Link to="/houses/$slug" params={{ slug: `court-auctions-${regionSlug ?? "italy"}` }} className="text-azure hover:underline">Court auctions</Link>
            <Link to="/houses/$slug" params={{ slug: "one-euro-houses" }} className="text-azure hover:underline">€1 houses</Link>
          </div>
          <h2 className="mt-8 text-xl font-light">Other regions</h2>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[15px]">
            {SEO_REGIONS.filter((r) => r.slug !== regionSlug).map((r) => (
              <Link key={r.slug} to="/houses/$slug" params={{ slug: p.max ? `${r.slug}-under-${p.max}` : p.kind === "auction" ? `court-auctions-${r.slug}` : r.slug }} className="text-foreground/70 hover:text-foreground">{r.name}</Link>
            ))}
          </div>
        </section>
      </div>
    </PublicShell>
  );
}
