"""Portale delle Vendite Pubbliche (pvp.giustizia.it): every court-ordered sale in Italy.

The portal's own public JSON API gives structured records, so no AI is needed for the core facts.
Each fact keeps the portal's label and value as its quote ("Prezzo base: € 58.500,00"), and every
listing links back to the official page.

Flow: page through the upcoming sales (sorted by sale date), skip the ones we already have unchanged,
fetch the detail record for new or changed lots, and upsert document + listing + facts.
"""
from __future__ import annotations

import re
import threading
import time
import urllib.parse
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta

import httpx

from ..italy import province_code, region_for
from ..supa import Supa, eq, in_

RIC = "https://pvp.giustizia.it/ric-496b258c-986a1b71/ric-ms"
VE = "https://pvp.giustizia.it/ve-3f723b85-986a1b71/ve-ms"
CONFIG = "https://pvp.giustizia.it/bo-5897bc47-986a1b71/bo-ms/fe-config/area-annunci"
FILES = "https://resource-pvp.giustizia.it"
PAGE = "https://pvp.giustizia.it/pvp/it/detail_annuncio.page?idAnnuncio={id}"
PAGE_SIZE = 100

# esito codes: suspended, no bidders, awarded. The sale is over for us.
CLOSED_ESITI = {"SOSPE": "withdrawn", "ASDES": "closed", "AGGIU": "closed"}
OCCUPANCY = {"LIBER": "free", "OCCUP": "occupied", "OCCST": "occupied", "INCOR": "occupied"}
OCCUPANCY_IT = {"LIBER": "Libero", "OCCUP": "Occupato", "OCCST": "Occupato senza titolo", "INCOR": "In corso di liberazione"}
OCCUPANCY_EN = {"LIBER": "Vacant", "OCCUP": "Occupied", "OCCST": "Occupied without legal title", "INCOR": "Being vacated"}
ATTACHMENT_KIND = {"AVEND": "sale_notice", "PERIZ": "appraisal", "STIMA": "appraisal", "ORDIN": "court_order", "PROVV": "court_order"}
CONTACT_ROLES = {"DELEGATO": "Sale delegate", "CUSTODE": "Custodian", "REFERENTE": "Contact", "CURATORE": "Receiver", "GIUDICE": None}

TYPE_RULES = [  # first match wins, on the bene type code + description
    ("rural_house", r"RUSTIC|CASALE|COLONIC|RURAL|MASSERIA|CASCINA|TRULL|BAITA|PODERE"),
    ("house", r"VILLA|VILLINO|CASA|INDIPENDENT|SCHIERA|BIFAMILIAR|UNIFAMILIAR"),
    ("apartment", r"APPARTAMENT|ABITAZION|ATTICO|MANSARD|MONOLOCAL|BILOCAL|TRILOCAL|RESIDENZIAL"),
    ("building", r"FABBRICAT|PALAZZ|EDIFICI|STABILE"),
    ("garage", r"BOX|GARAGE|AUTORIMESS|POSTO AUTO|POSTI AUTO|CANTIN"),
    ("land", r"TERREN|AGRICOL|EDIFICABIL|FONDO"),
    ("commercial", r"NEGOZI|UFFICI|COMMERCIAL|LABORATORI|CAPANNON|MAGAZZIN|INDUSTRIAL|ALBERG|ARTIGIAN|DEPOSIT"),
]
TYPE_RANK = ["house", "rural_house", "apartment", "building", "commercial", "land", "garage", "other"]
TYPE_EN = {"house": "House", "rural_house": "Rural house", "apartment": "Apartment", "building": "Building",
           "garage": "Garage", "land": "Land", "commercial": "Commercial property", "other": "Property"}
CATEGORY_TYPE = {"IMMOBILE_RESIDENZIALE": "apartment", "IMMOBILE_COMMERCIALE": "commercial",
                 "IMMOBILE_INDUSTRIALE": "commercial", "TERRENO": "land"}

