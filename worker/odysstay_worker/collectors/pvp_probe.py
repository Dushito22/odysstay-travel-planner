"""One-off probe of the Portale Vendite Pubbliche API. Prints field names and samples."""
import json

import httpx

RIC = "https://pvp.giustizia.it/ric-496b258c-986a1b71/ric-ms"
VE = "https://pvp.giustizia.it/ve-3f723b85-986a1b71/ve-ms"
H = {"User-Agent": "Mozilla/5.0 OdysstayBot", "Accept": "application/json"}


def paths(o, pre=""):
    out = []
    if isinstance(o, dict):
        for k, v in o.items():
            out += paths(v, f"{pre}.{k}")
    elif isinstance(o, list):
        out.append(f"{pre}[{len(o)}]")
        if o:
            out += paths(o[0], pre + "[0]")
    else:
        out.append(f"{pre}={str(o)[:40]}")
    return out


def run():
    c = httpx.Client(timeout=40, headers=H, follow_redirects=True)
    body = {"tipoLotto": "IMMOBILI", "nazione": "ITA"}
    r = c.post(f"{RIC}/ricerca/vendite?page=0&size=50&sort=dataPubblicazione,desc&sort=id,asc", json=body)
    d = r.json().get("body") or r.json()
    items = d.get("content") or []
    with_img = [i for i in items if i.get("immagine") or i.get("immagineCover")]
    print("RECENT", len(items), "with image", len(with_img), "TOTAL", d.get("totalElements"))
    it = (with_img or items)[0]
    print("IMGFIELDS", it.get("immagine"), "|", it.get("immagineCover"), "| esiti", sorted({str(i.get("esito")) for i in items}))
    det = c.get(f"{VE}/vendite/{it['id']}").json().get("body") or {}
    p = paths(det)
    line = ""
    for x in p:
        if len(line) + len(x) > 3300:
            print("PATHS", line)
            line = ""
        line += x + " | "
    print("PATHS", line)
    print("BENE", json.dumps(((det.get("lotto") or {}).get("beni") or [None])[0], ensure_ascii=False)[:3300])
    # Search body filters that might work
    for extra in ({"prezzoBaseAstaMax": 30000}, {"dataVenditaDa": "2026-10-27"}, {"filtroAnnunci": "1"}):
        rr = c.post(f"{RIC}/ricerca/vendite?page=0&size=1", json={**body, **extra})
        dd = rr.json().get("body") or rr.json()
        print("FILTER", extra, rr.status_code, dd.get("totalElements"))
