import { createFileRoute, Link, notFound } from "@tanstack/react-router";

import { PublicShell } from "@/components/odys/PublicShell";
import { GUIDES, type Guide } from "@/lib/guides";

export const Route = createFileRoute("/guide/$slug")({
  loader: ({ params }) => {
    const g = GUIDES.find((x) => x.slug === params.slug);
    if (!g) throw notFound();
    return g;
  },
  head: ({ loaderData: g }) => ({
    meta: g
      ? [
          { title: `${g.title} | Odysstay` },
          { name: "description", content: g.description },
          { property: "og:title", content: g.title },
          { property: "og:description", content: g.description },
          { property: "og:type", content: "article" },
        ]
      : [],
    links: g ? [{ rel: "canonical", href: `https://odysstay.xyz/guide/${g.slug}` }] : [],
    scripts: g
      ? [{ type: "application/ld+json", children: JSON.stringify({ "@context": "https://schema.org", "@type": "Article", headline: g.title, description: g.description, datePublished: g.date, inLanguage: "ru", author: { "@type": "Organization", name: "Odysstay" }, publisher: { "@type": "Organization", name: "Odysstay" } }) }]
      : [],
  }),
  component: Guide,
  notFoundComponent: () => (
    <PublicShell>
      <p className="mx-auto max-w-2xl type-body">Такого гайда нет. <Link to="/guide" className="underline">Все гайды</Link></p>
    </PublicShell>
  ),
});

function Guide() {
  const g = Route.useLoaderData() as Guide;
  return (
    <PublicShell>
      <article lang="ru" className="mx-auto max-w-2xl">
        <Link to="/guide" className="text-sm text-foreground/55 hover:text-foreground">Все гайды</Link>
        <h1 className="type-h2 mt-4">{g.title}</h1>
        <div className="mt-8 space-y-5">
          {g.blocks.map((b, i) =>
            "h" in b ? <h2 key={i} className="pt-4 text-2xl font-light">{b.h}</h2> : <p key={i} className="type-body leading-[1.7] text-foreground/80">{b.p}</p>,
          )}
        </div>
        <div className="mt-12 border-t border-foreground/10 pt-6">
          <a href="/?site=1&utm_source=guide" className="inline-flex h-11 items-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground">Найти свой дом в Италии</a>
        </div>
      </article>
    </PublicShell>
  );
}
