"""Notary sales and auctions from Avvisinotarili, the national notaries' portal (Consiglio Nazionale del Notariato).

Private sellers, companies and public bodies (INPS, the state property agency, regions, comuni) sell through
it, and a notary checks every notice. The portal is public and its robots.txt allows the pages we read.
We read the open notices (statoAvviso=inCorso) under a price cap, then each detail page. No AI: every value
is taken from a labelled field on the detail page and kept with the exact label text as its quote.
"""
from __future__ import annotations

import re
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime
from html import unescape

import httpx

from ..italy import province_code, region_for
from ..supa import Supa, eq, in_

BASE = "https://www.avvisinotarili.notariato.it"
UA = "Mozilla/5.0 (compatible; OdysstayBot/0.1; +https://odysstay.com/bot)"
HEADERS = {"User-Agent": UA, "Accept-Language": "it-IT,it;q=0.9"}
DETAIL_RE = re.compile(r"/beni-immobili/dettaglio-avviso/(GAV|GAST|GAST_PUB)/(\d+)")
# GAV: notary's own notices (private and company sellers). GAST_PUB: public bodies. GAST are court sales,
# which we already read from the ministry portal, so they are left out.
ALL_TYPES = "GAV:(*);GAST_PUB:(*)"


def text_of(html: str) -> str:
    html = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", html, flags=re.S | re.I)
    html = re.sub(r"<br\s*/?>|</p>|</div>|</li>|</h\d>", "\n", html, flags=re.I)
    return re.sub(r"[ \t\r\f\v]+", " ", unescape(re.sub(r"<[^>]+>", " ", html))).replace(" \n", "\n")


class Portal:
    def __init__(self, delay: float = 0.6):
        self.c = httpx.Client(headers=HEADERS, timeout=40, follow_redirects=True)
        self.delay = delay
        self.token = None

    def _get(self, url: str, **kw) -> httpx.Response:
        for attempt in range(4):
            try:
                time.sleep(self.delay)
                r = self.c.get(url, **kw)
                if r.status_code < 500:
                    return r
            except httpx.HTTPError:
                pass
            time.sleep(3 * (attempt + 1))
        raise RuntimeError(f"GET failed {url}")

    def start(self):
        r = self._get(BASE + "/")
        m = re.search(r'name="csrf-token"\s+content="([^"]+)"', r.text) or re.search(r'content="([^"]+)"\s+name="csrf-token"', r.text)
        self.token = m.group(1) if m else None

    def search(self, page: int, max_price: float, provincia: str = "") -> str:
        form = {"tipoBene": "I", "statoAvviso": "inCorso", "ordinamento": "prezzo:ASC", "tipologia": ALL_TYPES,
                "provincia": provincia, "prezzoMassimo": str(int(max_price)), "coords": ""}
        if self.token:
            form["_token"] = self.token
        headers = {"X-CSRF-TOKEN": self.token} if self.token else {}
        url = f"{BASE}/beni-immobili/?page={page}" if page > 1 else f"{BASE}/beni-immobili/?"
        for attempt in range(4):
            try:
                time.sleep(self.delay)
                r = self.c.post(url, data=form, headers=headers)
                if r.status_code < 500:
                    return r.text
            except httpx.HTTPError:
                pass
            time.sleep(3 * (attempt + 1))
        return ""

    def detail(self, kind: str, nid: str) -> str:
        return self._get(f"{BASE}/beni-immobili/dettaglio-avviso/{kind}/{nid}").text


def probe(log=print):
    p = Portal()
    p.start()
    log(f"token {'found' if p.token else 'missing'}")
    html = p.search(1, 300000)
    ids = sorted(set(DETAIL_RE.findall(html)))
    pages = sorted({int(x) for x in re.findall(r"[?&]page=(\d+)", html)})
    log(f"search page 1: {len(html)//1024} KB, {len(ids)} notices, pages seen {pages[-5:]}, sample {ids[:3]}")
    for m in list(re.finditer(r"pagin|page=|Successiv|carica|load", html, re.I))[:6]:
        log("pager: " + re.sub(r"\s+", " ", html[max(0, m.start() - 200): m.start() + 250]))
    k = html.rfind("dettaglio-avviso")
    log("after last: " + re.sub(r"\s+", " ", html[k: k + 1500]))
    if ids:
        d = text_of(p.detail(*ids[0]))
        j = d.find("Prezzo")
        log("detail text: " + re.sub(r"\s+", " ", d[max(0, j - 300): j + 900]))


