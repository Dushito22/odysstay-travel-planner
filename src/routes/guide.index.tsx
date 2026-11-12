import { createFileRoute, Link } from "@tanstack/react-router";

import { PublicShell } from "@/components/odys/PublicShell";
import { GUIDES } from "@/lib/guides";

export const Route = createFileRoute("/guide/")({
  head: () => ({
    meta: [
      { title: "Дом в Италии: гайды | Odysstay" },
      { name: "description", content: "Сколько стоит дом в Италии со всеми расходами, дома за 1 евро и судебные торги: понятные гайды от Odysstay." },
      { property: "og:title", content: "Дом в Италии: гайды | Odysstay" },
    ],
    links: [{ rel: "canonical", href: "https://odysstay.xyz/guide" }],
  }),
  component: Index,
});

function Index() {
  return (
    <PublicShell>
      <section lang="ru" className="mx-auto max-w-3xl">
        <h1 className="type-h2">Дом в Италии: гайды</h1>
        <p className="mt-4 type-body text-foreground/62">Короткие и честные разборы того, что обычно остаётся за кадром в объявлениях.</p>
        <ul className="mt-10 divide-y divide-foreground/10 border-y border-foreground/10">
          {GUIDES.map((g) => (
            <li key={g.slug} className="py-6">
              <Link to="/guide/$slug" params={{ slug: g.slug }} className="text-2xl font-light underline decoration-foreground/20 underline-offset-4 hover:decoration-foreground">{g.title}</Link>
              <p className="mt-2 max-w-2xl text-[15px] font-light text-foreground/62">{g.description}</p>
            </li>
          ))}
        </ul>
      </section>
    </PublicShell>
  );
}
