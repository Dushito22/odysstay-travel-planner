"""Immobiliare.it listings with real photos.

Two ways in. Free by default: read the portal's own search pages directly (the JSON its site loads, or the
data embedded in the HTML), slowly, a few pages per run, with a browser-like TLS fingerprint (curl_cffi).
If APIFY_TOKEN is set, the old paid route through Apify (memo23/immobiliare-scraper) is used instead.
Private demo source. Immobiliare.it has no public listings API
and its terms forbid scraping; the owner chose this for his own testing. Every listing links back to the
original ad. On Apify's free plan a run returns at most 100 results and the free monthly credit covers
roughly 7,000 results, so each run takes the newest ads under a price cap in a few regions, rotating daily.
Regions, price cap and results per region can be raised (IMMOBILIARE_REGIONS, IMMOBILIARE_MAX_PRICE, IMMOBILIARE_PER_REGION)
when there is credit to spend; about $0.70 per 1,000 results.
"""
from __future__ import annotations

import os
import re
import time
from datetime import date

import httpx

from ..italy import province_code, region_for
from ..supa import Supa, in_

ACTOR = "memo23~immobiliare-scraper"
API = "https://api.apify.com/v2"
REGIONS = [  # (region name in our data, immobiliare.it slug)
    ("Sicilia", "sicilia"), ("Puglia", "puglia"), ("Calabria", "calabria"), ("Sardegna", "sardegna"),
    ("Abruzzo", "abruzzo"), ("Molise", "molise"), ("Basilicata", "basilicata"), ("Campania", "campania"),
    ("Toscana", "toscana"), ("Umbria", "umbria"), ("Marche", "marche"), ("Lazio", "lazio"),
    ("Liguria", "liguria"), ("Piemonte", "piemonte"),
]
TYPE_RULES = [
    ("rural_house", re.compile(r"rustic|casale|colonic|masseria|trull|cascina|baita|podere|rural|casolare", re.I)),
    ("apartment", re.compile(r"appartament|attico|mansard|bilocal|trilocal|monolocal|quadrilocal|loft", re.I)),
    ("land", re.compile(r"terren", re.I)),
    ("house", re.compile(r"villa|villett|casa indipendente|terratetto|casa semi|bifamiliare|schiera|casa\b|palazz|stabile", re.I)),
]


