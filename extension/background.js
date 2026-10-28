// Posts captured listings to Odysstay with your personal capture token.
const ENDPOINT = "https://nryhvtxprjiylajolcef.supabase.co/functions/v1/capture";
const APIKEY = "sb_publishable_zdY6uxrouCZN2azT4rxUwQ_kZ6H86b5";

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type !== "capture") return;
  (async () => {
    const { token = "", total = 0 } = await chrome.storage.local.get(["token", "total"]);
    if (!token) {
      await chrome.storage.local.set({ last: "Add your capture token in the Odysstay Capture popup." });
      return;
    }
    try {
      const r = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: APIKEY, "x-capture-token": token },
        body: JSON.stringify({ source: msg.source, context: msg.context, listings: msg.listings }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      const n = j.saved || 0;
      await chrome.storage.local.set({ total: total + n, last: `Sent ${n} from ${msg.source} at ${new Date().toLocaleTimeString()}` });
      chrome.action.setBadgeText({ text: String(Math.min(999, total + n)) });
      chrome.action.setBadgeBackgroundColor({ color: "#1e3a32" });
    } catch (e) {
      await chrome.storage.local.set({ last: `Error: ${e.message}` });
    }
  })();
});
