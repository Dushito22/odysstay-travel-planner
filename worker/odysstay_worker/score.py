"""Deal score, 0 to 100, with the reasons shown to the user. Uses verified listing columns only.

Four parts: location (closeness to famous towns, provincial towns, big cities and airports), the property
(condition, type, photos, size, vacancy), the price and deal (price, price per m², discount to the court's
appraisal, ownership), minus red flags.
"""
from __future__ import annotations

from datetime import date

from .places import AIRPORTS, BIG, CITIES, GEMS, nearest
from .supa import Supa

RESIDENTIAL = {"house", "apartment", "rural_house", "building", "mixed"}


FLAG_POINTS = {"high": 8, "medium": 4, "low": 1}


def _location(l: dict, reasons: list[str]) -> float:
    lat, lng = l.get("lat"), l.get("lng")
    if lat is None or lng is None:
        reasons.append("+0 exact location not known")
        return 12.0
    pts = 0.0
    gem, gd, why = nearest(lat, lng, GEMS)
    for limit, p in ((12, 12), (25, 9), (45, 6), (70, 3)):
        if gd <= limit:
            pts += p
            reasons.append(f"+{p} {gem} is {gd:.0f} km away ({_WHY.get(why, why)})")
            break
    city, cd, _ = nearest(lat, lng, CITIES)
    for limit, p in ((12, 8), (25, 6), (45, 3), (60, 1)):
        if cd <= limit:
            pts += p
            reasons.append(f"+{p} {city} (shops, hospital, station) is {cd:.0f} km away")
            break
    else:
        pts -= 4
        reasons.append(f"-4 remote: nearest provincial town is {cd:.0f} km away")
    big, bd, _ = nearest(lat, lng, [c for c in CITIES if c[0] in BIG])
    for limit, p in ((45, 5), (90, 3), (140, 1)):
        if bd <= limit:
            pts += p
            reasons.append(f"+{p} {big} within {bd:.0f} km for culture and work")
            break
    ap, ad, _ = nearest(lat, lng, AIRPORTS)
    for limit, p in ((45, 7), (90, 5), (150, 3), (220, 1)):
        if ad <= limit:
            pts += p
            reasons.append(f"+{p} {ap} airport {ad:.0f} km away")
            break
    return max(0.0, min(35.0, pts))


_WHY = {"lake": "lake", "mountains": "mountains", "coast": "sea", "history": "historic town", "wine": "wine country"}


def _property(l: dict, reasons: list[str]) -> float:
    pts = 0.0
    cond = l.get("condition")
    ptype = l.get("property_type")
    sqm = l.get("surface_sqm")
    if cond == "ready":
        pts += 8
        reasons.append("+8 ready to live in")
    elif cond == "needs_work":
        pts += 5
        reasons.append("+5 needs work, but not a ruin")
    elif cond == "ruin":
        pts += 1
        reasons.append("+1 ruin: a full rebuild")
    else:
        pts += 2
        reasons.append("+2 condition not stated")
    kind = {"house": 6, "rural_house": 6, "building": 5, "apartment": 4, "mixed": 4, "other": 1, "commercial": 1, "garage": 0, "land": 0}
    k = kind.get(ptype or "", 2)
    pts += k
    if k >= 4:
        reasons.append(f"+{k} {'a house' if k == 6 else 'a building you can live in'}")
    if l.get("photo_urls"):
        pts += 5
        reasons.append("+5 official photos published")
    if sqm and ptype != "land":
        for limit, p in ((120, 3), (70, 2), (40, 1)):
            if sqm >= limit:
                pts += p
                reasons.append(f"+{p} {sqm:,.0f} m² of space")
                break
    if l.get("occupancy") == "free":
        pts += 3
        reasons.append("+3 vacant")
    elif l.get("occupancy") == "occupied":
        pts -= 12
        reasons.append("-12 occupied")
    if l.get("previous_auction_failed"):
        pts += 3
        reasons.append("+3 unsold before: fewer rivals, motivated seller")
    return max(0.0, min(25.0, pts))


