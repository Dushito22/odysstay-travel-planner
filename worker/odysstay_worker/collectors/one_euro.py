"""Towns with a €1 house scheme, from casea1euro.it (its robots.txt allows these pages).

Each town becomes one listing of sale_type one_euro: where it is, the project text quoted from the page,
and the links to the town's own official scheme page, which is where the actual houses and the call for
applications are. We do not copy the site's photos; the app shows the satellite view and the town's
Wikipedia introduction instead.
"""
from __future__ import annotations

import re
import time
from html import unescape

import httpx

from ..italy import province_code, region_for
from ..supa import Supa, in_

BASE = "https://casea1euro.it"
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; OdysstayBot/0.1; +https://odysstay.com/bot)", "Accept-Language": "it-IT,it;q=0.9"}
REGION_SLUGS = ("valle-d-aosta|piemonte|liguria|lombardia|veneto|trentino|friuli|emilia-romagna|toscana|marche|umbria|lazio|abruzzo|"
                "molise|campania|puglia|basilicata|calabria|sicilia|sardegna")
TOWN_LINK = re.compile(r'href="(https://casea1euro\.it/(?:' + REGION_SLUGS + r')[a-z-]*/[a-z0-9-]+/)"[^>]*>([^<]{2,60})<')
SKIP_HOSTS = re.compile(r"casea1euro|facebook|instagram|twitter|youtube|google|cloudfront|wp\.com|gmpg|smugmug|1eurohouses|fariestazioni|"
                        r"wordpress|linkedin|pinterest|whatsapp|t\.me|amazon|booking|airbnb|wikipedia", re.I)


def text_of(html: str) -> str:
    html = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", html, flags=re.S | re.I)
    return re.sub(r"\s+", " ", unescape(re.sub(r"<[^>]+>", " ", html))).strip()


def cell(html: str, label: str) -> str | None:
    m = re.search(r">\s*" + re.escape(label) + r"\s*</td>\s*<td[^>]*>([^<]+)<", html, re.I)
    return unescape(m.group(1)).strip() if m else None


def parse(url: str, name: str, html: str) -> dict | None:
    t = text_of(html)
    prov_name = cell(html, "Provincia")
    prov = province_code(prov_name) if prov_name else None
    if not prov:
        return None
    m = re.search(r"Il progetto Case a 1 Euro a [^<]{1,60}</h4>(.*?)</div>\s*</div>", html, re.S | re.I)
    project = text_of(m.group(1))[:1500] if m else ""
    if not project:
        k = t.find("1 euro")
        project = t[max(0, k - 200): k + 600] if k >= 0 else ""
    links = []
    for href in re.findall(r'href="(https?://[^"#]+)"', m.group(1) if m else html):
        if not SKIP_HOSTS.search(href) and href not in links:
            links.append(href)
    links = links[:4]
    pop = cell(html, "Abitanti")
    alt = cell(html, "Altitudine")
    one = re.search(r"[^.]{0,160}\b1 ?(?:euro|€)[^.]{0,160}\.", project or t, re.I)
    facts = [{"key": "price_eur", "label_en": "Price", "value_text": "€1, with a duty to renovate", "value_num": 1,
              "quote": (one.group(0).strip() if one else f"Case a 1 euro a {name}")[:400],
              "quote_en": "Houses offered for a symbolic €1; the buyer must renovate them within the time the town sets.", "verified": True}]
    if pop:
        facts.append({"key": "population", "label_en": "Population", "value_text": pop, "value_num": None,
                      "quote": f"Abitanti {pop}", "quote_en": f"Population {pop}", "verified": True})
    if alt:
        facts.append({"key": "altitude", "label_en": "Altitude", "value_text": alt, "value_num": None,
                      "quote": f"Altitudine {alt}", "quote_en": f"Altitude {alt}", "verified": True})
    if project:
        facts.append({"key": "description", "label_en": "About the scheme", "value_text": project[:400], "value_num": None,
                      "quote": project[:1000], "quote_en": "About the scheme, in Italian", "verified": True})
    slug = url.rstrip("/").rsplit("/", 1)[-1]
    summary = (f"{name} runs a €1 house scheme: abandoned houses for a symbolic €1 if you renovate them, usually within three years, "
               f"often with a deposit of a few thousand euros. The available houses and the call for applications are on the town's own page.")
    return {
        "document": {"source_id": "one_euro", "url": url, "part": "", "status": "extracted", "language": "it",
                     "title": f"Case a 1 euro: {name}", "text_content": t[:20000], "meta": {"official_links": links}},
        "listing": {"external_id": f"one_euro:{slug}", "country": "IT", "region": region_for(prov), "province": prov, "comune": name,
                    "address": None, "lot": None, "title_en": f"€1 houses in {name} ({prov})", "summary_en": summary,
                    "property_type": "house", "sale_type": "one_euro", "price_eur": 1, "min_offer_eur": None, "appraisal_eur": None,
                    "discount_pct": None, "surface_sqm": None, "land_sqm": None, "deposit_eur": None, "deadline_at": None,
                    "auction_at": None, "occupancy": "free", "court": None, "case_ref": None, "sale_mode": "Application to the town",
                    "contacts": [{"role": "Town's official scheme page", "name": f"Comune di {name}", "url": u} for u in links[:2]],
                    "attachments": [{"kind": "other", "name": "Official scheme page", "url": u} for u in links],
                    "photo_urls": [], "hero_image_path": None, "is_demo": False},
        "facts": facts,
    }


