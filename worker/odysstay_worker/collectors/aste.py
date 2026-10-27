"""Astegiudiziarie.it: private sales run as online auctions (aste tra privati), plus photos for court lots.

The site publishes a full sitemap of property pages and its robots.txt allows everything. Each page carries
schema.org data (RealEstateListing, Offer, SaleEvent) with the price, the closing date, an English
description and the photos, so no AI is needed.
- Private sales become listings of their own (sale_type "sale").
- Court lots are already in our data from the ministry portal: we only borrow their photos, matched on
  town and exact base price, for listings that have none.
"""
from __future__ import annotations

import gzip
import json
import random
import re
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime
from html import unescape

import httpx

from ..italy import province_code, region_for
from ..supa import Supa, eq, in_

SITEMAP = "https://www.astegiudiziarie.it/SiteMap/SchedeDettagliateImmobili"
MAX_PRICE = 300_000
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; OdysstayBot/0.1; +https://odysstay.com/bot)", "Accept-Language": "it-IT,it;q=0.9,en;q=0.8"}
KEEP = re.compile(r"vendita-asta-(appartamento|villa|villetta|villino|casa|abitazione|rustico|casale|terratetto|fabbricato|attico|"
                  r"mansarda|bifamiliare|porzione|cascina|masseria|trullo|baita|podere|edificio|palazzina|terreno)", re.I)
TYPE_OF = [("rural_house", r"rustic|casale|cascina|masseria|trull|baita|podere|colonic|rurale"),
           ("house", r"villa|villett|villino|casa|terratetto|bifamiliare|indipendent|schiera"),
           ("apartment", r"appartament|attico|mansard|abitazion"),
           ("building", r"fabbricat|edificio|palazzin"),
           ("land", r"terren")]
TYPE_EN = {"house": "House", "rural_house": "Rural house", "apartment": "Apartment", "building": "Building", "land": "Land"}


def ptype(s: str) -> str:
    low = s.lower()
    return next((t for t, rx in TYPE_OF if re.search(rx, low)), "other")


def sitemap_urls(c: httpx.Client) -> list[str]:
    r = c.get(SITEMAP)
    body = r.content
    if body[:2] == b"\x1f\x8b":
        body = gzip.decompress(body)
    return [unescape(u) for u in re.findall(r"<loc>([^<]+)</loc>", body.decode("utf-8", "ignore"))]


def graph(html: str) -> list[dict]:
    out = []
    for m in re.finditer(r'<script[^>]*ld\+json[^>]*>(.*?)</script>', html, re.S):
        try:
            j = json.loads(m.group(1))
        except ValueError:
            continue
        out += j.get("@graph", [j]) if isinstance(j, dict) else j
    return [x for x in out if isinstance(x, dict)]


def text_of(html: str) -> str:
    html = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", html, flags=re.S | re.I)
    return re.sub(r"\s+", " ", unescape(re.sub(r"<[^>]+>", " ", html))).strip()


def row_value(t: str, label: str) -> str | None:
    m = re.search(re.escape(label) + r"\s+([A-Za-zÀ-ÿ0-9/ ,.'-]{1,40}?)(?=\s+[A-Z][a-zà-ÿ]+\s|$)", t)
    return m.group(1).strip() if m else None