# ---------- parsing ----------

MONTHS = {m: i + 1 for i, m in enumerate(["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio",
                                           "agosto", "settembre", "ottobre", "novembre", "dicembre"])}


def eur(s: str) -> float | None:
    m = re.search(r"€\s*([\d.]+(?:,\d+)?)", s)
    if not m:
        return None
    try:
        return float(m.group(1).replace(".", "").replace(",", "."))
    except ValueError:
        return None


def it_dt(s: str) -> date | None:
    m = re.search(r"(\d{1,2})/(\d{1,2})/(\d{4})", s)
    if m:
        try:
            return date(int(m.group(3)), int(m.group(2)), int(m.group(1)))
        except ValueError:
            return None
    m = re.search(r"(\d{1,2}) (" + "|".join(MONTHS) + r") (\d{4})", s, re.I)
    if m:
        return date(int(m.group(3)), MONTHS[m.group(2).lower()], int(m.group(1)))
    return None


def field(t: str, label: str, n: int = 160) -> str | None:
    """Text right after 'label:' on the detail page."""
    m = re.search(re.escape(label) + r"\s*:?\s*(.{1,%d}?)(?:\n|  |$)" % n, t)
    return m.group(1).strip() if m else None


def before(t: str, label: str, n: int = 80) -> str | None:
    """The portal prints some values before their label, e.g. '€ 64.000,00 Prezzo dell'avviso'."""
    m = re.search(r"([^\n]{1,%d})\s*\n?\s*%s" % (n, re.escape(label)), t)
    return m.group(1).strip() if m else None


TYPE_WORDS = [("rural_house", r"rustic|casale|colonic|rurale|masseria|cascina|trullo|podere"),
              ("house", r"villa|villino|casa |indipendent|schiera"),
              ("apartment", r"appartament|abitazion|alloggio|monolocal|bilocal|trilocal|residenzial"),
              ("land", r"terren|appezzament|fondo agricolo|area edificabile"),
              ("garage", r"box|garage|autorimess|posto auto"),
              ("commercial", r"negozio|ufficio|laboratorio|capannone|magazzino|commerciale|albergo|deposito")]


def classify(text: str) -> str:
    low = text.lower()
    for t, rx in TYPE_WORDS:
        if re.search(rx, low):
            return t
    return "other"