# What the ad's "Caratteristiche" table says, in English. Labels we already hold elsewhere (price, surface) are skipped.
LABELS = {
    "Tipologia": ("ownership", "Type and ownership"), "Stato": ("condition", "Condition"),
    "Disponibilità": ("availability", "Availability"), "Piano": ("floor", "Floor"), "Locali": ("rooms", "Rooms"),
    "Camere da letto": ("bedrooms", "Bedrooms"), "Cucina": ("kitchen", "Kitchen"), "Bagni": ("bathrooms", "Bathrooms"),
    "Balcone": ("balcony", "Balcony"), "Terrazzo": ("terrace", "Terrace"), "Giardino": ("garden", "Garden"),
    "Cantina": ("cellar", "Cellar"), "Anno di costruzione": ("year_built", "Year built"),
    "Piani edificio": ("building_floors", "Floors in the building"), "Ascensore": ("lift", "Lift"),
    "Accesso disabili": ("step_free", "Step-free access"), "Riscaldamento": ("heating", "Heating"),
    "Climatizzazione": ("air_conditioning", "Air conditioning"), "Posti auto": ("parking", "Parking"),
    "Arredato": ("furnished", "Furnished"), "Spese condominio": ("condo_fees", "Building fees"),
}
WORDS = [  # longest first; applied to values
    ("Ottimo / Ristrutturato", "Excellent, renovated"), ("Buono / Abitabile", "Good, ready to live in"),
    ("Nuovo / In costruzione", "New or being built"), ("Da ristrutturare", "Needs renovation"),
    ("libero al rogito", "vacant at completion"), ("Intera proprietà", "full ownership"), ("Nuda proprietà", "bare ownership (someone else keeps the right to live there)"),
    ("Cucina abitabile", "eat-in kitchen"), ("Cucina angolo cottura", "kitchenette"), ("Cucina a vista", "open kitchen"),
    ("Cucina semi abitabile", "semi eat-in kitchen"), ("Cucinotto", "small kitchen"),
    ("Nessun giardino", "no garden"), ("Giardino privato", "private garden"), ("Giardino comune", "shared garden"),
    ("nessuna spesa condominiale", "none"), ("Piano terra", "ground floor"), ("Piano rialzato", "raised ground floor"),
    ("alimentato a metano", "methane gas"), ("alimentato a gasolio", "diesel"), ("alimentato a GPL", "LPG"),
    ("alimentato a legna", "wood"), ("alimentato a pellet", "pellets"), ("alimentazione elettrica", "electric"),
    ("alimentato a pompa di calore", "heat pump"), ("a radiatori", "radiators"), ("a pavimento", "underfloor"),
    ("a stufa", "stove"), ("Autonomo", "Independent"), ("Centralizzato", "Central"), ("Assente", "None"),
    ("Terratetto plurifamiliare", "Terraced house"), ("Terratetto unifamiliare", "Detached terraced house"),
    ("Casa indipendente", "Detached house"), ("Appartamento", "Apartment"), ("Villa unifamiliare", "Detached villa"),
    ("Rustico", "Rustic house"), ("Casale", "Farmhouse"), ("Classe immobile economica", "basic building"),
    ("Classe immobile media", "standard building"), ("Classe immobile signorile", "upmarket building"),
    ("libero", "vacant"), ("occupato", "occupied"), ("piani", "floors"), ("Sì", "Yes"), ("da ", "from "), (" a ", " to "),
    ("Arredato", "Furnished"), ("Non arredato", "Unfurnished"), ("Parzialmente Arredato", "Partly furnished"),
    ("in box privato", "private garage"), ("in parcheggio/garage comune", "shared car park"),
]
AMENITIES = {
    "balcone": "balcony", "cantina": "cellar", "mansarda": "attic", "porta blindata": "security door",
    "infissi esterni in doppio vetro / legno": "double-glazed wooden windows", "infissi esterni in doppio vetro / pvc": "double-glazed PVC windows",
    "infissi esterni in doppio vetro / metallo": "double-glazed metal windows", "infissi esterni in vetro / legno": "wooden windows",
    "infissi esterni in vetro / metallo": "metal-framed windows", "infissi esterni in triplo vetro / pvc": "triple-glazed windows",
    "esposizione esterna": "faces outward", "esposizione doppia": "dual aspect", "esposizione interna": "faces the courtyard",
    "impianto tv centralizzato": "shared TV aerial", "impianto tv singolo": "own TV aerial", "giardino comune": "shared garden",
    "giardino privato": "private garden", "caminetto": "fireplace", "piscina": "pool", "terrazza": "terrace", "taverna": "basement den",
    "arredato": "furnished", "parzialmente arredato": "partly furnished", "cancello elettrico": "electric gate",
    "videocitofono": "video entry phone", "impianto di allarme": "alarm", "fibra ottica": "fibre broadband",
    "portiere intera giornata": "full-day concierge", "portiere mezza giornata": "part-day concierge", "idromassaggio": "hot tub",
    "armadio a muro": "built-in wardrobe", "campo da tennis": "tennis court", "cablato": "wired for data", "impianto tv con parabola satellitare": "satellite dish",
    "box privato": "private garage", "posto auto": "parking space",
}
STATUS = {"Ottimo / Ristrutturato": "ready", "Buono / Abitabile": "ready", "Nuovo / In costruzione": "ready", "Da ristrutturare": "needs_work"}
RUIN = re.compile(r"rudere|ruderi|diroccat|crollat|collabent|inagibil|da demolire|al grezzo", re.I)
AUCTION = re.compile(r"\basta\b|\baste\b|tribunale|\bR\.?G\.?E\b|\bPVP\b|vendita giudiziaria|esecuzione immobiliare", re.I)
INDICATIVE = re.compile(r"immagini[^.]{0,80}(indicativ|non rappresent)|foto[^.]{0,60}(indicativ|non rappresent)|a scopo illustrativ", re.I)


def english(v: str) -> str:
    out = v
    for it, en in WORDS:
        out = out.replace(it, en)
    return out.replace(" | ", ", ")