def parse(url: str, html: str, today: date) -> dict | None:
    g = graph(html)
    bene = next((x for x in g if x.get("@type") in ("Apartment", "House", "SingleFamilyResidence", "Residence", "Accommodation",
                                                     "Place", "LandmarksOrHistoricalBuildings", "Product")
                 and x.get("@id", "").endswith("#bene")), None)
    offer = next((x for x in g if x.get("@type") == "Offer"), None)
    event = next((x for x in g if x.get("@type") == "SaleEvent"), None)
    listing = next((x for x in g if x.get("@type") == "RealEstateListing"), None)
    if not (offer and (bene or listing)):
        return parse_court(url, html)
    t = text_of(html)
    name = (bene or listing).get("name") or ""
    place = re.search(r"in vendita a (.+?) \(([A-Z]{2})\)", name) or re.search(r" a ([A-ZÀ-Ý][^()]+?) \(([A-Z]{2})\)", name)
    comune, prov = (place.group(1).strip(), province_code(place.group(2))) if place else (None, None)
    try:
        price = float(offer.get("price") or 0) or None
    except ValueError:
        price = None
    if price and price > MAX_PRICE:
        return None
    end = offer.get("availabilityEnds") or (event or {}).get("endDate")
    end_d = datetime.fromisoformat(end).date() if end else None
    if end_d and end_d < today:
        return None
    court = re.search(r"Tribunale di ([A-ZÀ-Ý][\w' -]{2,40}?)(?:\s+(?:Esecuzione|Fallimento|Liquidazione|Proc|Concordato|R\.G)|,|\.)", t)
    images = (bene or listing).get("image") or (listing or {}).get("image") or []
    images = [i for i in ([images] if isinstance(images, str) else images) if isinstance(i, str) and i.startswith("https://")][:16]
    desc_en = ((bene or {}).get("description") or (listing or {}).get("description") or "").strip()
    kind = ptype(name + " " + url)
    sqm = None
    m = re.search(r"Superficie (?:catastale|commerciale|convenzionale)?\s*(\d{2,4}(?:[.,]\d+)?)\s*mq", t, re.I)
    if m:
        sqm = float(m.group(1).replace(",", "."))
    caps = {"apartment": 400, "house": 1200, "rural_house": 1500, "building": 3000}
    if sqm and (sqm < 15 or sqm > caps.get(kind, 3000)):
        sqm = None
    condition = row_value(t, "Condizioni dell’immobile") or row_value(t, "Condizioni dell'immobile")
    occupancy = row_value(t, "Stato occupazione")
    share = row_value(t, "Quota")
    right = row_value(t, "Diritto")
    addr = None
    if event and event.get("name"):
        a = re.search(r"–\s*[^,]+,\s*(.+?)\s+\d{5}\s", event["name"])
        addr = a.group(1).strip() if a else None
    facts = []

    def fact(key, label, vt, vn, quote, quote_en):
        facts.append({"key": key, "label_en": label, "value_text": vt, "value_num": vn, "quote": quote, "quote_en": quote_en, "verified": True})

    if price:
        fact("price_eur", "Starting price", f"€{price:,.0f}", price, f"Prezzo: € {price:,.0f}".replace(",", "."), f"Starting price €{price:,.0f}")
    if end_d:
        fact("deadline", "Offers close", f"{end_d:%-d %b %Y}", None, f"Fine raccolta offerte: {end_d:%d/%m/%Y}", f"Offers close on {end_d:%-d %b %Y}")
    if sqm:
        fact("surface_sqm", "Surface", f"{sqm:,.0f} m²", sqm, m.group(0), f"Surface {sqm:,.0f} m²")
    if condition:
        fact("condition", "Condition", condition, None, f"Condizioni dell'immobile {condition}", condition)
    if occupancy:
        fact("occupancy", "Occupancy", occupancy, None, f"Stato occupazione {occupancy}", occupancy)
    if share and share != "1/1":
        fact("share", "Share for sale", share, None, f"Quota {share}", f"Only a {share} share is for sale")
    if right and right.lower() != "proprietà":
        fact("right", "Right for sale", right, None, f"Diritto {right}", right)
    if desc_en:
        fact("description", "Description", desc_en[:400], None, desc_en[:1000], "Description published by the seller, in English")
    ident = (listing or {}).get("identifier") or (bene or {}).get("identifier") or url.rsplit("-", 1)[-1]
    rec = {
        "court": court.group(1).strip() if court else None, "comune": comune, "price": price, "images": images,
        "document": {"source_id": "aste", "url": url, "part": "", "status": "extracted", "language": "it",
                     "title": name[:300], "text_content": t[:20000], "meta": {"aste_id": str(ident)}},
        "listing": {"external_id": f"aste:{ident}", "country": "IT", "region": region_for(prov) if prov else None, "province": prov,
                    "comune": comune, "address": addr, "lot": None,
                    "title_en": f"{TYPE_EN.get(kind, 'Property')} in {comune or 'Italy'}" + (f" ({prov})" if prov else ""),
                    "summary_en": (desc_en[:600] + ("..." if len(desc_en) > 600 else "")) or None,
                    "property_type": kind, "sale_type": "sale", "price_eur": price, "min_offer_eur": None, "appraisal_eur": None,
                    "discount_pct": None, "surface_sqm": sqm if kind != "land" else None, "land_sqm": sqm if kind == "land" else None,
                    "deposit_eur": None, "deadline_at": end_d.isoformat() if end_d else None, "auction_at": end_d.isoformat() if end_d else None,
                    "occupancy": "occupied" if (occupancy or "").lower().startswith(("occupat", "locat")) else ("free" if (occupancy or "").lower().startswith("liber") else "unknown"),
                    "court": None, "case_ref": None, "sale_mode": "Online auction between private parties",
                    "contacts": [{"role": "Sale page with the offer form", "name": "Astegiudiziarie / Astetraprivati", "url": url}],
                    "attachments": [], "photo_urls": images, "hero_image_path": images[0] if images else None, "is_demo": False},
        "facts": facts,
    }
    return rec


