"""Deal score, 0 to 100, with the reasons shown to the user. Uses verified listing columns only.

Ranks on absolute price, price per m², how far below the court's own appraisal you can buy,
ownership vs concession, vacancy, previous failed auctions and red flags.
"""
from __future__ import annotations

from datetime import date

from .supa import Supa

RESIDENTIAL = {"house", "apartment", "rural_house", "building", "mixed"}


FLAG_POINTS = {"high": 8, "medium": 4, "low": 1}


def score_listing(l: dict, red_flags: int | dict[str, int], today: date | None = None) -> tuple[float, list[str], str]:
    """red_flags: count by severity, e.g. {"high": 1, "medium": 2}. A bare int counts as medium."""
    today = today or date.today()
    reasons: list[str] = []
    s = 15.0  # calibrated on ~16,000 court sales: roughly the top 10% score 70 or more
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

    disc = l.get("discount_pct")
    if disc is not None:
        for limit, pts in ((60, 22), (45, 15), (30, 9), (15, 4)):
            if disc >= limit:
                s += pts
                reasons.append(f"+{pts} minimum offer {disc:.0f}% below the court appraisal")
                break

    st = l.get("sale_type")
    if st in ("sale", "one_euro"):
        s += 8
        reasons.append("+8 you own it outright")
    elif st == "auction_judicial":
        s += 6
        reasons.append("+6 court sale: mortgages and liens are cancelled on transfer")
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
    if l.get("photo_urls"):
        s += 6
        reasons.append("+6 official photos published")
    sev = {"medium": red_flags} if isinstance(red_flags, int) else dict(red_flags)
    n_flags = sum(sev.values())
    if n_flags:
        pen = min(24, sum(FLAG_POINTS.get(k, 4) * v for k, v in sev.items()))
        detail = ", ".join(f"{sev[k]} {k}" for k in ("high", "medium", "low") if sev.get(k))
        s -= pen
        reasons.append(f"-{pen} {n_flags} red flag{'s' if n_flags > 1 else ''} ({detail})")

    status = "active"
    end = l.get("deadline_at") or l.get("auction_at")
    if end:
        days = (date.fromisoformat(end) - today).days
        if days < 0:
            status = "closed"
        elif days <= 14:
            status = "closing_soon"
    if l.get("status") == "withdrawn":
        status = "withdrawn"
    if status in ("closed", "withdrawn"):
        s = 0.0
    return max(0.0, min(100.0, round(s))), reasons, status


def run(db: Supa, log=print) -> int:
    listings = db.select("listings", {"select": "id,price_eur,surface_sqm,property_type,sale_type,discount_pct,"
                                      "previous_auction_failed,occupancy,deadline_at,auction_at,status,score,score_reasons,photo_urls",
                                      "is_demo": "eq.false", "status": "neq.withdrawn"})
    flags: dict[str, dict[str, int]] = {}
    for f in db.select("listing_red_flags", {"select": "listing_id,severity"}):
        d = flags.setdefault(f["listing_id"], {})
        d[f.get("severity") or "medium"] = d.get(f.get("severity") or "medium", 0) + 1
    changed = []
    for l in listings:
        s, reasons, status = score_listing(l, flags.get(l["id"], {}))
        if (l.get("score"), l.get("score_reasons"), l.get("status")) != (s, reasons, status):
            changed.append({"id": l["id"], "score": s, "score_reasons": reasons, "status": status})
    for i in range(0, len(changed), 500):  # one request per 500 rows instead of one per row
        db.upsert("listings", changed[i : i + 500], on_conflict="id")
    n = len(changed)
    log(f"Scored {len(listings)} listings ({n} changed)")
    return n
