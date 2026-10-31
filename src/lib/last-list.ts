/** The last results page the buyer was on (Discover with its filters, the map, Argos, Saved), so a
 * listing's back button returns to exactly that search instead of a fresh Discover. Per tab. */
const KEY = "odys-last-list";
const LISTS = /^\/(discover|map|saved|argos)(\/|$)/;

export function rememberList(href: string, pathname: string) {
  if (!LISTS.test(pathname)) return;
  try { sessionStorage.setItem(KEY, href); } catch { /* storage blocked */ }
}

export function lastList(): { href: string; kind: "argos" | "list" } | null {
  try {
    const href = sessionStorage.getItem(KEY);
    if (!href || !href.startsWith("/")) return null;
    return { href, kind: href.startsWith("/argos") ? "argos" : "list" };
  } catch {
    return null;
  }
}
