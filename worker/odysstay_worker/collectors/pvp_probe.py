"""One-off probe of the Portale Vendite Pubbliche API. Prints field names and samples."""
import json
import re

import httpx

RIC = "https://pvp.giustizia.it/ric-496b258c-986a1b71/ric-ms"
VE = "https://pvp.giustizia.it/ve-3f723b85-986a1b71/ve-ms"
CONFIG = "https://pvp.giustizia.it/bo-5897bc47-986a1b71/bo-ms/fe-config/area-annunci"
H = {"User-Agent": "Mozilla/5.0 OdysstayBot", "Accept": "application/json"}


def short(o, n=2500):
    return json.dumps(o, ensure_ascii=False)[:n]


def run():
    c = httpx.Client(timeout=40, headers=H, follow_redirects=True)
    try:
        r = c.get(CONFIG)
        print("CONFIG", r.status_code, r.text[:600])
    except Exception as e:
        print("CONFIG error", e)
    body = {"tipoLotto": "IMMOBILI", "nazione": "ITA", "prezzoBaseAstaMax": 60000}
    r = c.post(f"{RIC}/ricerca/vendite?page=0&size=5&sort=dataVendita,desc&sort=id,asc", json=body)
    print("SEARCH", r.status_code)
    d = r.json()
    d = d.get("body") or d
    print("TOTAL", d.get("totalElements"), "PAGES", d.get("totalPages"), "TOPKEYS", list(d.keys()))
    items = d.get("content") or []
    if items:
        print("ITEMKEYS", sorted(items[0].keys()))
        print("ITEM0", short(items[0], 3000))
        lid = items[0].get("id")
        for path in (f"/vendite/{lid}", f"/annunci/{lid}", f"/annuncio/{lid}", f"/dettaglio/{lid}", f"/vendita/{lid}", f"/lotti/{lid}"):
            for base in (VE, RIC):
                try:
                    rr = c.get(base + path)
                    print("DETAIL", base[-6:], path, rr.status_code, rr.text[:1500] if rr.status_code == 200 else "")
                except Exception as e:
                    print("DETAIL", path, "error", e)
        page = c.get(f"https://pvp.giustizia.it/pvp/it/detail_annuncio.page?idAnnuncio={lid}")
        html = page.text
        print("HTML", page.status_code, len(html))
        print("IMGS", re.findall(r'(?:src|href)=["\']([^"\']*(?:\.jpe?g|\.png|foto|immagin|allegato)[^"\']*)', html, re.I)[:15])
        print("APIHINTS", sorted(set(re.findall(r'(/(?:ve|ric|bo)-[0-9a-f]+-[0-9a-f]+/[a-z\-]+/[A-Za-z0-9_/\-{}]+)', html)))[:20])