def parse(kind: str, nid: str, html: str, today: date) -> dict | None:
    t = text_of(html)
    flat = re.sub(r"\s+", " ", t)
    price_txt = before(flat, "Prezzo dell'avviso", 40) or ""
    price = eur(price_txt)
    m = re.search(r"Dettaglio avviso:\s*\d+\s*(.*?)\s*(?:Stato |€)", flat)
    head = (m.group(1) if m else "")[:900]
    place = re.search(r"\b([A-ZÀ-Ý][\w'’ .-]{1,40}) \(([A-Z]{2})\)", head) or re.search(r"\b([A-ZÀ-Ý][\w'’ .-]{1,40}) \(([A-Z]{2})\)", flat)
    comune, prov = (place.group(1).strip(), place.group(2)) if place else (None, None)
    prov = province_code(prov) if prov else None
    auction_d = it_dt(field(flat, "Data e Ora svolgimento Asta") or before(flat, "Data e Ora vendita", 60) or "")
    deadline_d = it_dt(field(flat, "Data e Ora fine presentazione offerte") or before(flat, "Data e Ora fine raccolta offerte", 60) or "")
    if (auction_d and auction_d < today) or (deadline_d and deadline_d < today and not auction_d):
        return None
    deposit = eur(field(flat, "Cauzione") or "")
    notary = field(flat, "Notaio Banditore", 80)
    method = field(flat, "Metodo Asta", 60)
    direct = "Trattativa" in flat and not method
    seller = field(flat, "Denominazione ente", 120)
    proc_type = field(flat, "Tipologia di procedura", 60)
    occupied = bool(re.search(r"\boccupat[oi]\b", flat, re.I)) and not re.search(r"\blibero\b", flat, re.I)
    surf = re.search(r"(?:superficie[^.€]{0,40}?|mq\.?\s*)(\d{2,4}(?:,\d+)?)\s*(?:mq|m²)?", flat, re.I)
    sqm = float(surf.group(1).replace(",", ".")) if surf else None
    ptype = classify(head)
    if sqm and (sqm < 15 or (ptype == "apartment" and sqm > 400) or sqm > 3000):
        sqm = None
    photos = [BASE + u if u.startswith("/") else u for u in re.findall(r'<img[^>]+src="([^"]*/allegati/[^"]+\.(?:jpe?g|png|webp))"', html, re.I)
              if "logo" not in u.lower() and "thumb" not in u.lower()]
    photos = list(dict.fromkeys(photos))[:12]
    docs = [{"kind": "sale_notice" if re.search(r"avviso|bando", n, re.I) else "other", "name": unescape(n.strip())[:120] or "Document",
             "url": BASE + u if u.startswith("/") else u}
            for u, n in re.findall(r'<a[^>]+href="([^"]*/allegati/[^"]+\.pdf)"[^>]*>(.*?)</a>', html, re.I | re.S)][:10]
    contacts = []
    if notary:
        email = re.search(r"[\w.+-]+@[\w-]+\.[\w.]+", flat)
        phone = re.search(r"tel[.:]?\s*([\d/ .+-]{6,20})", flat, re.I)
        contacts.append({"role": "Notary running the sale", "name": notary, "email": email.group(0) if email else None,
                         "phone": phone.group(1).strip() if phone else None})
    url = f"{BASE}/beni-immobili/dettaglio-avviso/{kind}/{nid}"
    facts: list[dict] = []

    def fact(key, label, vt, vn, quote, quote_en):
        facts.append({"key": key, "label_en": label, "value_text": vt, "value_num": vn, "quote": quote, "quote_en": quote_en, "verified": True})

    if price:
        fact("price_eur", "Price", f"€{price:,.0f}", price, f"{price_txt} Prezzo dell'avviso", f"Price in the notice: €{price:,.0f}")
    if deposit:
        fact("deposit_eur", "Deposit", f"€{deposit:,.0f}", deposit, f"Cauzione: {field(flat, 'Cauzione')}", f"Deposit: €{deposit:,.0f}")
    if deadline_d:
        fact("deadline", "Offer deadline", f"{deadline_d:%-d %b %Y}", None, field(flat, "Data e Ora fine presentazione offerte") or "", f"Offers by {deadline_d:%-d %b %Y}")
    if auction_d:
        fact("auction_date", "Sale date", f"{auction_d:%-d %b %Y}", None, field(flat, "Data e Ora svolgimento Asta") or "", f"Auction on {auction_d:%-d %b %Y}")
    if seller:
        fact("seller", "Seller", seller, None, f"Denominazione ente: {seller}", f"Seller: {seller}")
    if method:
        fact("sale_mode", "How bids are made", method, None, f"Metodo Asta: {method}", method)
    if head:
        fact("description", "Official description", head[:400], None, head[:1000], "Official description, in Italian")
    noun = {"house": "House", "apartment": "Apartment", "rural_house": "Rural house", "land": "Land", "garage": "Garage",
            "commercial": "Commercial property"}.get(ptype, "Property")
    title = f"{noun} in {comune or 'Italy'}" + (f" ({prov})" if prov else "")
    summary = (f"{'Direct sale' if direct else 'Notary auction'}" + (f" by {seller}" if seller else "") + ". "
               + (f"Price €{price:,.0f}. " if price else "") + (f"Offers by {deadline_d:%-d %b %Y}. " if deadline_d else "")
               + "Every notice on this portal is checked by a notary.")
    return {
        "document": {"source_id": "notary", "url": url, "part": "", "status": "extracted", "language": "it",
                     "title": f"Avvisi Notarili {nid}" + (f", {comune}" if comune else ""), "text_content": t[:20000],
                     "meta": {"notary_id": f"{kind}/{nid}", "procedure": proc_type}},
        "listing": {"external_id": f"notary:{kind}:{nid}", "country": "IT", "region": region_for(prov) if prov else None,
                    "province": prov, "comune": comune, "address": None, "lot": None, "title_en": title, "summary_en": summary,
                    "property_type": ptype, "sale_type": "sale" if direct else "auction_notary",
                    "price_eur": price, "min_offer_eur": None, "appraisal_eur": None, "discount_pct": None,
                    "surface_sqm": sqm if ptype != "land" else None, "land_sqm": sqm if ptype == "land" else None,
                    "deposit_eur": deposit, "deadline_at": deadline_d.isoformat() if deadline_d else None,
                    "auction_at": auction_d.isoformat() if auction_d else None,
                    "occupancy": "occupied" if occupied else "unknown", "court": None, "case_ref": None,
                    "sale_mode": method or ("Direct sale" if direct else None), "contacts": contacts, "attachments": docs,
                    "photo_urls": photos, "hero_image_path": photos[0] if photos else None, "is_demo": False},
        "facts": facts,
    }


