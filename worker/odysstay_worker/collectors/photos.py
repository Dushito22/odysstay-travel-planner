"""More photos for court sales that published none on the ministry portal.

Astalegale.net republishes court-sale lots and states the original PVP announcement id
(externalDetailUrl ...idAnnuncio=N), so a photo there belongs to exactly that lot. We only store the
photo URL on listings that have no photos yet, and only on an exact id match.
"""
from __future__ import annotations

import re
import time
from concurrent.futures import ThreadPoolExecutor

import httpx

from ..supa import Supa, in_

API = "https://api.astalegale.net/Search"
SITE = "https://www.astalegale.net"
HEADERS = {
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36",
    "Origin": SITE,
    "Referer": f"{SITE}/Immobili",
}
ID_RE = re.compile(r"idAnnuncio=(\d+)")


def page(client: httpx.Client, n: int) -> tuple[list[dict], int]:
    for attempt in range(4):
        try:
            r = client.post(API, json={"Type": "Immobili", "Page": n, "PageSize": 12, "SortBy": "DataAstaAsc"}, headers=HEADERS)
            r.raise_for_status()
            res = r.json().get("results") or {}
            return res.get("currentPage") or [], int(res.get("totalResults") or 0)
        except (httpx.HTTPError, ValueError):
            time.sleep(2 * (attempt + 1))
    return [], 0


def photo_of(item: dict) -> str | None:
    raw = item.get("urlImmaginePrincipale") or item.get("urlPhoto") or item.get("urlFoto") or item.get("urlImmagine")
    if not raw or "placeholder" in raw.lower() or "noimage" in raw.lower():
        return None
    return raw if raw.startswith("http") else SITE + raw


def collect(db: Supa, max_pages: int = 0, log=print) -> dict:
    found: dict[str, str] = {}
    with httpx.Client(timeout=40) as client:
        first, total = page(client, 1)
        if not first:
            r = client.post(API, json={"Type": "Immobili", "Page": 1, "PageSize": 12, "SortBy": "DataAstaAsc"}, headers=HEADERS)
            log(f"Astalegale answered {r.status_code}: {r.text[:400]!r}")
        size = len(first) or 12
        pages = -(-total // size) if total else 1
        if max_pages:
            pages = min(pages, max_pages)
        log(f"Astalegale: {total} lots, reading {pages} pages")
        items = list(first)
        with ThreadPoolExecutor(max_workers=8) as ex:
            for got, _ in ex.map(lambda n: page(client, n), range(2, pages + 1)):
                items.extend(got)
    pvp_items = 0
    for it in items:
        m = ID_RE.search(it.get("externalDetailUrl") or "")
        if not m:
            continue
        pvp_items += 1
        url = photo_of(it)
        if url:
            found[f"pvp:{m.group(1)}"] = url
    log(f"  {len(items)} lots read, {pvp_items} linked to a PVP announcement, {len(found)} with a photo")

    ids = list(found)
    rows: list[dict] = []
    for i in range(0, len(ids), 150):
        rows += db.select("listings", {"select": "id,external_id,photo_urls", "external_id": in_(ids[i:i + 150])})
    updates = [{"id": r["id"], "photo_urls": [found[r["external_id"]]], "hero_image_path": found[r["external_id"]]}
               for r in rows if not r.get("photo_urls")]
    for u in updates:
        db.update("listings", {"id": f"eq.{u['id']}"}, {"photo_urls": u["photo_urls"], "hero_image_path": u["hero_image_path"]})
    log(f"  photos added to {len(updates)} listings that had none ({len(rows)} matched)")
    return {"lots": len(items), "linked": pvp_items, "with_photo": len(found), "matched": len(rows), "added": len(updates)}