def _price(l: dict, reasons: list[str]) -> float:
    pts = 0.0
    price, sqm = l.get("price_eur"), l.get("surface_sqm")
    if price is not None:
        for limit, p in ((30000, 12), (60000, 10), (100000, 7), (200000, 3)):
            if price <= limit:
                pts += p
                reasons.append(f"+{p} price €{price:,.0f}")
                break
        else:
            reasons.append(f"+0 price €{price:,.0f}")
    else:
        pts -= 5
        reasons.append("-5 no price stated")
    if price and sqm and sqm > 10 and l.get("property_type") != "land":
        ppsqm = price / sqm
        for limit, p in ((300, 8), (600, 6), (1000, 3)):
            if ppsqm <= limit:
                pts += p
                reasons.append(f"+{p} €{ppsqm:,.0f}/m²")
                break
    lo, hi = l.get("omi_eur_m2_min"), l.get("omi_eur_m2_max")
    if price and sqm and sqm > 10 and lo and hi and l.get("property_type") in RESIDENTIAL:
        ppsqm, mid = price / sqm, (float(lo) + float(hi)) / 2
        gap = round(100 * (1 - ppsqm / mid))
        rng = f"official OMI range here €{float(lo):,.0f} to €{float(hi):,.0f}/m² (2018)"
        if gap >= 50:
            pts += 6
            reasons.append(f"+6 {gap}% under the {rng}")
        elif gap >= 30:
            pts += 4
            reasons.append(f"+4 {gap}% under the {rng}")
        elif gap >= 10:
            pts += 2
            reasons.append(f"+2 {gap}% under the {rng}")
        elif gap <= -40:
            pts -= 4
            reasons.append(f"-4 {-gap}% above the {rng}")
    disc = l.get("discount_pct")
    if disc is not None:
        for limit, p in ((60, 6), (45, 4), (30, 3), (15, 1)):
            if disc >= limit:
                pts += p
                reasons.append(f"+{p} minimum offer {disc:.0f}% below the court appraisal")
                break
    st = l.get("sale_type")
    if st in ("sale", "one_euro"):
        pts += 4
        reasons.append("+4 you own it outright")
    elif st == "auction_judicial":
        pts += 3
        reasons.append("+3 court sale: mortgages and liens are cancelled on transfer")
    elif st == "auction_notary":
        pts += 3
        reasons.append("+3 notary sale: the notary has checked the title and documents")
    elif st == "concession":
        pts -= 30
        reasons.append("-30 concession: use, not ownership")
    elif st == "lease":
        pts -= 40
        reasons.append("-40 lease only")
    return min(30.0, pts)


def _proof(l: dict) -> str:
    """How sure we are the price is low: "strong" (well under the official area value or a court appraisal),
    "some" (under it, or a very low price per m² for a real home), or "" (just a number)."""
    price, sqm = l.get("price_eur"), l.get("surface_sqm")
    lo, hi = l.get("omi_eur_m2_min"), l.get("omi_eur_m2_max")
    gap = None
    if price and sqm and sqm > 10 and lo and hi and l.get("property_type") in RESIDENTIAL:
        gap = 100 * (1 - (price / sqm) / ((float(lo) + float(hi)) / 2))
    disc = l.get("discount_pct")
    if gap is not None and gap > 85:
        return "suspect"  # a tenth of the area value: a share, a deposit, a rent or a typo, until a person checks
    if (gap is not None and gap >= 50) or (disc is not None and disc >= 50):
        return "strong"
    if (gap is not None and gap >= 35) or (disc is not None and disc >= 40):
        return "some"
    if price and sqm and sqm >= 60 and price / sqm <= 200 and l.get("property_type") in RESIDENTIAL:
        return "some"
    return ""


# A plot, a garage or a shop can be a good price but is never a good home, so it cannot outscore one.
CAPS = {"land": 48, "garage": 40, "commercial": 58, "other": 50}


def score_listing(l: dict, red_flags: int | dict[str, int], today: date | None = None) -> tuple[float, list[str], str]:
    """red_flags: count by severity, e.g. {"high": 1, "medium": 2}. A bare int counts as medium.
    Four parts: where it is (35), the property itself (25), the price and deal (30), minus red flags."""
    today = today or date.today()
    reasons: list[str] = []
    s = _location(l, reasons) + _property(l, reasons) + _price(l, reasons)
    disc = l.get("discount_pct")
    price, sqm = l.get("price_eur"), l.get("surface_sqm")
    sev = {"medium": red_flags} if isinstance(red_flags, int) else dict(red_flags)
    n_flags = sum(sev.values())
    if n_flags:
        pen = min(18, sum(FLAG_POINTS.get(k, 4) * v for k, v in sev.items()))
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
    # The parts add up to 90; straight onto 100, no stretch (a curve here once put a third of Italy at 70+).
    s = 100.0 * max(0.0, s) / 90.0
    if disc is not None:
        s += min(70.0, max(0.0, float(disc))) * 0.04
    if price and sqm and sqm > 10 and l.get("property_type") != "land":
        s += max(0.0, 2.0 - (price / sqm) / 500)
    # A high score has to be earned with proof that the price is low for what it is, not just a cheap number.
    proof = _proof(l)
    lim, why = {
        "strong": (97, ""),
        "some": (82, "a top score needs the price well under the area's official value or a court appraisal"),
        "suspect": (60, "the price is so far under the area value that it needs checking (a share, a deposit or a typo?)"),
    }.get(proof, (68, "70+ needs proof the price is low for the area"))
    if not sqm and l.get("property_type") != "land":
        lim, why = min(lim, 66), "size not stated, so the price can't be judged"
    if l.get("occupancy") == "occupied":
        lim, why = min(lim, 66), "occupied"
    if proof == "strong" and not l.get("photo_urls") and lim > 84:
        lim, why = 84, "no photos yet"
    if sev.get("high"):
        lim, why = min(lim, 70), "a serious red flag in the documents"
    if s > lim:
        reasons.append(f"held at {lim}: {why}")
        s = lim
    cap = CAPS.get(l.get("property_type") or "")
    if cap is None and l.get("condition") == "ruin":
        cap = 72
    if cap is not None and s > cap:
        reasons.append(f"held at {cap}: {'a plot' if l.get('property_type') == 'land' else 'not a home'} scores lower than a house" if l.get("property_type") in CAPS else f"held at {cap}: a ruin needs a full rebuild")
        s = cap
    if status in ("closed", "withdrawn"):
        s = 0.0
    return max(0.0, min(97.0, round(s))), reasons, status


