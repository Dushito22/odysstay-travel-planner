// Once a day, while Chrome is open: opens immobiliare.it in a background tab, reads the newest ads in a
// few regions through the site's own search API (the same calls the page makes), sends them raw to
// Odysstay, closes the tab. Slow on purpose: one page every 3 to 6 seconds.
const SUPABASE = "https://nryhvtxprjiylajolcef.supabase.co";
const ANON = "sb_publishable_zdY6uxrouCZN2azT4rxUwQ_kZ6H86b5";
const REGIONS = [
  ["Sicilia", "sicilia", "sic"], ["Puglia", "puglia", "pug"], ["Calabria", "calabria", "cal"], ["Sardegna", "sardegna", "sar"],
  ["Abruzzo", "abruzzo", "abr"], ["Molise", "molise", "mol"], ["Basilicata", "basilicata", "bas"], ["Campania", "campania", "cam"],
  ["Toscana", "toscana", "tos"], ["Umbria", "umbria", "umb"], ["Marche", "marche", "mar"], ["Lazio", "lazio", "laz"],
  ["Liguria", "liguria", "lig"], ["Piemonte", "piemonte", "pie"],
];
const BANDS = [[0, 30000], [30000, 60000], [60000, 100000]];
const PER_RUN = 4, PAGES = 4, EVERY_H = 20;

chrome.runtime.onInstalled.addListener(() => chrome.alarms.create("tick", { periodInMinutes: 60 }));
chrome.runtime.onStartup.addListener(() => { chrome.alarms.create("tick", { periodInMinutes: 60 }); maybeRun(); });
chrome.alarms.onAlarm.addListener((a) => { if (a.name === "tick") maybeRun(); });
chrome.runtime.onMessage.addListener((m, _s, reply) => {
  if (m === "run") { run().then(reply, (e) => reply({ error: String(e) })); return true; }
});

async function maybeRun() {
  const { lastRun = 0, key } = await chrome.storage.local.get(["lastRun", "key"]);
  if (key && Date.now() - lastRun > EVERY_H * 3600e3) await run();
}

const setStatus = (s) => chrome.storage.local.set({ status: { ...s, at: Date.now() } });

async function run() {
  const { key, cursor = 0, running = 0 } = await chrome.storage.local.get(["key", "cursor", "running"]);
  if (!key) return setStatus({ error: "Paste your key first." });
  if (Date.now() - running < 30 * 60e3) return { busy: true };
  await chrome.storage.local.set({ running: Date.now() });
  const tab = await chrome.tabs.create({ url: "https://www.immobiliare.it/", active: false });
  let sent = 0, blocked = null;
  try {
    await loaded(tab.id);
    const picks = Array.from({ length: PER_RUN }, (_, i) => REGIONS[(cursor + i) % REGIONS.length]);
    for (const [region, slug, code] of picks) {
      const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, world: "MAIN", func: readRegion, args: [slug, code, BANDS, PAGES] });
      if (result.blocked) { blocked = result.blocked; }
      const rows = result.items.map((it) => ({ source: "immobiliare", external_id: String(it.realEstate.id), region, payload: it, processed_at: null, error: null }));
      for (let i = 0; i < rows.length; i += 100) await send(key, rows.slice(i, i + 100));
      sent += rows.length;
      await setStatus({ running: true, sent, region });
      if (blocked) break;
    }
    await chrome.storage.local.set({ lastRun: Date.now(), cursor: (cursor + PER_RUN) % REGIONS.length });
    await setStatus({ sent, blocked });
    return { sent, blocked };
  } catch (e) {
    await setStatus({ sent, error: String(e.message || e) });
    return { sent, error: String(e) };
  } finally {
    chrome.tabs.remove(tab.id).catch(() => {});
    await chrome.storage.local.set({ running: 0 });
  }
}

function loaded(tabId) {
  return new Promise((ok, fail) => {
    const t = setTimeout(() => fail(new Error("immobiliare.it did not load")), 60e3);
    const h = (id, info) => { if (id === tabId && info.status === "complete") { clearTimeout(t); chrome.tabs.onUpdated.removeListener(h); setTimeout(ok, 2500); } };
    chrome.tabs.onUpdated.addListener(h);
  });
}

async function send(key, rows) {
  const r = await fetch(`${SUPABASE}/rest/v1/raw_imports?on_conflict=source,external_id`, {
    method: "POST",
    headers: { apikey: ANON, authorization: `Bearer ${ANON}`, "content-type": "application/json", prefer: "resolution=merge-duplicates,return=minimal", "x-feeder-token": key },
    body: JSON.stringify(rows),
  });
  if (!r.ok) throw new Error(`Odysstay said ${r.status}: ${(await r.text()).slice(0, 200)}`);
}

// Runs inside the immobiliare.it page, so the requests are the site's own, with its cookies.
async function readRegion(slug, code, bands, pages) {
  const items = [];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (const [lo, hi] of bands) {
    for (let pag = 1; pag <= pages; pag++) {
      await sleep(3000 + Math.random() * 3000);
      const q = new URLSearchParams({ fkRegione: code, idContratto: "1", idCategoria: "1", idNazione: "IT", prezzoMassimo: String(hi), criterio: "dataModifica", ordine: "desc", pag: String(pag), __lang: "it", path: `/vendita-case/${slug}/` });
      if (lo) q.set("prezzoMinimo", String(lo));
      let j;
      try {
        const r = await fetch(`/api-next/search-list/listings/?${q}`, { headers: { accept: "application/json" } });
        if (r.status !== 200) return { items, blocked: `${r.status} on ${slug}` };
        j = await r.json();
      } catch (e) { return { items, blocked: String(e) }; }
      const res = (j.results || []).filter((x) => x && x.realEstate && x.realEstate.id);
      items.push(...res);
      if (res.length < 20) break;
    }
  }
  return { items };
}
