"""Puts listings on the map at the centre of their comune, using OpenStreetMap's Nominatim.

Nominatim's policy: at most 1 request per second, a real User-Agent, and cache results. We geocode
comuni (not exact addresses), cache them in data/geocache.json, and only for listings missing coordinates.
"""
from __future__ import annotations

import json
import time

import httpx

from . import config
from .supa import Supa, eq

CACHE = config.DATA_DIR / "geocache.json"
URL = "https://nominatim.openstreetmap.org/search"


def _load() -> dict:
    try:
        return json.loads(CACHE.read_text())
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def lookup(comune: str, province: str | None, cache: dict, client: httpx.Client) -> tuple[float, float] | None:
    key = f"{comune}|{province or ''}".lower()
    if key in cache:
        return tuple(cache[key]) if cache[key] else None
    params = {"format": "jsonv2", "limit": "1", "countrycodes": "it", "city": comune}
    if province:
        params["county"] = province
    time.sleep(1.1)
    r = client.get(URL, params=params)
    hit = r.json() if r.status_code == 200 else []
    if not hit and province:  # province codes don't always match OSM county names
        time.sleep(1.1)
        r = client.get(URL, params={"format": "jsonv2", "limit": "1", "countrycodes": "it", "q": f"{comune}, Italia"})
        hit = r.json() if r.status_code == 200 else []
    cache[key] = [float(hit[0]["lat"]), float(hit[0]["lon"])] if hit else None
    CACHE.write_text(json.dumps(cache))
    return tuple(cache[key]) if cache[key] else None


def run(db: Supa, log=print) -> int:
    rows = db.select("listings", {"select": "id,comune,province", "lat": "is.null", "comune": "not.is.null", "is_demo": "eq.false"})
    if not rows:
        log("All listings have coordinates")
        return 0
    cache = _load()
    n = 0
    with httpx.Client(headers={"User-Agent": config.USER_AGENT}, timeout=20) as client:
        for l in rows:
            try:
                pt = lookup(l["comune"], l.get("province"), cache, client)
            except httpx.HTTPError as e:
                log(f"  {l['comune']}: {e}")
                continue
            if pt:
                db.update("listings", {"id": eq(l["id"])}, {"lat": pt[0], "lng": pt[1]})
                n += 1
    log(f"Placed {n} of {len(rows)} listings on the map")
    return n