def collect(db: Supa, max_price: float = 300_000, max_pages: int = 60, workers: int = 3, log=print) -> dict:
    today = date.today()
    p = Portal()
    p.start()
    found: list[tuple[str, str]] = []
    for page in range(1, max_pages + 1):
        html = p.search(page, max_price)
        ids = DETAIL_RE.findall(html)
        new = [i for i in dict.fromkeys(ids) if i not in found]
        if not new:
            break
        found += new
    log(f"Notary portal: {len(found)} open notices under €{max_price:,.0f}")
    known = {r["external_id"] for r in db.select("listings", {"select": "external_id", "external_id": "like.notary:*"})}
    stats = {"open": len(found), "saved": 0, "skipped": 0, "errors": 0}

    def get(k):
        try:
            return k, parse(k[0], k[1], p.detail(*k), today), None
        except Exception as e:  # noqa: BLE001
            return k, None, e

    rows = []
    with ThreadPoolExecutor(max_workers=workers) as ex:
        for k, rec, err in ex.map(get, found):
            if err:
                stats["errors"] += 1
                if stats["errors"] <= 3:
                    log(f"  error {k}: {err}")
                continue
            if not rec or not rec["listing"]["price_eur"]:
                stats["skipped"] += 1
                continue
            rows.append(rec)
    for i in range(0, len(rows), 50):
        batch = rows[i:i + 50]
        docs = db.upsert("documents", [b["document"] for b in batch], on_conflict="url,part")
        doc_id = {d["url"]: d["id"] for d in docs}
        saved = db.upsert("listings", [{**b["listing"], "document_id": doc_id.get(b["document"]["url"])} for b in batch], on_conflict="external_id")
        lid = {r["external_id"]: r["id"] for r in saved}
        db.delete("listing_facts", {"listing_id": in_(list(lid.values()))})
        facts = [{"listing_id": lid[b["listing"]["external_id"]], **f} for b in batch for f in b["facts"] if b["listing"]["external_id"] in lid]
        if facts:
            db.insert("listing_facts", facts, returning=False)
        stats["saved"] += len(saved)
    gone = (known - {f"notary:{k}:{n}" for k, n in found}) if len(found) > 20 else set()
    for ext in gone:
        db.update("listings", {"external_id": eq(ext)}, {"status": "closed"})
    stats["closed"] = len(gone)
    return stats