def parse_court(url: str, html: str) -> dict | None:
    """Court lot pages have no schema.org data: town, base price and photos are read from the page header."""
    t = text_of(html)
    m = re.search(r",\s*([A-ZÀ-Ý][^,()]{1,50}?) \(([A-Z]{2})\) € ([\d.]+(?:,\d+)?) Offerta minima", t)
    if not m or "Tribunale" not in t:
        return None
    price = float(m.group(3).replace(".", "").replace(",", "."))
    seen, images = set(), []
    for u in re.findall(r'"(/Allegato/Foto-[^"]+)"', html):
        if u.lower() not in seen:
            seen.add(u.lower())
            images.append("https://www.astegiudiziarie.it" + u)
    court = re.search(r"Tribunale ([A-ZÀ-Ý][\w' -]{2,40}?) Tipo di procedura", t)
    return {"court": court.group(1) if court else "unknown", "comune": m.group(1).strip(), "price": price, "images": images[:16],
            "document": {"source_id": "aste", "url": url, "part": "", "status": "irrelevant", "language": "it", "title": None, "meta": {}},
            "listing": None, "facts": []}


def _client() -> httpx.Client:
    return httpx.Client(headers=HEADERS, timeout=40, follow_redirects=True)


def probe(log=print, n: int = 12):
    c = _client()
    urls = [u for u in sitemap_urls(c) if KEEP.search(u)]
    log(f"sitemap: {len(urls)} residential or land pages")
    for u in random.sample(urls, min(n, len(urls))):
        time.sleep(0.5)
        r = parse(u, c.get(u).text, date.today())
        log(f"{u[-60:]}: " + (f"court={r['court']} comune={r['comune']} price={r['price']} photos={len(r['images'])} "
                              + (f"type={r['listing']['property_type']} sqm={r['listing']['surface_sqm']} end={r['listing']['deadline_at']}" if r["listing"] else "")
                              if r else "no data / closed"))


def collect(db: Supa, limit: int = 4000, workers: int = 4, log=print) -> dict:
    today = date.today()
    c = _client()
    urls = [u for u in sitemap_urls(c) if KEEP.search(u)]
    known = {r["url"] for r in db.select("documents", {"select": "url", "source_id": eq("aste")})}
    todo = [u for u in urls if u not in known][:limit]
    log(f"Astegiudiziarie: {len(urls)} residential or land pages, {len(todo)} new to read")
    stats = {"pages": len(urls), "read": 0, "private": 0, "court_photos": 0, "court_unmatched": 0, "closed_or_empty": 0, "errors": 0}

    def get(u):
        time.sleep(0.4)
        try:
            return u, parse(u, c.get(u).text, today), None
        except Exception as e:  # noqa: BLE001
            return u, None, e

    private, court, seen_docs = [], [], []
    with ThreadPoolExecutor(max_workers=workers) as ex:
        for u, rec, err in ex.map(get, todo):
            stats["read"] += 1
            if err:
                stats["errors"] += 1
                continue
            if not rec:
                stats["closed_or_empty"] += 1
                seen_docs.append({"source_id": "aste", "url": u, "part": "", "status": "irrelevant", "language": "it", "title": None, "meta": {}})
                continue
            (court if rec["court"] else private).append(rec)
    # Court lots: photos onto our matching court-portal listing (same town, same base price), only where it has none.
    for rec in court:
        if not (rec["images"] and rec["comune"] and rec["price"]):
            continue
        rows = db.select("listings", {"select": "id,photo_urls", "external_id": "like.pvp:*", "comune": f"ilike.{rec['comune']}",
                                      "price_eur": eq(str(rec["price"]))})
        if len(rows) == 1 and not rows[0].get("photo_urls"):
            db.update("listings", {"id": eq(rows[0]["id"])}, {"photo_urls": rec["images"], "hero_image_path": rec["images"][0]})
            stats["court_photos"] += 1
        elif not rows:
            stats["court_unmatched"] += 1
        seen_docs.append({"source_id": "aste", "url": rec["document"]["url"], "part": "", "status": "irrelevant", "language": "it",
                          "title": rec["document"]["title"], "meta": {**rec["document"]["meta"], "court": rec["court"]}})
    for i in range(0, len(private), 50):
        batch = private[i:i + 50]
        docs = db.upsert("documents", [b["document"] for b in batch], on_conflict="url,part")
        doc_id = {d["url"]: d["id"] for d in docs}
        saved = db.upsert("listings", [{**b["listing"], "document_id": doc_id.get(b["document"]["url"])} for b in batch], on_conflict="external_id")
        lid = {r["external_id"]: r["id"] for r in saved}
        db.delete("listing_facts", {"listing_id": in_(list(lid.values()))})
        db.insert("listing_facts", [{"listing_id": lid[b["listing"]["external_id"]], **f} for b in batch for f in b["facts"]
                                    if b["listing"]["external_id"] in lid], returning=False)
        stats["private"] += len(saved)
    for i in range(0, len(seen_docs), 200):
        db.upsert("documents", seen_docs[i:i + 200], on_conflict="url,part", ignore_duplicates=True)
    return stats
