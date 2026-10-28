/**
 * Odysstay: forwards Idealista and Immobiliare alert emails from your Gmail to your Odysstay feed.
 * Setup (once): script.google.com → New project → paste this file → set CAPTURE_TOKEN below →
 * run `install` once and allow access. It then runs every 15 minutes by itself.
 * It only reads alert emails from those two portals and labels each one it has sent.
 */
const CAPTURE_TOKEN = "PASTE_YOUR_CAPTURE_TOKEN";
const ENDPOINT = "https://nryhvtxprjiylajolcef.supabase.co/functions/v1/capture";
const APIKEY = "sb_publishable_zdY6uxrouCZN2azT4rxUwQ_kZ6H86b5";
const DONE = "odysstay-sent";

function install() {
  ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger("run").timeBased().everyMinutes(15).create();
  run();
}

function run() {
  const label = GmailApp.getUserLabelByName(DONE) || GmailApp.createLabel(DONE);
  const threads = GmailApp.search(`from:(idealista.it OR immobiliare.it) -label:${DONE} newer_than:14d`, 0, 30);
  threads.forEach((thread) => {
    const bySource = { idealista: [], immobiliare: [] };
    thread.getMessages().forEach((m) => {
      const html = m.getBody();
      const re = /href="(https?:\/\/(?:www\.)?(idealista\.it|immobiliare\.it)\/[^"]*?(?:immobile|annunci)\/(\d+)[^"]*)"/g;
      let match;
      while ((match = re.exec(html))) {
        const source = match[2].startsWith("idealista") ? "idealista" : "immobiliare";
        const around = html.slice(Math.max(0, match.index - 1500), match.index + 2500);
        const text = around.replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/\s+/g, " ");
        const price = (text.match(/€\s?\d{1,3}(?:\.\d{3})+|\d{1,3}(?:\.\d{3})+\s?€/) || [""])[0];
        const sqm = (text.match(/(\d{2,5})\s?m(?:²|q)/i) || [])[1];
        const img = (around.match(/<img[^>]+src="(https:\/\/[^"]+)"/i) || [])[1] || "";
        const url = match[1].replace(/&amp;/g, "&").split("?")[0];
        if (!bySource[source].some((x) => x.id === match[3])) {
          bySource[source].push({ id: match[3], url, title: text.slice(0, 160), price, sqm: sqm ? Number(sqm) : null,
            place: text.slice(0, 200), photo: /logo|icon|pixel|track/i.test(img) ? "" : img, description: text.slice(0, 500) });
        }
      }
    });
    let ok = true;
    Object.keys(bySource).forEach((source) => {
      if (!bySource[source].length) return;
      const r = UrlFetchApp.fetch(ENDPOINT, {
        method: "post", contentType: "application/json", muteHttpExceptions: true,
        headers: { apikey: APIKEY, "x-capture-token": CAPTURE_TOKEN },
        payload: JSON.stringify({ source, context: thread.getFirstMessageSubject(), listings: bySource[source] }),
      });
      if (r.getResponseCode() >= 300) { ok = false; console.log(source, r.getResponseCode(), r.getContentText()); }
    });
    if (ok) thread.addLabel(label);
  });
}
