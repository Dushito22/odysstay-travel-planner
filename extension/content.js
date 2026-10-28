// Reads the listings on the Idealista or Immobiliare page you are looking at and hands them to Odysstay.
// It only reads what is already on your screen; it never loads pages by itself.
(() => {
  const host = location.hostname.replace(/^www\./, "");
  const source = host.startsWith("idealista") ? "idealista" : "immobiliare";
  const LINK = source === "idealista" ? /\/immobile\/(\d+)\/?/ : /\/annunci\/(\d+)\/?/;
  const sent = new Set();

  const txt = (el) => (el ? (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim() : "");
  const priceOf = (s) => (s.match(/€\s?\d{1,3}(?:\.\d{3})+|\d{1,3}(?:\.\d{3})+\s?€|€\s?\d{4,}/) || [""])[0];
  const sqmOf = (s) => { const m = s.match(/(\d{2,5})\s?m(?:²|q|2)\b/i); return m ? Number(m[1]) : null; };
  const roomsOf = (s) => { const m = s.match(/(\d+)\s?(?:locali|vani|camere)/i); return m ? Number(m[1]) : null; };
  const imgOf = (root) => {
    const img = root && root.querySelector("img");
    if (!img) return "";
    const src = img.currentSrc || img.src || img.getAttribute("data-src") || (img.getAttribute("srcset") || "").split(" ")[0] || "";
    return src.startsWith("https://") ? src : "";
  };
  const context = () => [document.title, txt(document.querySelector("h1"))].join(" | ");

  function cards() {
    const out = [];
    for (const a of document.querySelectorAll("a[href]")) {
      const m = a.href.match(LINK);
      if (!m || sent.has(m[1])) continue;
      const box = a.closest("article, li, [class*='item'], [class*='card'], [class*='Card'], [class*='listing']") || a.parentElement;
      const t = txt(box);
      const price = priceOf(t);
      if (!price) continue;
      out.push({
        id: m[1], url: a.href.split("?")[0], title: (a.getAttribute("title") || txt(a)).slice(0, 200),
        price, sqm: sqmOf(t), rooms: roomsOf(t), place: (a.getAttribute("title") || txt(a)).slice(0, 200), photo: imgOf(box),
        description: t.slice(0, 600),
      });
    }
    return out;
  }

  function detail() {
    const m = location.pathname.match(LINK);
    if (!m || sent.has(m[1])) return [];
    const meta = (p) => (document.querySelector(`meta[property='${p}'], meta[name='${p}']`) || {}).content || "";
    const body = txt(document.querySelector("main") || document.body).slice(0, 20000);
    const title = txt(document.querySelector("h1")) || meta("og:title");
    return [{
      id: m[1], url: location.href.split("?")[0], title, price: priceOf(body), sqm: sqmOf(body), rooms: roomsOf(body),
      place: [title, txt(document.querySelector("[class*='location'], [class*='address'], [class*='title-minor']"))].join(", "),
      photo: meta("og:image").startsWith("https://") ? meta("og:image") : imgOf(document),
      description: meta("og:description") || meta("description"),
    }];
  }

  let timer = null;
  function scan() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const found = [...detail(), ...cards()];
      if (!found.length) return;
      found.forEach((f) => sent.add(f.id));
      chrome.runtime.sendMessage({ type: "capture", source, context: context(), listings: found });
    }, 800);
  }
  scan();
  new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
})();
