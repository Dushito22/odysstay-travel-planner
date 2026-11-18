import { supabase } from "@/integrations/supabase/client";

const KEY = "odys-src";

/** Remembers where this visitor first came from: ?utm_source, ?ref, /go/<channel>, or the referring site. Kept once,
 *  and counted once as a visit for that channel (the admin page shows visits, sign-ups and deals per channel). */
export function rememberSource(forced?: string) {
  try {
    if (localStorage.getItem(KEY)) return;
    const q = new URLSearchParams(window.location.search);
    let src = forced || q.get("utm_source") || q.get("ref") || "";
    if (!src && document.referrer) {
      const host = new URL(document.referrer).hostname.replace(/^www\./, "");
      if (!/odysstay\./.test(host)) src = host;
    }
    src = src.toLowerCase().replace(/[^a-z0-9_.-]/g, "").slice(0, 60);
    if (!src) return;
    localStorage.setItem(KEY, src);
    void supabase.from("visits" as never).insert({ source: src, path: window.location.pathname.slice(0, 200) } as never).then(() => {}, () => {});
  } catch { /* storage blocked: nothing to remember */ }
}

export function signupSource(): string | null {
  try { return localStorage.getItem(KEY); } catch { return null; }
}
