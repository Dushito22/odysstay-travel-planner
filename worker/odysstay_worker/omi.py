"""Official market values (OMI, Agenzia delle Entrate) for each listing's zone.

Data: the free copy of OMI 2018, second half, published by ondata on GitHub (values and zone maps), bundled
as static/omi_2018_2.json.gz. Each listing with coordinates is placed in its OMI zone by its map; without
coordinates, or outside every zone, the comune's central zone is used. The house type picks the value row:
apartments use "Abitazioni civili", houses "Ville e villini", rural houses the local or economic type.
Prices in euros per m² for the property in normal condition. Credit: Agenzia delle Entrate - OMI.
"""
from __future__ import annotations

import gzip
import json
import re
import unicodedata
from pathlib import Path

from .supa import Supa

DATA = Path(__file__).resolve().parent / "static" / "omi_2018_2.json.gz"
SEMESTER = "2018-2"
ORDER = {  # value rows to try, by our property type
    "apartment": ("civ", "eco", "villa", "tip"),
    "house": ("villa", "civ", "tip", "eco"),
    "rural_house": ("tip", "eco", "villa", "civ"),
}
DEFAULT = ("civ", "villa", "eco", "tip")


def _key(s: str | None) -> str:
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().upper()
    return re.sub(r"[^A-Z]", "", s)


def _inside(x: float, y: float, ring: list[float]) -> bool:
    inside = False
    n = len(ring) // 2
    j = n - 1
    for i in range(n):
        xi, yi, xj, yj = ring[2 * i], ring[2 * i + 1], ring[2 * j], ring[2 * j + 1]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


class Omi:
    def __init__(self, path: Path = DATA):
        d = json.load(gzip.open(path, "rt"))
        self.zones = d["zones"]
        self.grid: dict[tuple[int, int], list[dict]] = {}
        self.by_comune: dict[tuple[str, str], list[dict]] = {}
        self.by_name: dict[str, list[dict]] = {}
        for z in self.zones:
            self.by_comune.setdefault((_key(z["n"]), z["p"]), []).append(z)
            self.by_name.setdefault(_key(z["n"]), []).append(z)
            b = z.get("b")
            if not b:
                continue
            for gx in range(int(b[0] * 10), int(b[2] * 10) + 1):
                for gy in range(int(b[1] * 10), int(b[3] * 10) + 1):
                    self.grid.setdefault((gx, gy), []).append(z)

    def at(self, lat: float, lng: float) -> dict | None:
        for z in self.grid.get((int(lng * 10), int(lat * 10)), []):
            b = z["b"]
            if b[0] <= lng <= b[2] and b[1] <= lat <= b[3] and any(_inside(lng, lat, r) for r in z["g"]):
                return z
        return None

    def central(self, comune: str | None, prov: str | None) -> dict | None:
        zs = self.by_comune.get((_key(comune), prov or "")) or (self.by_name.get(_key(comune)) if len({z["p"] for z in self.by_name.get(_key(comune), [])}) == 1 else None)
        if not zs:
            return None
        rank = {"B": 0, "C": 1, "D": 2, "E": 3, "R": 4}
        return sorted(zs, key=lambda z: (rank.get(z["f"], 5), z["z"]))[0]

    def value(self, l: dict) -> dict | None:
        z, how = None, None
        if l.get("lat") is not None and l.get("lng") is not None:
            z, how = self.at(float(l["lat"]), float(l["lng"])), "map"
        if z is None:
            z, how = self.central(l.get("comune"), l.get("province")), "comune"
        if z is None:
            return None
        for t in ORDER.get(l.get("property_type") or "", DEFAULT):
            v = z["v"].get(t)
            if v and v[0] and v[1]:
                return {"omi_zone": f"{z['n'].title()} {z['z']}", "omi_zone_descr": z["d"].title()[:120] or None, "omi_type": t,
                        "omi_eur_m2_min": v[0], "omi_eur_m2_max": v[1], "omi_rent_m2_min": v[2], "omi_rent_m2_max": v[3],
                        "omi_semester": SEMESTER, "omi_match": how}
        return None


def run(db: Supa, log=print) -> int:
    omi = Omi()
    cols = "id,lat,lng,comune,province,property_type,omi_zone,omi_eur_m2_min,omi_eur_m2_max,omi_type,omi_match"
    listings = db.select("listings", {"select": cols, "is_demo": "eq.false", "order": "id"})
    rows, matched = [], 0
    for l in listings:
        v = omi.value(l)
        if v:
            matched += 1
            if (l.get("omi_zone"), l.get("omi_eur_m2_min"), l.get("omi_eur_m2_max"), l.get("omi_type"), l.get("omi_match")) != \
               (v["omi_zone"], v["omi_eur_m2_min"], v["omi_eur_m2_max"], v["omi_type"], v["omi_match"]):
                rows.append({"id": l["id"], **v})
    for i in range(0, len(rows), 500):
        db.upsert("listings", rows[i:i + 500], on_conflict="id")
    log(f"OMI: {matched} of {len(listings)} listings matched to a zone, {len(rows)} updated")
    return len(rows)
