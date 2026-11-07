const KEY = "odys-src";

/** Remembers where this visitor first came from: ?utm_source, ?ref, or the referring site. Kept once. */
export function rememberSource() {
  try {
    if (localStorage.getItem(KEY)) return;
    const q = new URLSearchParams(window.location.search);
    let src = q.get("utm_source") || q.get("ref") || "";
    if (!src && document.referrer) {
      const host = new URL(document.referrer).hostname.replace(/^www\./, "");
      if (!/odysstay\./.test(host)) src = host;
    }
    if (src) localStorage.setItem(KEY, src.slice(0, 60));
  } catch { /* storage blocked: nothing to remember */ }
}

export function signupSource(): string | null {
  try { return localStorage.getItem(KEY); } catch { return null; }
}
