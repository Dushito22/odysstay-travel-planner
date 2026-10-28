"""Default renovation estimates: three scenarios per listing from published per-m² price ranges.

Source: Cronoshare, "Quanto costa ristrutturare casa? Prezzi 2026" (3 Jan 2026): partial renovation
300-500 €/m², complete renovation 600-900 €/m², with most Italian cities between 300 and 650 €/m²
(Palermo 300-550, Bari 300-500, Catania 300-650). A light refresh (paint, floors laid over the old ones,
fittings, minor electrics) is costed from the same page's per-job prices, at 150-280 €/m².
These sit about 45% below premium-studio price lists, which matches what small-town builders charge
for the old houses Odysstay finds. VAT on home renovation in Italy is 10% (reduced rate).

These are ranges for orientation, not quotes. The user replaces them with real quotes in the deal room.
"""
from __future__ import annotations

from .supa import Supa

SOURCE = "Cronoshare, renovation prices per m² in Italy (2026)"
SOURCE_URL = "https://www.cronoshare.it/quanto-costa/ristrutturare-casa"
VAT = 0.10
SCENARIOS = {
    "light": (150, 280, "Light: paint, floors over the old ones, new fittings, some electrics"),
    "standard": (300, 500, "Partial: bathroom and kitchen, most systems, some windows"),
    "full": (600, 900, "Complete: floors, all systems, finishes and windows"),
}
STRUCTURAL_UPLIFT = 0.20
OLD_STOCK = {"rural_house", "building"}
ESTIMATE_TYPES = {"house", "apartment", "rural_house", "building", "mixed"}
# Above these, the figure is land or a whole estate, not floor area: no estimate rather than a silly one.
MAX_FLOOR = {"apartment": 400, "house": 1200, "rural_house": 1500, "building": 3000, "mixed": 3000}


def estimate(sqm: float, property_type: str | None) -> list[dict]:
    out = []
    for scenario, (lo, hi, label) in SCENARIOS.items():
        uplift = STRUCTURAL_UPLIFT if (scenario == "full" and property_type in OLD_STOCK) else 0.0
        lo_m2, hi_m2 = lo * (1 + uplift), hi * (1 + uplift)
        work_lo, work_hi = sqm * lo_m2, sqm * hi_m2
        items = [
            {"item_en": label, "qty": sqm, "unit": "m²", "low_eur": round(work_lo, -2), "high_eur": round(work_hi, -2),
             "price_list_ref": f"{lo_m2:,.0f}-{hi_m2:,.0f} €/m²"},
            {"item_en": "VAT at the 10% home-renovation rate", "qty": 1, "unit": "lump", "low_eur": round(work_lo * VAT, -2),
             "high_eur": round(work_hi * VAT, -2), "price_list_ref": "IVA agevolata 10%"},
        ]
        assumptions = [f"Based on {sqm:,.0f} m² as stated in the official record",
                       "Excludes design, permits, surveys and furniture",
                       "Prices vary by area: large northern cities run higher, small southern towns lower"]
        if uplift:
            assumptions.append("Rural or whole-building lots: +20% for structural work (roof, floors)")
        out.append({"scenario": scenario, "low_eur": round(work_lo * (1 + VAT), -2), "high_eur": round(work_hi * (1 + VAT), -2),
                    "items": items, "assumptions": assumptions, "price_list": SOURCE, "price_list_url": SOURCE_URL})
    return out


def run(db: Supa, log=print) -> int:
    rows = db.select("listings", {"select": "id,surface_sqm,property_type", "surface_sqm": "gt.15",
                                  "is_demo": "eq.false", "status": "not.in.(closed,withdrawn)"})
    rows = [r for r in rows if r.get("property_type") in ESTIMATE_TYPES
            and float(r["surface_sqm"]) <= MAX_FLOOR.get(r["property_type"], 3000)]
    have = {r["listing_id"] for r in db.select("cost_estimates", {"select": "listing_id", "user_id": "is.null"})}
    todo = [r for r in rows if r["id"] not in have]
    out = []
    for r in todo:
        for e in estimate(float(r["surface_sqm"]), r.get("property_type")):
            out.append({"listing_id": r["id"], "user_id": None, **e})
    for i in range(0, len(out), 500):
        db.insert("cost_estimates", out[i : i + 500], returning=False)
    log(f"Renovation estimates added for {len(todo)} listings")
    return len(todo)
