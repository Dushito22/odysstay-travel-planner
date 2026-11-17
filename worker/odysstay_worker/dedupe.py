"""The same house often arrives more than once: an agency ad on Immobiliare, the court sale on the public portal,
the same lot again on a private auction site. Keep the richest copy, mark the others duplicate_of it, and lend the
keeper any photos it lacks. Re-run safely: every run recomputes the whole set.

Two listings are the same house when they are in the same town, the same kind of home, priced within 2%, and their
sizes agree within 6% (or one size is missing and they sit within 300 m of each other on the map).
"""
from __future__ import annotations

import math
import re
from collections import defaultdict

from .supa import Supa

# Who to trust when copies disagree: the court portal and notaries carry the legal facts, agencies the photos.
SOURCE_RANK = {"pvp": 6, "notary": 5, "one_euro": 4, "comune": 4, "gazzetta": 4, "immobiliare": 3, "aste": 2}
HOME = {"house": "home", "rural_house": "home", "apartment": "home", "building": "home", "mixed": "home"}


def _town(s: str | None) -> str:
    return re.sub(r"[^a-z]", "", (s or "").lower())


def _km(a: dict, b: dict) -> float | None:
    if a.get("lat") is None or b.get("lat") is None:
        return None
    dy = (a["lat"] - b["lat"]) * 111.0
    dx = (a["lng"] - b["lng"]) * 111.0 * math.cos(math.radians(a["lat"]))
    return math.hypot(dx, dy)


def same(a: dict, b: dict) -> bool:
    pa, pb = a.get("price_eur"), b.get("price_eur")
    if not pa or not pb or abs(pa - pb) > 0.02 * max(pa, pb):
        return False
    sa, sb = a.get("surface_sqm"), b.get("surface_sqm")
    if sa and sb:
        return abs(sa - sb) <= 0.06 * max(sa, sb)
    d = _km(a, b)
    return d is not None and d <= 0.3


def _richness(l: dict) -> tuple:
    src = ((l.get("document") or {}).get("source_id")) or ""
    filled = sum(1 for k in ("surface_sqm", "discount_pct", "condition", "occupancy", "lat") if l.get(k) is not None)
    return (SOURCE_RANK.get(src, 1), bool(l.get("photo_urls")), filled, l.get("created_at") or "")


def run(db: Supa, log=print) -> dict:
    rows = db.select("listings", {
        "select": "id,comune,property_type,price_eur,surface_sqm,lat,lng,photo_urls,hero_image_path,discount_pct,condition,occupancy,"
                  "created_at,duplicate_of,document:documents(source_id)",
        "is_demo": "eq.false", "status": "not.in.(closed,withdrawn)", "price_eur": "not.is.null"})
    groups: dict[tuple, list[dict]] = defaultdict(list)
    for r in rows:
        groups[(_town(r.get("comune")), HOME.get(r.get("property_type") or "", r.get("property_type")))].append(r)

    dup_of: dict[str, str] = {}
    lend: dict[str, dict] = {}
    for g in groups.values():
        if len(g) < 2:
            continue
        g.sort(key=lambda r: r["price_eur"])
        # Union the matches inside the group (sorted by price, so only near neighbours can match).
        parent = {r["id"]: r["id"] for r in g}

        def root(x: str) -> str:
            while parent[x] != x:
                parent[x] = parent[parent[x]]
                x = parent[x]
            return x

        for i, a in enumerate(g):
            for b in g[i + 1:]:
                if b["price_eur"] > a["price_eur"] * 1.02:
                    break
                if same(a, b):
                    parent[root(b["id"])] = root(a["id"])
        clusters: dict[str, list[dict]] = defaultdict(list)
        for r in g:
            clusters[root(r["id"])].append(r)
        for c in clusters.values():
            if len(c) < 2:
                continue
            keep = max(c, key=_richness)
            for r in c:
                if r["id"] != keep["id"]:
                    dup_of[r["id"]] = keep["id"]
            if not keep.get("photo_urls"):
                donor = next((r for r in c if r.get("photo_urls")), None)
                if donor:
                    lend[keep["id"]] = {"photo_urls": donor["photo_urls"], **({"hero_image_path": donor["hero_image_path"]} if donor.get("hero_image_path") and not keep.get("hero_image_path") else {})}

    changes: dict[str, dict] = {}
    for r in rows:
        want = dup_of.get(r["id"])
        if r.get("duplicate_of") != want:
            changes[r["id"]] = {"duplicate_of": want}
    for lid, patch in lend.items():
        changes.setdefault(lid, {}).update(patch)
    # Group identical patches so each request updates many rows at once.
    by_patch: dict[str, tuple[dict, list[str]]] = {}
    for lid, patch in changes.items():
        if set(patch) == {"duplicate_of"}:
            k = str(patch["duplicate_of"])
            by_patch.setdefault(k, (patch, []))[1].append(lid)
        else:
            db.update("listings", {"id": f"eq.{lid}"}, patch)
    for patch, ids in by_patch.values():
        for i in range(0, len(ids), 150):
            db.update("listings", {"id": f"in.({','.join(ids[i:i + 150])})"}, patch)
    out = {"checked": len(rows), "duplicates": len(dup_of), "changed": len(changes), "photos_lent": len(lend)}
    log(f"Dedupe: {out}")
    return out
