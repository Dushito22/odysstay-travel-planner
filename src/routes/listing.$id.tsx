import { createFileRoute, Link } from "@tanstack/react-router";

import { Wordmark } from "@/components/odys/primitives";

export const Route = createFileRoute("/listing/$id")({
  head: () => ({
    meta: [
      { title: "Listing | Odysstay" },
      { name: "description", content: "An Italian property from an official public notice, explained in English." },
      { property: "og:title", content: "Listing | Odysstay" },
      { property: "og:description", content: "An Italian property from an official public notice, explained in English." },
    ],
  }),
  component: ListingPage,
});

function ListingPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <Link to="/"><Wordmark className="text-xl" /></Link>
      <div className="mt-12 rounded-lg border border-dashed bg-card p-10 text-center text-muted-foreground">
        The listing page arrives here soon.
      </div>
    </div>
  );
}
