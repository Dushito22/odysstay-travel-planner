import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { rememberSource } from "@/lib/source";

/** Short links for posts: odysstay.xyz/go/reddit, /go/hn, /go/pikabu. Remembers the channel, then opens the houses
 *  (or ?to=/listing/<id> for a single house). */
export const Route = createFileRoute("/go/$src")({
  component: Go,
  head: () => ({ meta: [{ title: "Odysstay: houses in Italy" }, { name: "robots", content: "noindex" }] }),
});

function Go() {
  const { src } = Route.useParams();
  const navigate = useNavigate();
  useEffect(() => {
    rememberSource(src);
    const to = new URLSearchParams(window.location.search).get("to");
    if (to && /^\/(listing|discover|login)\b/.test(to)) window.location.replace(to);
    else void navigate({ to: "/discover", replace: true });
  }, [src, navigate]);
  return <div className="min-h-dvh" />;
}
