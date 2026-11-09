"""Immobiliare.it without paying anyone: read the search results the portal's own site loads.

Per run: a few regions (rotating daily), each split into price bands, newest ads first, a few pages each.
One request every 3 to 6 seconds, so a run is a few dozen requests, about the traffic of one person browsing.
First tries the JSON endpoint the site calls (api-next/search-list), then falls back to the data embedded in
the HTML search page (__NEXT_DATA__). Uses curl_cffi so the TLS handshake looks like Chrome; plain httpx is
blocked by the bot wall. Stops for the run at the first hard block (403/429/captcha) rather than pushing.

Every result is turned into the shape collectors/immobiliare.to_row already reads, so saving is shared.
"""
from __future__ import annotations

import json
import os
import random
import re
import time
from datetime import date

from ..supa import Supa

# Region in our data, immobiliare.it URL slug, fkRegione code used by its search API.
REGIONS = [
    ("Sicilia", "sicilia", "sic"), ("Puglia", "puglia", "pug"), ("Calabria", "calabria", "cal"), ("Sardegna", "sardegna", "sar"),
    ("Abruzzo", "abruzzo", "abr"), ("Molise", "molise", "mol"), ("Basilicata", "basilicata", "bas"), ("Campania", "campania", "cam"),
    ("Toscana", "toscana", "tos"), ("Umbria", "umbria", "umb"), ("Marche", "marche", "mar"), ("Lazio", "lazio", "laz"),
    ("Liguria", "liguria", "lig"), ("Piemonte", "piemonte", "pie"),
]
BASE = "https://www.immobiliare.it"
HEADERS = {"accept-language": "it-IT,it;q=0.9,en;q=0.8"}


class Blocked(Exception):
    pass


def _session():
    try:
        from curl_cffi import requests as cr
        return cr.Session(impersonate="chrome", timeout=30, headers=HEADERS)
    except ImportError:  # still works on a laptop without curl_cffi, just more likely to be blocked
        import httpx
        return httpx.Client(timeout=30, follow_redirects=True, headers={**HEADERS, "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"})


def _get(s, url: str, **kw):
    r = s.get(url, **kw)
    body = r.text if r.status_code == 200 else ""
    if r.status_code in (401, 403, 429) or "captcha-delivery" in body[:5000] or "datadome" in body[:3000].lower() and "__NEXT_DATA__" not in body:
        raise Blocked(f"{r.status_code} on {url}")
    return r


def _find_results(node) -> list[dict] | None:
    """The list of search results anywhere inside a JSON tree: dicts that carry a realEstate."""
    if isinstance(node, list):
        if node and all(isinstance(x, dict) for x in node) and any("realEstate" in x for x in node):
            return node
        for x in node:
            f = _find_results(x)
            if f:
                return f
    elif isinstance(node, dict):
        for v in node.values():
            f = _find_results(v)
            if f:
                return f
    return None


def _num(v):
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    t = re.sub(r"(?<=\d)\.(?=\d{3})", "", str(v)).replace(",", ".")
    m = re.search(r"\d+(?:\.\d+)?", t)
    return float(m.group(0)) if m else None


def adapt(res: dict) -> dict | None:
    """One search result into the Apify-like item that to_row() reads."""
    re_ = res.get("realEstate") or {}
    rid = re_.get("id")
    if not rid:
        return None
    props = (re_.get("properties") or [{}])[0] or {}
    loc = props.get("location") or {}
    price = re_.get("price") or {}
    photos = []
    for p in ((props.get("multimedia") or {}).get("photos") or []):
        u = (p.get("urls") or {})
        url = u.get("large") or u.get("medium") or u.get("small")
        if isinstance(url, str) and url.startswith("https://"):
            photos.append(url)
    plans = [((p.get("urls") or {}).get("large") or (p.get("urls") or {}).get("medium")) for p in ((props.get("multimedia") or {}).get("floorplans") or [])]
    agency = ((re_.get("advertiser") or {}).get("agency") or {})
    phones = [p.get("value") for p in (agency.get("phones") or []) if isinstance(p, dict) and p.get("value")]
    typology = ((props.get("typology") or re_.get("typology") or {}).get("name")) or props.get("typologyGA4Translation") or ""
    url = (res.get("seo") or {}).get("url") or f"{BASE}/annunci/{rid}/"
    if url.startswith("/"):
        url = BASE + url
    return {
        "id": rid,
        "title": re_.get("title") or "",
        "_enhanced": {
            "id": rid, "listingUrl": url,
            "priceAmount": price.get("value") if price.get("visible", True) else None,
            "surfaceSqm": _num(props.get("surface")),
            "photoUrlsHd": photos[:15], "floorplanUrlsHd": [u for u in plans if isinstance(u, str)][:3],
            "descriptionText": props.get("description") or props.get("caption") or "",
            "city": loc.get("city"), "province": loc.get("province"), "region": loc.get("region"),
            "latitude": loc.get("latitude"), "longitude": loc.get("longitude"), "address": loc.get("address"),
            "rooms": props.get("rooms"), "bathrooms": props.get("bathrooms"),
            "condition": props.get("condition") or props.get("ga4Condition"),
            "propertyType": typology, "isAuction": bool(re_.get("isAuction") or props.get("isAuction")),
            "energyClass": ((props.get("energy") or {}).get("class") or {}).get("name") if isinstance((props.get("energy") or {}).get("class"), dict) else (props.get("energy") or {}).get("class"),
            "contactPhones": phones,
        },
        "author": {"name": agency.get("displayName")},
    }


