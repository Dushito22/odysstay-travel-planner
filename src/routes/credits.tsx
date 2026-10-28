import { createFileRoute } from "@tanstack/react-router";

import { PublicShell } from "@/components/odys/PublicShell";
import { PHOTO_CREDITS } from "@/lib/photo-credits";

export const Route = createFileRoute("/credits")({
  head: () => ({ meta: [{ title: "Photo credits | Odysstay" }] }),
  component: Credits,
});

function Credits() {
  return (
    <PublicShell>
      <article className="mx-auto max-w-3xl">
        <h1 className="type-h2">Photo credits</h1>
        <p className="mt-4 type-body text-foreground/62">
          Photographs of Italy on our pages come from Wikimedia Commons under open licences. We regraded them
          (black and white or muted colour, film grain, cropped). Our edited versions carry the same licence as the original.
        </p>
        <ul className="mt-10 divide-y divide-foreground/10 border-y border-foreground/10">
          {PHOTO_CREDITS.map((p) => (
            <li key={p.image} className="grid gap-4 py-5 sm:grid-cols-[96px_1fr]">
              <img src={`/img/${p.image}.webp`} alt="" className="aspect-square w-24 rounded-[8px] object-cover" loading="lazy" />
              <div className="text-[15px] font-light">
                <a href={p.source} target="_blank" rel="noreferrer" className="underline decoration-foreground/25 underline-offset-4 hover:decoration-foreground">{p.title}</a>
                <p className="mt-1 text-foreground/62">{p.author} · {p.license}</p>
              </div>
            </li>
          ))}
        </ul>
      </article>
    </PublicShell>
  );
}