def feature_facts(it: dict) -> list[dict]:
    facts = []
    for group in it.get("mainData") or []:
        for row in group.get("rows") or []:
            lab, val = row.get("label"), str(row.get("value") or "").strip()
            if lab not in LABELS or not val:
                continue
            key, label_en = LABELS[lab]
            num = float(val) if re.fullmatch(r"\d+", val) else None
            facts.append({"key": key, "label_en": label_en, "value_text": english(val), "value_num": num,
                          "quote": f"{lab}: {val}", "quote_en": f"{label_en}: {english(val)}", "verified": True})
    e = it.get("_enhanced") or {}
    if e.get("energyClass"):
        facts.append({"key": "energy_class", "label_en": "Energy class", "value_text": f"{e['energyClass']}" + (f" ({str(e['energyConsumption']).replace(' anno', ' a year')})" if e.get("energyConsumption") else ""),
                      "value_num": None, "quote": f"Classe energetica: {e['energyClass']}", "quote_en": f"Energy class {e['energyClass']} (A4 best, G worst)", "verified": True})
    tags = [t for t in (e.get("amenities") or []) if isinstance(t, str)]
    if tags:
        en = ", ".join(AMENITIES.get(t.lower().strip(), t) for t in tags)
        facts.append({"key": "features", "label_en": "Features", "value_text": en[:1].upper() + en[1:], "value_num": None,
                      "quote": ", ".join(tags), "quote_en": en, "verified": True})
    return facts


def flags_for(desc: str, e: dict) -> list[dict]:
    out = []
    m = AUCTION.search(desc)
    if e.get("isAuction") or m:
        q = desc[max(0, (m.start() if m else 0) - 60):(m.end() if m else 0) + 140].strip()
        out.append({"severity": "high", "origin": "listing", "quote": q or "Asta", "quote_en": None,
                    "flag_en": "This is a court auction advertised by a private consultant, not a normal sale. The price is the auction base, the consultant charges a fee, and other people can bid. Argos can find the official court listing for you."})
    m = INDICATIVE.search(desc)
    if m:
        out.append({"severity": "medium", "origin": "listing", "quote": desc[max(0, m.start() - 20):m.end() + 80].strip(), "quote_en": None,
                    "flag_en": "The advertiser says the photos are only indicative and may not show this property."})
    if e.get("isNudaProprieta"):
        out.append({"severity": "high", "origin": "listing", "quote": "Nuda proprietà", "quote_en": None,
                    "flag_en": "Bare ownership only: someone else keeps the right to live there, usually for life."})
    return out


def summary(kind: str, typology: str, sqm, e: dict, cond: str | None, city: str | None) -> str:
    bits = [f"{english(typology) if typology else kind.replace('_', ' ').capitalize()}"]
    if sqm:
        bits[0] += f" of {sqm:.0f} m²"
    if city:
        bits[0] += f" in {city}"
    extra = []
    if e.get("rooms"):
        extra.append(f"{e['rooms']} rooms")
    if e.get("bathrooms"):
        extra.append(f"{e['bathrooms']} {'bathroom' if str(e['bathrooms']) == '1' else 'bathrooms'}")
    if e.get("yearBuilt"):
        extra.append(f"built in {e['yearBuilt']}")
    s = bits[0] + (", " + ", ".join(extra) if extra else "") + "."
    if e.get("condition"):
        s += f" Described as {english(e['condition']).lower()}."
    if (e.get("gardenType") or "").lower().startswith("giardino privato"):
        s += " Private garden."
    return s


def pick_regions(n: int = 2, today: date | None = None) -> list[tuple[str, str]]:
    d = (today or date.today()).toordinal()
    start = (d * n) % len(REGIONS)
    return [REGIONS[(start + i) % len(REGIONS)] for i in range(n)]


def _g(d: dict, *path, default=None):
    for p in path:
        if not isinstance(d, dict):
            return default
        d = d.get(p)
    return d if d is not None else default