SQM_RE = re.compile(
    r"(?:(?:mq\.?|m²|m2|metri\s+quadr\w*)\s*(?:di\s+|pari\s+a\s+|circa\s+)*(\d{1,3}(?:\.\d{3})*(?:,\d+)?|\d+(?:,\d+)?))"
    r"|(?:(\d{1,3}(?:\.\d{3})*(?:,\d+)?|\d+(?:,\d+)?)\s*(?:mq\b|m²|m2\b|metri\s+quadr))",
    re.I,
)
LAND_CONTEXT = re.compile(r"terren|giardin|corte|area|cortile|piazzal|scoperto|appezzament|fondo", re.I)


# ---------- formatting ----------

def eur_it(v: float) -> str:
    s = f"{v:,.2f}"  # 58,500.00
    return "€ " + s.replace(",", "X").replace(".", ",").replace("X", ".")


def eur_en(v: float) -> str:
    return f"€{v:,.0f}"


def it_date(s: str | None) -> date | None:
    if not s:
        return None
    for fmt in ("%d/%m/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(s[:10], fmt).date()
        except ValueError:
            pass
    return None


def en_date(d: date) -> str:
    return d.strftime("%-d %b %Y")


def parse_num(s: str) -> float | None:
    try:
        return float(s.replace(".", "").replace(",", "."))
    except ValueError:
        return None


def court_name(raw: str | None) -> str | None:
    """'Tribunale di REGGIO EMILIA' -> 'Tribunale di Reggio Emilia'."""
    if not raw:
        return None
    m = re.match(r"^(Tribunale|Corte d'Appello)( di | )(.+)$", raw.strip(), re.I)
    if not m:
        return raw.strip()
    place = " ".join(w if w.lower() in ("di", "del", "della") else w[:1].upper() + w[1:].lower() for w in m.group(3).split())
    place = re.sub(r"'(\w)", lambda x: "'" + x.group(1).upper(), place)
    return f"{m.group(1).title()}{m.group(2)}{place}"


SALE_MODE_EN = {
    "Asincrona Telematica": "Online, asynchronous bidding", "Sincrona Telematica": "Online, live bidding",
    "Sincrona Mista": "Online or in person, live", "Presso Il Venditore": "In person at the delegate's office",
}


def file_url(link: str | None) -> str | None:
    if not link:
        return None
    path, _, q = link.partition("?")
    return FILES + urllib.parse.quote(path) + (f"?{q}" if q else "")


# ---------- API ----------

class Api:
    def __init__(self, delay: float = 0.25, client: httpx.Client | None = None):
        self.c = client or httpx.Client(timeout=45, follow_redirects=True, headers={
            "User-Agent": "Mozilla/5.0 (compatible; OdysstayBot/0.1)", "Accept": "application/json"})
        self.delay = delay
        self._lock = threading.Lock()
        self._last = 0.0

    def _turn(self):
        with self._lock:
            gap = time.monotonic() - self._last
            if gap < self.delay:
                time.sleep(self.delay - gap)
            self._last = time.monotonic()

    def _req(self, method: str, url: str, **kw) -> dict:
        err = None
        for attempt in range(4):
            self._turn()
            try:
                r = self.c.request(method, url, **kw)
                if r.status_code in (429, 500, 502, 503, 504):
                    raise httpx.HTTPStatusError(f"{r.status_code}", request=r.request, response=r)
                r.raise_for_status()
                d = r.json()
                return d.get("body") if isinstance(d, dict) and "body" in d else d
            except (httpx.HTTPError, ValueError) as e:
                err = e
                time.sleep(2 * (attempt + 1))
        raise err  # type: ignore[misc]

    def page(self, n: int, body: dict) -> dict:
        return self._req("POST", f"{RIC}/ricerca/vendite?page={n}&size={PAGE_SIZE}&sort=dataVendita,asc&sort=id,asc", json=body)

    def detail(self, sale_id: int) -> dict:
        return self._req("GET", f"{VE}/vendite/{sale_id}") or {}


def upcoming(api: Api, body: dict, today: date, horizon: date, log=print) -> list[dict]:
    """All sales dated today..horizon. The archive is sorted by sale date, so binary-search the first
    page with upcoming sales, then read forward until dates pass the horizon (typos like 2929 sit at the end)."""
    first = api.page(0, body)
    pages = int(first.get("totalPages") or 1)
    lo, hi = 0, pages - 1
    t = today.isoformat()
    while lo < hi:
        mid = (lo + hi) // 2
        content = api.page(mid, body).get("content") or []
        if content and max(i.get("dataVendita") or "" for i in content) < t:
            lo = mid + 1
        else:
            hi = mid
    log(f"Court sales: {first.get('totalElements')} records in the archive, upcoming from page {lo} of {pages}")
    out, h = [], horizon.isoformat()
    for n in range(lo, pages):
        content = api.page(n, body).get("content") or []
        for it in content:
            d = it.get("dataVendita") or ""
            if t <= d <= h:
                out.append(it)
        if content and min(i.get("dataVendita") or "" for i in content) > h:
            break
    return out


# ---------- record -> rows ----------

def classify(det: dict, item: dict) -> str:
    beni = det.get("beni") or []
    found = []
    for b in beni:
        text = " ".join(str(b.get(k) or "") for k in ("codTipologiaBene", "descTipologiaBene", "descrizione")).upper()
        for t, rx in TYPE_RULES:
            if re.search(rx, text):
                found.append(t)
                break
    if not found:
        desc = (((det.get("lotto") or {}).get("descLotto")) or item.get("descLotto") or "").upper()
        for t, rx in TYPE_RULES:
            if re.search(rx, desc):
                found.append(t)
                break
    if not found:
        cat = (det.get("lotto") or {}).get("codTipoCategLotto") or item.get("categoriaLotto") or ""
        found.append(CATEGORY_TYPE.get(cat, "other"))
    return min(found, key=TYPE_RANK.index)


def find_sqm(texts: list[str], land: bool) -> tuple[float, str] | None:
    """First surface figure in the official text, with the snippet it came from. For buildings, figures
    that describe land, gardens or yards are skipped."""
    for text in texts:
        for m in SQM_RE.finditer(text or ""):
            v = parse_num(m.group(1) or m.group(2))
            before = text[max(0, m.start() - 45) : m.start()]
            if v is None:
                continue
            if not land and LAND_CONTEXT.search(before):
                continue
            lo, hi = (50, 5_000_000) if land else (15, 3000)
            if lo <= v <= hi:
                s, e = max(0, m.start() - 30), min(len(text), m.end() + 5)
                return v, text[s:e].strip()
    return None


def build(item: dict, det: dict, today: date) -> dict:
    """Returns {document, listing, facts} for one lot. Only values present in the record are used."""
    sid = item["id"]
    lotto = det.get("lotto") or {}
    addr = lotto.get("indirizzo") or {}
    beni = det.get("beni") or []
    bene_addr = (beni[0].get("indirizzo") if beni else None) or {}
    proc = det.get("procedura") or {}
    li = item.get("indirizzo") or {}

    prov = province_code(addr.get("codProvincia") or bene_addr.get("codProvincia")) \
        or province_code(addr.get("descProvincia") or li.get("provincia"))
    comune = addr.get("descComune") or bene_addr.get("descComune") or li.get("citta")
    via = addr.get("via") or bene_addr.get("via") or li.get("via")
    coord = li.get("coordinate") or {}

    price = det.get("impoBaseAsta") or item.get("prezzoBaseAsta")
    min_offer = det.get("impoOffertaMinima") or item.get("offertaMinima")
    appraisal = det.get("impoStima")
    if appraisal and price and not (price * 0.5 <= appraisal <= price * 20):
        appraisal = None  # implausible: likely a typo in the record
    sale_d = it_date(det.get("dataVendita")) or it_date(item.get("dataVendita"))
    if sale_d and sale_d.year > today.year + 3:
        sale_d = None
    deadline_d = it_date(det.get("dataTermPresOff"))
    ptype = classify(det, item)
    desc = (lotto.get("descLotto") or item.get("descLotto") or "").strip()
    texts = [b.get("descrizione") or "" for b in beni] + [desc]

    codes = [c for b in beni for c in [b.get("disponibilita") or b.get("codiceTipoDispBene")] if c] or list(item.get("disponibilita") or [])
    occ_code = next((c for c in ("OCCST", "OCCUP", "INCOR", "LIBER") if c in codes), None)

    facts: list[dict] = []

    def fact(key, label_en, value_text, value_num, quote, quote_en):
        facts.append({"key": key, "label_en": label_en, "value_text": value_text, "value_num": value_num,
                      "quote": quote, "quote_en": quote_en, "verified": True})

    if price:
        fact("price_eur", "Base price", eur_en(price), price, f"Prezzo base: {eur_it(price)}", f"Base price: {eur_en(price)}")
    if min_offer:
        fact("min_offer_eur", "Minimum offer", eur_en(min_offer), min_offer, f"Offerta minima: {eur_it(min_offer)}",
             f"Minimum offer: {eur_en(min_offer)}. Offers from this amount are valid.")
    if appraisal:
        fact("appraisal_eur", "Court appraisal", eur_en(appraisal), appraisal, f"Valore di stima: {eur_it(appraisal)}",
             f"Appraised value: {eur_en(appraisal)}")
    if det.get("impoOffertaAumento"):
        v = det["impoOffertaAumento"]
        fact("min_raise_eur", "Minimum raise", eur_en(v), v, f"Rialzo minimo: {eur_it(v)}", f"Minimum raise between bids: {eur_en(v)}")
    if sale_d:
        hour = det.get("oraVendita") or item.get("orarioVendita") or ""
        fact("auction_date", "Sale date", en_date(sale_d) + (f", {hour}" if hour else ""), None,
             f"Data vendita: {sale_d:%d/%m/%Y}" + (f" ore {hour}" if hour else ""),
             f"Sale date: {en_date(sale_d)}" + (f" at {hour}" if hour else ""))
    if deadline_d:
        hour = det.get("oraTermPresOff") or ""
        fact("deadline", "Offer deadline", en_date(deadline_d) + (f", {hour}" if hour else ""), None,
             f"Termine presentazione offerte: {deadline_d:%d/%m/%Y}" + (f" ore {hour}" if hour else ""),
             f"Offers must be filed by {en_date(deadline_d)}" + (f" at {hour}" if hour else ""))
    if occ_code:
        fact("occupancy", "Occupancy", OCCUPANCY_EN[occ_code], None, f"Disponibilità: {OCCUPANCY_IT[occ_code]}", OCCUPANCY_EN[occ_code])
    if det.get("descModVendita"):
        m = det["descModVendita"]
        fact("sale_mode", "How bids are made", SALE_MODE_EN.get(m, m), None, f"Modalità vendita: {m}", SALE_MODE_EN.get(m, m))
    dep = (det.get("datiDeposito") or {}).get("depoCauzionale")
    dep_pct = None
    if dep:
        mm = re.search(r"(\d+(?:[.,]\d+)?)\s*%", str(dep))
        dep_pct = parse_num(mm.group(1)) if mm else None
        fact("deposit", "Deposit", f"{dep} of your offer" if dep_pct else str(dep), dep_pct, f"Cauzione: {dep}",
             f"Deposit: {dep}" + (" of the amount you offer" if dep_pct else ""))
    court_raw = proc.get("descUfficio") or item.get("tribunale")
    court = court_name(court_raw)
    case = None
    if proc.get("numeRg") and proc.get("numeAnnoRg"):
        case = f"R.G.E. {proc['numeRg']}/{proc['numeAnnoRg']}"
    if court:
        lot_no = lotto.get("codLotto") or item.get("numeroLotto")
        q = court_raw + (f", {case}" if case else "") + (f", lotto {lot_no}" if lot_no else "")
        shown = court + (f", {case}" if case else "") + (f", lot {lot_no}" if lot_no else "")
        fact("court", "Court and case", shown, None, q, shown.replace("Tribunale di", "Court of"))
        if lot_no and case:
            case = f"{case}, lotto {lot_no}"

    surface = land = None
    for b in beni:
        if b.get("superficie") and ptype != "land":
            v = parse_num(str(b["superficie"]))
            if v and 15 <= v <= 3000:
                surface = v
                fact("surface_sqm", "Surface", f"{v:,.0f} m²", v, f"Superficie: {b['superficie']} mq", f"Surface: {v:,.0f} m²")
                break
    if surface is None:
        hit = find_sqm(texts, land=ptype == "land")
        if hit:
            v, snippet = hit
            if ptype == "land":
                land = v
                fact("land_sqm", "Land", f"{v:,.0f} m²", v, snippet, f"Land: {v:,.0f} m²")
            else:
                surface = v
                fact("surface_sqm", "Surface", f"{v:,.0f} m²", v, snippet, f"Surface: about {v:,.0f} m² as described")
    if desc:
        fact("description", "Official description", desc[:400], None, desc[:1000], "Official description of the lot, in Italian")

    discount = None
    if appraisal and min_offer and min_offer < appraisal:
        discount = round((1 - min_offer / appraisal) * 100)

    photos = []
    for b in beni:
        for a in b.get("allegati") or []:
            link = a.get("linkAllegato") or ""
            if link.startswith("/immagini-beni") and len(photos) < 12:
                photos.append(file_url(link))
    attachments = []
    for a in det.get("allegati") or []:
        u = file_url(a.get("linkAllegato"))
        if u:
            attachments.append({"kind": ATTACHMENT_KIND.get(a.get("codiceTipoAllegato") or "", "other"),
                                "name": a.get("descrizione") or a.get("nomeFile") or "Document", "url": u})
    contacts = []
    for s in det.get("soggetti") or []:
        role = CONTACT_ROLES.get((s.get("ruolo") or "").upper(), (s.get("ruolo") or "").title() or None)
        if not role:
            continue
        name = " ".join(x for x in (s.get("nome"), s.get("cognome")) if x).strip()
        if name or s.get("email"):
            contacts.append({"role": role, "name": name or None, "email": s.get("email"),
                             "phone": s.get("cellulare") or s.get("telefono"), "handles_visits": bool(s.get("soggVisitaBene"))})

    where = f"{comune} ({prov})" if comune and prov else (comune or prov or "Italy")
    title = f"{TYPE_EN[ptype]} in {where}" + (f", {surface:,.0f} m²" if surface else "")
    summary_bits = [f"Court-ordered sale ({court})." if court else "Court-ordered sale."]
    if price:
        s = f"Base price {eur_en(price)}"
        if min_offer:
            s += f", offers valid from {eur_en(min_offer)}"
        if appraisal:
            s += f"; the court's expert valued it at {eur_en(appraisal)}"
        summary_bits.append(s + ".")
    if sale_d:
        summary_bits.append(f"Sale on {en_date(sale_d)}.")

    url = PAGE.format(id=sid)
    pub = it_date(det.get("dataDiPubblicazione")) or it_date(item.get("dataPubblicazione"))
    document = {
        "source_id": "pvp", "url": url, "part": "", "status": "extracted", "language": "it",
        "title": f"Portale Vendite Pubbliche, {court or 'vendita'}" + (f", {case}" if case else ""),
        "published_at": pub.isoformat() if pub else None,
        "text_content": "\n\n".join(t for t in texts if t)[:20000],
        "meta": {"pvp_id": sid, "esito": item.get("esito")},
    }
    listing = {
        "external_id": f"pvp:{sid}", "country": "IT", "region": region_for(prov), "province": prov, "comune": comune,
        "address": via, "lot": str(lotto.get("codLotto") or item.get("numeroLotto") or "") or None,
        "lat": coord.get("latitudine"), "lng": coord.get("longitudine"),
        "title_en": title, "summary_en": " ".join(summary_bits),
        "property_type": ptype, "sale_type": "auction_judicial",
        "price_eur": price, "min_offer_eur": min_offer, "appraisal_eur": appraisal, "discount_pct": discount,
        "surface_sqm": surface, "land_sqm": land,
        "deposit_eur": round(min_offer * dep_pct / 100) if (min_offer and dep_pct) else None,
        "deadline_at": deadline_d.isoformat() if deadline_d else None,
        "auction_at": sale_d.isoformat() if sale_d else None,
        "occupancy": OCCUPANCY.get(occ_code or "", "unknown"),
        "court": court, "case_ref": case, "sale_mode": SALE_MODE_EN.get(det.get("descModVendita") or "", det.get("descModVendita")),
        "contacts": contacts, "attachments": attachments, "photo_urls": photos,
        "hero_image_path": photos[0] if photos else None,
        "is_demo": False,
    }
    return {"document": document, "listing": listing, "facts": facts}


def _fingerprint(item: dict) -> str:
    return f"{item.get('prezzoBaseAsta')}|{item.get('dataVendita')}|{item.get('esito')}"


# ---------- run ----------

def collect(db: Supa, max_price: float = 300_000, horizon_days: int = 400, detail_limit: int = 6000,
            workers: int = 10, api: Api | None = None, today: date | None = None, log=print) -> dict:
    today = today or date.today()
    api = api or Api(delay=0.2)  # at most 5 requests a second; the portal is slow, so several run in parallel
    started = time.monotonic()
    stats = {"upcoming": 0, "new": 0, "updated": 0, "unchanged": 0, "closed": 0, "errors": 0, "deferred": 0}
    body = {"tipoLotto": "IMMOBILI", "nazione": "ITA"}
    if max_price:
        body["prezzoBaseAstaMax"] = max_price
    items = upcoming(api, body, today, today + timedelta(days=horizon_days), log)
    stats["upcoming"] = len(items)

    known: dict[str, dict] = {}
    for r in db.select("documents", {"select": "id,meta", "source_id": eq("pvp")}):
        pid = (r.get("meta") or {}).get("pvp_id")
        if pid is not None:
            known[str(pid)] = r

    todo, closing = [], []
    for it in items:
        esito = (it.get("esito") or "").upper()
        k = known.get(str(it["id"]))
        if esito in CLOSED_ESITI:
            if k:
                closing.append((it, CLOSED_ESITI[esito]))
            continue
        if k and (k.get("meta") or {}).get("fp") == _fingerprint(it):
            stats["unchanged"] += 1
            continue
        todo.append(it)
    if len(todo) > detail_limit:
        stats["deferred"] = len(todo) - detail_limit
        todo = todo[:detail_limit]  # nearest sales first; the rest next run
    log(f"  {len(items)} upcoming under €{max_price:,.0f}; reading {len(todo)} new or changed lots"
        + (f", {stats['deferred']} left for the next run" if stats["deferred"] else ""))

    for it, status in closing:
        lid = f"pvp:{it['id']}"
        db.update("listings", {"external_id": eq(lid)}, {"status": status})
        stats["closed"] += 1

    def fetch(it):
        try:
            return it, api.detail(it["id"]), None
        except Exception as e:  # noqa: BLE001
            return it, None, e

    batch: list[dict] = []

    def flush():
        if not batch:
            return
        docs = db.upsert("documents", [b["document"] for b in batch], on_conflict="url,part")
        doc_id = {d["url"]: d["id"] for d in docs}
        rows = []
        for b in batch:
            row = dict(b["listing"])
            row["document_id"] = doc_id.get(b["document"]["url"])
            rows.append(row)
        saved = db.upsert("listings", rows, on_conflict="external_id")
        lid = {r["external_id"]: r["id"] for r in saved}
        ids = list(lid.values())
        if ids:
            db.delete("listing_facts", {"listing_id": in_(ids)})
        facts = [{"listing_id": lid[b["listing"]["external_id"]], **f} for b in batch
                 if b["listing"]["external_id"] in lid for f in b["facts"]]
        for i in range(0, len(facts), 500):
            db.insert("listing_facts", facts[i : i + 500], returning=False)
        batch.clear()

    done = 0
    with ThreadPoolExecutor(max_workers=workers) as ex:
        for it, det, err in ex.map(fetch, todo):
            done += 1
            if err or det is None:
                stats["errors"] += 1
                if stats["errors"] <= 5:
                    log(f"  error reading sale {it['id']}: {err}")
                continue
            rec = build(it, det, today)
            rec["document"]["meta"]["fp"] = _fingerprint(it)
            if str(it["id"]) in known:
                stats["updated"] += 1
            else:
                stats["new"] += 1
            batch.append(rec)
            if len(batch) >= 50:
                try:
                    flush()
                except Exception as e:  # noqa: BLE001  keep going; these lots are retried next run
                    stats["errors"] += len(batch)
                    log(f"  error saving a batch: {str(e)[:200]}")
                    batch.clear()
            if done % 500 == 0:
                rate = done / max(1.0, time.monotonic() - started) * 60
                log(f"  {done}/{len(todo)} lots read ({rate:.0f} a minute)")
    flush()
    return stats
