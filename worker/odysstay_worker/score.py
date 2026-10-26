"""Deal score, 0 to 100, with the reasons shown to the user. Uses verified listing columns only.

v1 ranks on absolute price, price per m², ownership vs concession, vacancy, previous failed auctions
and red flags. Next: local price benchmarks (Agenzia delle Entrate OMI zones) so "cheap for the area"
beats "cheap".
"""
from __future__ import annotations

from datetime import date

from .supa import Supa, eq

RESIDENTIAL = {"house", "apartment", "rural_house", "building", "mixed"}


def score_listing(l: dict, red_flags: int, today: date | None = None) -> tuple[float, list[str], str]:
    today = today or date.today()
    reasons: list[str] = []
    s = 30.0
    price, sqm = l.get("price_eur"), l.get("surface_sqm")

    if price is not None:
        for limit, pts in ((20000, 30), (50000, 24), (100000, 15), (200000, 6)):
            if price <= limit:
                s += pts
                reasons.append(f"+{pts} base price €{price:,.0f}")
                break
        else:
            s -= 10
            reasons.append(f"-10 base price €{price:,.0f}")
    else:
        s -= 10
        reasons.append("-10 no price stated")

    if price and sqm and sqm > 10 and l.get("property_type") != "land":
        ppsqm = price / sqm
        for limit, pts in ((300, 18), (600, 12), (1000, 5)):
            if ppsqm <= limit:
                s += pts
                reasons.append(f"+{pts} €{ppsqm:,.0f}/m²")
                break

    st = l.get("sale_type")
    if st in ("sale", "one_euro"):
        s += 8
        reasons.append("+8 you own it outright")
    elif st == "concession":
        s -= 30
        reasons.append("-30 concession: use, not ownership")
    elif st == "lease":
        s -= 40
        reasons.append("-40 lease only")

    if l.get("property_type") in RESIDENTIAL:
        s += 5
        reasons.append("+5 a building you can live in or restore")
    if l.get("previous_auction_failed"):
        s += 10
        reasons.append("+10 unsold before: fewer rivals, motivated seller")
    if l.get("occupancy") == "free":
        s += 5
        reasons.append("+5 vacant")
    elif l.get("occupancy") == "occupied":
        s -= 15
        reasons.append("-15 occupied")
    if red_flags:
        pen = min(20, 5 * red_flags)
        s -= pen
        reasons.append(f"-{pen} {red_flags} red flag{'s' if red_flags > 1 else ''}")

    status = "active"
    if l.get("deadline_at"):
        days = (date.fromisoformat(l["deadline_at"]) - today).days
        if days < 0:
            status = "closed"
        elif days <= 14:
            status = "closing_soon"
    if status == "closed":
        s = 0.0
    return max(0.0, min(100.0, round(s))), reasons, status


def run(db: Supa, log=print) -> int:
    listings = db.select("listings", {"select": "*", "is_demo": "eq.false", "status": "neq.withdrawn"})
    flags: dict[str, int] = {}
    for f in db.select("listing_red_flags", {"select": "listing_id"}):
        flags[f["listing_id"]] = flags.get(f["listing_id"], 0) + 1
    n = 0
    for l in listings:
        s, reasons, status = score_listing(l, flags.get(l["id"], 0))
        if (l.get("score"), l.get("score_reasons"), l.get("status")) != (s, reasons, status):
            db.update("listings", {"id": eq(l["id"])}, {"score": s, "score_reasons": reasons, "status": status})
            n += 1
    log(f"Scored {len(listings)} listings ({n} changed)")
    return n