def to_row(it: dict, region_hint: str) -> dict | None:
    e = it.get("_enhanced") or {}
    rid = it.get("id") or e.get("id")
    url = e.get("listingUrl") or it.get("shareUrl") or (f"https://www.immobiliare.it/annunci/{rid}/" if rid else None)
    if not rid or not url or "immobiliare.it" not in url:
        return None
    price = e.get("priceAmount") or _g(it, "price", "raw")
    try:
        price = float(price) if price else None
    except (TypeError, ValueError):
        price = None
    sqm = e.get("surfaceSqm") or e.get("commercialSurfaceSqm")
    try:
        sqm = float(re.sub(r"[^\d.]", "", str(sqm))) if sqm else None
    except ValueError:
        sqm = None
    photos = [u for u in (e.get("photoUrlsHd") or e.get("photoUrls") or
                          [_g(m, "hd") or _g(m, "sd") for m in (_g(it, "media", "images", default=[]) or [])]) if isinstance(u, str) and u.startswith("https://")][:15]
    plans = [u for u in (e.get("floorplanUrlsHd") or []) if isinstance(u, str) and u.startswith("https://")][:3]
    title = (it.get("title") or "").strip()
    desc = (e.get("descriptionText") or _g(it, "description", "content") or "").strip()
    kind = next((k for k, rx in TYPE_RULES if rx.search(f"{title} {_g(it, 'typology', 'name', default='')}")), "house")
    city = e.get("city") or _g(it, "geography", "municipality", "name")
    prov = province_code(e.get("province") or _g(it, "geography", "province", "name") or _g(it, "geography", "province", "abbreviation"))
    region = region_for(prov) or e.get("region") or region_hint
    lat, lng = e.get("latitude") or _g(it, "geography", "geolocation", "latitude"), e.get("longitude") or _g(it, "geography", "geolocation", "longitude")
    agency = _g(it, "author", "name") or _g(it, "contacts", "agencyName")
    rooms = e.get("rooms") or _g(it, "topology", "rooms")
    status = e.get("condition") or ""
    cond = "ruin" if RUIN.search(desc) else STATUS.get(status)
    avail = (e.get("availability") or "").lower()
    occupancy = "free" if avail.startswith("libero") else "occupied" if avail.startswith("occupat") else "unknown"
    auction = bool(e.get("isAuction") or AUCTION.search(desc))
    phones = [p for p in (e.get("contactPhones") or []) if isinstance(p, str)] or [p.get("num") for p in (_g(it, "contacts", "phones", default=[]) or []) if isinstance(p, dict) and p.get("num")]
    typology = e.get("propertyType") or _g(it, "topology", "typology", "name") or ""
    return {
        "document": {"source_id": "immobiliare", "url": url, "part": "", "status": "extracted", "language": "it",
                     "title": title or f"Immobiliare.it {rid}", "text_content": desc[:20000], "meta": {"apify": ACTOR, "rooms": rooms}},
        "listing": {
            "external_id": f"immobiliare:{rid}", "country": "IT", "region": region, "province": prov, "comune": city,
            "address": e.get("address") or _g(it, "geography", "street"), "lat": lat, "lng": lng,
            "title_en": title or f"{'Apartment' if kind == 'apartment' else 'House'} in {city or 'Italy'}",
            "summary_en": summary(kind, typology, sqm, e, cond, city), "condition": cond,
            "property_type": kind, "sale_type": "sale", "price_eur": price,
            "surface_sqm": sqm if sqm and 15 <= sqm <= 3000 and kind != "land" else None,
            "land_sqm": sqm if kind == "land" else None, "occupancy": occupancy, "status": "active",
            "sale_mode": "Court auction advertised by a private consultant" if auction else "Private sale through an agency or owner",
            "contacts": [{"role": "Listing on Immobiliare.it", "name": agency, "url": url, **({"phone": phones[0]} if phones else {})}], "attachments": [],
            "photo_urls": photos + plans, "hero_image_path": photos[0] if photos else None, "is_demo": False,
        },
        "facts": [f for f in (
            {"key": "price_eur", "label_en": "Asking price", "value_text": f"€{price:,.0f}", "value_num": price,
             "quote": _g(it, "price", "value", default=f"€ {price:,.0f}"), "quote_en": f"Asking price on Immobiliare.it: €{price:,.0f}", "verified": True} if price else None,
            {"key": "surface_sqm", "label_en": "Surface", "value_text": f"{sqm:.0f} m²", "value_num": sqm,
             "quote": f"{sqm:.0f} m²", "quote_en": f"{sqm:.0f} m²", "verified": True} if sqm else None,
            {"key": "description", "label_en": "Description", "value_text": desc[:400], "value_num": None,
             "quote": desc[:4000], "quote_en": "Description from the listing, in Italian", "verified": True} if desc else None,
        ) if f] + feature_facts(it),
        "flags": flags_for(desc, e),
    }


