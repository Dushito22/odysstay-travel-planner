"""One-off probe of the Portale Vendite Pubbliche API."""
import collections
import urllib.parse

import httpx

RIC = "https://pvp.giustizia.it/ric-496b258c-986a1b71/ric-ms"
VE = "https://pvp.giustizia.it/ve-3f723b85-986a1b71/ve-ms"
BUCKET = "https://resource-pvp.giustizia.it"
H = {"User-Agent": "Mozilla/5.0 OdysstayBot", "Accept": "application/json"}


def run():
    c = httpx.Client(timeout=40, headers=H, follow_redirects=True)
    body = {"tipoLotto": "IMMOBILI", "nazione": "ITA", "filtroAnnunci": "1"}
    r = c.post(f"{RIC}/ricerca/vendite?page=0&size=100&sort=dataVendita,asc&sort=id,asc", json=body)
    d = r.json().get("body") or r.json()
    items = d.get("content") or []
    last = c.post(f"{RIC}/ricerca/vendite?page={d['totalPages']-1}&size=100&sort=dataVendita,asc&sort=id,asc", json=body).json()
    last = (last.get("body") or last).get("content") or []
    print("ACTIVE", d.get("totalElements"), "first dates", items[0]["dataVendita"], items[-1]["dataVendita"], "last page date", last[-1]["dataVendita"] if last else None)
    cats = collections.Counter(i.get("categoriaLotto") for i in items)
    print("CATS", dict(cats), "PRICES<=50k", sum(1 for i in items if (i.get("prezzoBaseAsta") or 0) <= 50000))
    types = collections.Counter()
    sample_links = {}
    estimate = 0
    for it in items[:25]:
        det = (c.get(f"{VE}/vendite/{it['id']}").json().get("body")) or {}
        if det.get("impoStima"):
            estimate += 1
        for a in det.get("allegati") or []:
            t = a.get("codiceTipoAllegato")
            types[t] += 1
            sample_links.setdefault(t, (a.get("linkAllegato"), a.get("nomeFile"), a.get("descrizione")))
        for b in det.get("beni") or []:
            for a in b.get("allegati") or []:
                t = "BENE:" + str(a.get("codiceTipoAllegato"))
                types[t] += 1
                sample_links.setdefault(t, (a.get("linkAllegato"), a.get("nomeFile"), a.get("descrizione")))
            if b.get("superficie"):
                types["superficie"] += 1
    print("ALLEGATI", dict(types), "with stima", estimate, "of 25")
    for t, (link, name, desc) in sample_links.items():
        print("LINK", t, link, "|", name, "|", desc)
    for t, (link, _, _) in list(sample_links.items())[:4]:
        if not link:
            continue
        for base in (BUCKET, "https://pvp.giustizia.it"):
            u = base + urllib.parse.quote(link)
            try:
                rr = c.get(u, headers={"Accept": "*/*"})
                print("FETCH", t, base, rr.status_code, rr.headers.get("content-type"), len(rr.content))
            except Exception as e:
                print("FETCH", t, base, "error", str(e)[:100])
