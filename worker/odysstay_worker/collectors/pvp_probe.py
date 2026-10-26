"""One-off probe: which host serves court portal attachments and photos."""
import urllib.parse

import httpx

H = {"User-Agent": "Mozilla/5.0 OdysstayBot"}
LINKS = [
    "/immagini-beni/4510349/3185468/442 2025 Foto facciata.jpg?versionId=a93169c3-c37e-448b-a9e4-79f2e76afc4a",
    "/allegati/1900273/ordinanza vendita.pdf?versionId=1fe9a392-cd54-43d1-a48f-0d28ebb73347",
]


def run():
    c = httpx.Client(timeout=40, headers=H, follow_redirects=True)
    out = []
    for link in LINKS:
        path, _, q = link.partition("?")
        for base in ("https://resource-pvp.giustizia.it", "https://pvp.giustizia.it", "https://pvp.giustizia.it/pvp", "https://resource-pvp.giustizia.it/pvp"):
            u = base + urllib.parse.quote(path) + ("?" + q if q else "")
            try:
                r = c.get(u)
                out.append(f"{base} {path[:20]} -> {r.status_code} {r.headers.get('content-type')} {len(r.content)}")
            except Exception as e:
                out.append(f"{base} {path[:20]} -> error {str(e)[:80]}")
    print("FETCH " + " || ".join(out))
