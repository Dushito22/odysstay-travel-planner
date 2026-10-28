const $ = (id) => document.getElementById(id);
chrome.storage.local.get(["token", "total", "last"]).then(({ token, total = 0, last = "" }) => {
  if (token) $("token").value = token;
  $("status").textContent = `${total} listings sent so far. ${last}`;
});
$("save").onclick = async () => {
  await chrome.storage.local.set({ token: $("token").value.trim() });
  $("status").textContent = "Saved. Open an Idealista or Immobiliare page.";
};
