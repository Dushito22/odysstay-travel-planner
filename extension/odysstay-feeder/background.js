// Once a day, while Chrome is open: opens immobiliare.it in a background tab, reads the newest ads in
// every region through the site's own search API (the same calls the page makes), sends them raw to
// Odysstay, closes the tab. Slow on purpose: one page every 3 to 6 seconds.
const SUPABASE = "https://nryhvtxprjiylajolcef.supabase.co";
const ANON = "sb_publishable_zdY6uxrouCZN2azT4rxUwQ_kZ6H86b5";
const REGIONS = [
  ["Sicilia", "sicilia", "sic"], ["Puglia", "puglia", "pug"], ["Calabria", "calabria", "cal"], ["Sardegna", "sardegna", "sar"],
  ["Abruzzo", "abruzzo", "abr"], ["Molise", "molise", "mol"], ["Basilicata", "basilicata", "bas"], ["Campania", "campania", "cam"],
  ["Toscana", "toscana", "tos"], ["Umbria", "umbria", "umb"], ["Marche", "marche", "mar"], ["Lazio", "lazio", "laz"],
  ["Liguria", "liguria", "lig"], ["Piemonte", "piemonte", "pie"], ["Emilia-Romagna", "emilia-romagna", "emi"], ["Veneto", "veneto", "ven"],
  ["Friuli-Venezia Giulia", "friuli-venezia-giulia", "fri"], ["Lombardia", "lombardia", "lom"], ["Trentino-Alto Adige", "trentino-alto-adige", "tre"], ["Valle d'Aosta", "valle-d-aosta", "val"],
];
const BANDS = [[0, 30000], [30000, 60000], [60000, 100000]];
const MAX_PAGES = 5, EVERY_H = 20, SEEN_CAP = 30000;

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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Every region, newest ads first. A price band stops as soon as a page is mostly ads already sent,
// so the first run reads deep (about half an hour) and later runs only pick up what's new.
async function run() {
  const { key, running = 0, seen: seenList = [] } = await chrome.storage.local.get(["key", "running", "seen"]);
  if (!key) return setStatus({ error: "Paste your key first." });
  if (Date.now() - running < 40 * 60e3) return { busy: true };
  await chrome.storage.local.set({ running: Date.now() });
  const seen = new Set(seenList);
  let tab, sent = 0, pages = 0, blocked = null, done = 0;
  try {
    tab = await chrome.tabs.create({ url: "https://www.immobiliare.it/vendita-case/sicilia/", active: false });
    await chrome.tabs.update(tab.id, { autoDiscardable: false }).catch(() => {});
    await loaded(tab.id);
    for (const [region, slug, code] of REGIONS) {
      const rows = [];
      for (const [lo, hi] of BANDS) {
        for (let pag = 1; pag <= MAX_PAGES; pag++) {
          await sleep(2500 + Math.random() * 2500);
          const q = new URLSearchParams({ fkRegione: code, idContratto: "1", idCategoria: "1", idNazione: "IT", prezzoMassimo: String(hi), criterio: "dataModifica", ordine: "desc", pag: String(pag), __lang: "it", path: `/vendita-case/${slug}/` });
          if (lo) q.set("prezzoMinimo", String(lo));
          const r = await pageFetch(tab.id, `/api-next/search-list/listings/?${q}`);
          pages++;
          if (r.status === 403 || r.status === 429) { blocked = `${r.status} on ${region}`; break; }
          if (r.status !== 200) break; // this band or region didn't answer: skip it, keep going
          const res = (r.body?.results || []).filter((x) => x && x.realEstate && x.realEstate.id);
          const fresh = res.filter((x) => !seen.has(String(x.realEstate.id)));
          for (const x of res) { rows.push({ source: "immobiliare", external_id: String(x.realEstate.id), region, payload: x, processed_at: null, error: null }); seen.add(String(x.realEstate.id)); }
          if (res.length < 20 || fresh.length < res.length * 0.2) break;
        }
        if (blocked) break;
      }
      for (let i = 0; i < rows.length; i += 100) await send(key, rows.slice(i, i + 100));
      sent += rows.length;
      done++;
      await chrome.storage.local.set({ seen: [...seen].slice(-SEEN_CAP) });
      await setStatus({ running: true, sent, region, done, of: REGIONS.length });
      if (blocked) break;
    }
    await chrome.storage.local.set({ lastRun: Date.now() });
    await setStatus({ sent, pages, blocked, done, of: REGIONS.length });
    return { sent, blocked };
  } catch (e) {
    await setStatus({ sent, done, of: REGIONS.length, error: String(e.message || e) });
    return { sent, error: String(e) };
  } finally {
    if (tab) chrome.tabs.remove(tab.id).catch(() => {});
    await chrome.storage.local.set({ running: 0 });
  }
}

async function loaded(tabId) {
  for (let i = 0; i < 120; i++) {
    const t = await chrome.tabs.get(tabId);
    if (t.status === "complete" && (t.url || "").includes("immobiliare.it")) { await sleep(2000); return; }
    await sleep(500);
  }
  throw new Error("immobiliare.it did not load");
}

// One request made from inside the immobiliare.it page, so it's the site's own call with its cookies.
// If the page reloads in between (the site sometimes does), wait for it and try again.
async function pageFetch(tabId, url) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId }, world: "MAIN",
        func: async (u) => {
          try {
            const r = await fetch(u, { headers: { accept: "application/json" } });
            return { status: r.status, body: r.status === 200 ? await r.json() : null };
          } catch (e) { return { status: 0, error: String(e) }; }
        },
        args: [url],
      });
      if (result && result.status !== 0) return result;
    } catch (e) { /* frame removed or tab busy */ }
    await sleep(3000);
    await loaded(tabId);
  }
  return { status: 0 };
}

async function send(key, rows) {
  const r = await fetch(`${SUPABASE}/rest/v1/raw_imports?on_conflict=source,external_id`, {
    method: "POST",
    headers: { apikey: ANON, authorization: `Bearer ${ANON}`, "content-type": "application/json", prefer: "resolution=merge-duplicates,return=minimal", "x-feeder-token": key },
    body: JSON.stringify(rows),
  });
  if (!r.ok) throw new Error(`Odysstay said ${r.status}: ${(await r.text()).slice(0, 200)}`);
}