def run(db: Supa, log=print) -> int:
    listings = db.select("listings", {"select": "id,price_eur,surface_sqm,property_type,sale_type,discount_pct,lat,lng,condition,"
                                      "previous_auction_failed,occupancy,deadline_at,auction_at,status,score,score_reasons,photo_urls,"
                                      "omi_eur_m2_min,omi_eur_m2_max",
                                      "is_demo": "eq.false", "status": "neq.withdrawn", "order": "id"})
    flags: dict[str, dict[str, int]] = {}
    for f in db.select("listing_red_flags", {"select": "listing_id,severity"}):
        d = flags.setdefault(f["listing_id"], {})
        d[f.get("severity") or "medium"] = d.get(f.get("severity") or "medium", 0) + 1
    changed: dict[str, dict] = {}  # keyed by id: a row can never be sent twice in one upsert
    for l in listings:
        s, reasons, status = score_listing(l, flags.get(l["id"], {}))
        if (l.get("score"), l.get("score_reasons"), l.get("status")) != (s, reasons, status):
            changed[l["id"]] = {"id": l["id"], "score": s, "score_reasons": reasons, "status": status}
    rows = list(changed.values())
    for i in range(0, len(rows), 500):  # one request per 500 rows instead of one per row
        db.upsert("listings", rows[i : i + 500], on_conflict="id")
    n = len(changed)
    log(f"Scored {len(listings)} listings ({n} changed)")
    return n


def preview(db: Supa, log=print) -> dict:
    """What the score would be, without writing: the spread, by source, and the top houses."""
    listings = db.select("listings", {"select": "id,comune,region,price_eur,surface_sqm,property_type,sale_type,discount_pct,lat,lng,condition,"
                                      "previous_auction_failed,occupancy,deadline_at,auction_at,status,score,photo_urls,omi_eur_m2_min,omi_eur_m2_max,duplicate_of,is_scrap",
                                      "is_demo": "eq.false", "status": "neq.withdrawn", "order": "id"})
    flags: dict[str, dict[str, int]] = {}
    for f in db.select("listing_red_flags", {"select": "listing_id,severity"}):
        d = flags.setdefault(f["listing_id"], {})
        d[f.get("severity") or "medium"] = d.get(f.get("severity") or "medium", 0) + 1
    new, old = [0] * 11, [0] * 11
    by_type: dict[str, list[int]] = {}
    top = []
    for l in listings:
        s, _, st = score_listing(l, flags.get(l["id"], {}))
        if st in ("closed", "withdrawn") or l.get("duplicate_of") or l.get("is_scrap"):
            continue
        new[int(s // 10)] += 1
        old[int((l.get("score") or 0) // 10)] += 1
        b = by_type.setdefault(l.get("sale_type") or "?", [0, 0, 0])
        b[0] += 1; b[1] += s >= 70; b[2] += s >= 85
        top.append((s, l))
    n = sum(new) or 1
    log("old: " + " ".join(f"{i*10}s:{v}" for i, v in enumerate(old) if v))
    log("new: " + " ".join(f"{i*10}s:{v}" for i, v in enumerate(new) if v))
    log(f"new 70+: {sum(new[7:])} ({100*sum(new[7:])/n:.1f}%), 85+: {sum(1 for s, _ in top if s >= 85)}")
    for k, (a, b, c) in sorted(by_type.items()):
        log(f"  {k:18} {a:6} open, {b:5} at 70+, {c:4} at 85+")
    top.sort(key=lambda x: -x[0])
    for s, l in top[:25]:
        log(f"  {s:3.0f} {l['comune']}, {l['region']} €{l.get('price_eur') or 0:,.0f} {l.get('surface_sqm') or '?'}m² {l.get('sale_type')} disc={l.get('discount_pct')} omi={l.get('omi_eur_m2_min')}-{l.get('omi_eur_m2_max')} photos={bool(l.get('photo_urls'))}")
    return {"open": n}
