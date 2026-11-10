const $ = (id) => document.getElementById(id);
async function show() {
  const { key, status, lastRun } = await chrome.storage.local.get(["key", "status", "lastRun"]);
  $("keybox").style.display = key ? "none" : "block";
  const when = (t) => new Date(t).toLocaleString();
  let s = key ? "Key saved." : "No key yet.";
  if (status) {
    if (status.running) s = `Working: ${status.sent} ads sent so far (${status.region}).`;
    else if (status.error) s = `Last try ${when(status.at)}: ${status.error}`;
    else s = `Last run ${when(status.at)}: ${status.sent} ads sent.${status.blocked ? ` Stopped early: ${status.blocked}.` : ""}`;
  }
  if (lastRun) s += ` Next run about ${when(lastRun + 20 * 3600e3)}.`;
  $("status").textContent = s;
}
$("save").onclick = async () => {
  const k = $("key").value.trim();
  if (!k.startsWith("odf_")) { $("status").textContent = "That doesn't look like the key from /admin."; return; }
  await chrome.storage.local.set({ key: k });
  show();
};
$("run").onclick = () => {
  $("status").textContent = "Running. This takes a few minutes; you can close this.";
  chrome.runtime.sendMessage("run", () => show());
};
setInterval(show, 3000);
show();