EN_LINK = re.compile(r'href="(https://1eurohouses\.com/[a-z-]+/[a-z0-9-]+/)"')


def english_intro(html: str) -> str | None:
    """The English sister site's introduction to the town (1eurohouses.com, same owner, same robots rules)."""
    t = text_of(html)
    k = t.find(" Regione ")
    if k < 0:
        return None
    seg = t[max(0, k - 1000):k]
    start = seg.find(". ")
    seg = seg[start + 2:] if 0 <= start < 400 else seg
    if "Click to access the latest news about" in seg:
        seg = seg.rsplit("Click to access the latest news about", 1)[1]
        seg = re.sub(r"^\s*[A-ZÀ-Ý][\w'’ ]{0,40}?\s+(?=(?:We|The|It|This|In|A|An|Located|Situated)\b)", "", seg)
    seg = re.sub(r"Credits [^–-]*[–-]\s*https?://\S+", " ", seg)
    seg = re.sub(r"https?://\S+", " ", seg)
    seg = re.sub(r"\s+", " ", seg).strip()
    return seg if len(seg) >= 80 else None


def collect(db: Supa, log=print) -> dict:
    c = httpx.Client(headers=HEADERS, timeout=40, follow_redirects=True)
    home = c.get(BASE + "/").text
    seen, towns = set(), []
    for u, n in TOWN_LINK.findall(home):
        n = unescape(n).strip()
        if n and n.lower() not in ("read more", "leggi tutto") and u not in seen:
            seen.add(u)
            towns.append((u, n))
    log(f"€1 towns listed: {len(towns)}")
    recs, skipped = [], 0
    for url, name in towns:
        time.sleep(1.0)
        try:
            html = c.get(url).text
            rec = parse(url, name, html)
            en = EN_LINK.search(html)
            if rec and en:
                time.sleep(1.0)
                intro = english_intro(c.get(en.group(1)).text)
                if intro:
                    rec["listing"]["summary_en"] = f"{intro} {rec['listing']['summary_en']}"
                    rec["facts"].append({"key": "about_town", "label_en": "About the town", "value_text": intro[:400], "value_num": None,
                                         "quote": intro[:1000], "quote_en": None, "verified": True})
        except Exception as e:  # noqa: BLE001
            log(f"  {name}: error {e}")
            rec = None
        if rec:
            recs.append(rec)
        else:
            skipped += 1
    for i in range(0, len(recs), 50):
        batch = recs[i:i + 50]
        docs = db.upsert("documents", [b["document"] for b in batch], on_conflict="url,part")
        doc_id = {d["url"]: d["id"] for d in docs}
        saved = db.upsert("listings", [{**b["listing"], "document_id": doc_id.get(b["document"]["url"])} for b in batch], on_conflict="external_id")
        lid = {r["external_id"]: r["id"] for r in saved}
        db.delete("listing_facts", {"listing_id": in_(list(lid.values()))})
        db.insert("listing_facts", [{"listing_id": lid[b["listing"]["external_id"]], **f} for b in batch for f in b["facts"]
                                    if b["listing"]["external_id"] in lid], returning=False)
    return {"towns": len(towns), "saved": len(recs), "skipped": skipped}