_api_ok = True


def search_page(s, slug: str, code: str, lo: int, hi: int, page: int) -> list[dict]:
    """One page of results, newest first. JSON endpoint first, HTML page as the fallback."""
    params = {"fkRegione": code, "idContratto": "1", "idCategoria": "1", "idNazione": "IT", "prezzoMassimo": str(hi),
              "criterio": "dataModifica", "ordine": "desc", "pag": str(page), "__lang": "it", "path": f"/vendita-case/{slug}/"}
    if lo:
        params["prezzoMinimo"] = str(lo)
    global _api_ok
    if _api_ok:
        try:
            r = _get(s, f"{BASE}/api-next/search-list/listings/", params=params, headers={"accept": "application/json", "referer": f"{BASE}/vendita-case/{slug}/"})
            if r.status_code == 200 and r.headers.get("content-type", "").startswith("application/json"):
                found = _find_results(r.json())
                if found is not None:
                    return found
        except Exception:  # noqa: BLE001  blocked or changed: use the HTML page for the rest of the run
            _api_ok = False
        time.sleep(random.uniform(2, 4))
    q = f"prezzoMassimo={hi}" + (f"&prezzoMinimo={lo}" if lo else "") + "&criterio=dataModifica&ordine=desc" + (f"&pag={page}" if page > 1 else "")
    r = _get(s, f"{BASE}/vendita-case/{slug}/?{q}", headers={"accept": "text/html"})
    m = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', r.text, re.S)
    if not m:
        return []
    return _find_results(json.loads(m.group(1))) or []


def pick(n: int, today: date | None = None):
    d = (today or date.today()).toordinal()
    start = (d * n) % len(REGIONS)
    return [REGIONS[(start + i) % len(REGIONS)] for i in range(n)]


def collect(db: Supa, regions: int | None = None, max_price: int | None = None, pages: int | None = None, log=print) -> dict:
    from .immobiliare import save, to_row
    regions = regions or int(os.environ.get("IMMOBILIARE_REGIONS") or 3)
    max_price = max_price or int(os.environ.get("IMMOBILIARE_MAX_PRICE") or 100000)
    pages = pages or int(os.environ.get("IMMOBILIARE_PAGES") or 4)
    bands = []
    for b in (os.environ.get("IMMOBILIARE_BANDS") or f"0-30000,30000-60000,60000-{max_price}").split(","):
        lo, _, hi = b.strip().partition("-")
        if hi.strip().isdigit():
            bands.append((int(lo or 0), int(hi)))
    s = _session()
    seen = saved = requests = 0
    blocked = None
    try:  # a first visit to the home page sets the cookies a real browser would have
        _get(s, BASE + "/")
        requests += 1
    except Blocked as e:
        return {"mode": "direct", "blocked": str(e), "saved": 0}
    except Exception as e:  # noqa: BLE001
        log(f"  home page: {e}")
    for region, slug, code in pick(min(regions, len(REGIONS))):
        for lo, hi in bands:
            for page in range(1, pages + 1):
                time.sleep(random.uniform(3, 6))
                try:
                    results = search_page(s, slug, code, lo, hi, page)
                    requests += 1
                except Blocked as e:
                    blocked = str(e)
                    break
                except Exception as e:  # noqa: BLE001
                    log(f"  {region} €{lo:,}-{hi:,} p{page}: error {e}")
                    break
                items = [a for a in (adapt(x) for x in results) if a]
                recs = [r for r in (to_row(it, region) for it in items) if r]
                seen += len(results)
                saved += save(db, recs) if recs else 0
                log(f"  {region} €{lo:,}-{hi:,} page {page}: {len(results)} ads, {len(recs)} saved")
                if len(results) < 20:  # last page
                    break
            if blocked:
                break
        if blocked:
            log(f"  blocked, stopping for today: {blocked}")
            break
    return {"mode": "direct", "requests": requests, "results": seen, "saved": saved, "blocked": blocked}


def probe(log=print) -> dict:
    """One page of one region, nothing saved. Shows whether the portal lets us in from this network."""
    s = _session()
    out: dict = {}
    try:
        r = _get(s, BASE + "/")
        out["home"] = r.status_code
        time.sleep(3)
        res = search_page(s, "sicilia", "sic", 0, 30000, 1)
        out["api"] = _api_ok
        out["results"] = len(res)
        a = adapt(res[0]) if res else None
        out["sample"] = {k: (a or {}).get("_enhanced", {}).get(k) for k in ("listingUrl", "priceAmount", "surfaceSqm", "city", "latitude")} if a else None
        out["photos"] = len((a or {}).get("_enhanced", {}).get("photoUrlsHd") or [])
    except Blocked as e:
        out["blocked"] = str(e)
    except Exception as e:  # noqa: BLE001
        out["error"] = repr(e)
    log(json.dumps(out, indent=2))
    return out