def run_actor(token: str, start_urls: list[str], max_items: int, log=print) -> list[dict]:
    c = httpx.Client(timeout=60)
    body = {"startUrls": start_urls, "maxItems": max_items, "sortBy": "mostRecent", "maxConcurrency": 5, "outputLanguage": "it"}
    r = c.post(f"{API}/acts/{ACTOR}/runs", params={"token": token}, json=body)
    r.raise_for_status()
    run = r.json()["data"]
    log(f"  Apify run {run['id']} started")
    for _ in range(120):  # up to 20 minutes
        time.sleep(10)
        run = c.get(f"{API}/actor-runs/{run['id']}", params={"token": token}).json()["data"]
        if run["status"] not in ("READY", "RUNNING"):
            break
    log(f"  Apify run finished: {run['status']}")
    items = c.get(f"{API}/datasets/{run['defaultDatasetId']}/items", params={"token": token, "clean": "true", "format": "json"})
    items.raise_for_status()
    return items.json()


def collect(db: Supa, regions: int | None = None, max_price: int | None = None, per_region: int | None = None, log=print) -> dict:
    regions = regions or int(os.environ.get("IMMOBILIARE_REGIONS") or 1)
    max_price = max_price or int(os.environ.get("IMMOBILIARE_MAX_PRICE") or 100000)
    per_region = per_region or int(os.environ.get("IMMOBILIARE_PER_REGION") or 100)
    token = os.environ.get("APIFY_TOKEN")
    if not token or os.environ.get("IMMOBILIARE_MODE") == "direct":
        from . import immobiliare_direct
        return immobiliare_direct.collect(db, regions, max_price, log=log)
    picked = pick_regions(min(regions, len(REGIONS)))
    # Price bands, e.g. "0-25000,25000-50000,50000-100000": each band is its own run of up to per_region results,
    # so cheap houses are not crowded out by the €90k ones.
    bands = []
    for b in (os.environ.get("IMMOBILIARE_BANDS") or f"0-{max_price}").split(","):
        lo, _, hi = b.strip().partition("-")
        if hi.strip().isdigit():
            bands.append((int(lo or 0), int(hi)))
    saved, seen = 0, 0
    for (region, slug), (lo, hi) in [(r, b) for r in picked for b in bands]:
        url = f"https://www.immobiliare.it/vendita-case/{slug}/?prezzoMassimo={hi}" + (f"&prezzoMinimo={lo}" if lo else "") + "&criterio=dataModifica&ordine=desc"
        log(f"Immobiliare {region} €{lo:,}-{hi:,}: {url}")
        try:
            items = run_actor(token, [url], per_region, log)
        except Exception as e:  # noqa: BLE001
            log(f"  {region}: error {e}")
            continue
        seen += len(items)
        saved += save(db, [r for r in (to_row(it, region) for it in items) if r])
    return {"regions": [r for r, _ in picked], "bands": bands, "results": seen, "saved": saved}


def save(db: Supa, recs: list[dict]) -> int:
    """Upserts documents, listings, facts and red flags for to_row() records. Returns listings saved."""
    saved = 0
    for i in range(0, len(recs), 50):
        batch = list({b["listing"]["external_id"]: b for b in recs[i:i + 50]}.values())
        docs = db.upsert("documents", [b["document"] for b in batch], on_conflict="url,part")
        doc_id = {d["url"]: d["id"] for d in docs}
        rows = db.upsert("listings", [{**b["listing"], "document_id": doc_id.get(b["document"]["url"])} for b in batch], on_conflict="external_id")
        lid = {r["external_id"]: r["id"] for r in rows}
        if lid:
            db.delete("listing_facts", {"listing_id": in_(list(lid.values()))})
            facts = [{"listing_id": lid[b["listing"]["external_id"]], **f} for b in batch for f in b["facts"] if b["listing"]["external_id"] in lid]
            if facts:
                db.insert("listing_facts", facts, returning=False)
            db.delete("listing_red_flags", {"listing_id": in_(list(lid.values())), "origin": "eq.listing"})
            flags = [{"listing_id": lid[b["listing"]["external_id"]], **f} for b in batch for f in b["flags"] if b["listing"]["external_id"] in lid]
            if flags:
                db.insert("listing_red_flags", flags, returning=False)
        saved += len(lid)
    return saved
