"""Default renovation estimates: three scenarios per listing from published per-m² price ranges.

Source: Studio Madera, "Costi ristrutturazione casa al metro quadro 2026" (prices excluding VAT):
light 350-500 €/m², medium 600-900 €/m², full (floors, roof, all systems, finishes, windows)
1,200-1,500 €/m², and at least 30% more when most of the structure is involved.
VAT on home renovation in Italy is 10% (reduced rate).

These are ranges for orientation, not quotes. The user replaces them with real quotes in the deal room.
"""
from __future__ import annotations

from .supa import Supa

SOURCE = "Studio Madera, renovation costs per m² (2026)"
SOURCE_URL = "https://studiomadera.it/news/73-costo-ristrutturazione-prezzo"
VAT = 0.10
SCENARIOS = {
    "light": (350, 500, "Light: new finishes, some systems redone, non-structural walls moved"),
    "standard": (600, 900, "Medium: most systems and finishes, bathroom and kitchen, some windows"),
    "full": (1200, 1500, "Full: floors and roof, all systems, finishes and windows"),
}
STRUCTURAL_UPLIFT = 0.30
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
            assumptions.append("Rural or whole-building lots: +30% for structural work (roof, floors)")
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
