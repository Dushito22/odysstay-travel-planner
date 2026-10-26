"""Comune websites: the hidden supply. Writes to Supabase tables `comuni` and `documents`.

discover(): builds the list of all ~7,900 comuni with region, province and official website,
            from ISTAT (names, regions) and IndicePA (official websites).
crawl():    visits each comune site, follows links that look like the notice board, tenders or
            property-sales sections, and pulls documents that look like property sales.

v0 uses one generic crawler for every site and records which website software each comune runs.
Per-vendor parsers come next, starting with the vendors that cover the most comuni.
"""
import csv
import io
import json
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup

from .. import http
from ..italy import region_for
from ..pdftext import to_text
from ..relevance import DOC_HINT, LINK_HINT, is_candidate
from ..supa import Supa, eq

ISTAT_CSV = "https://www.istat.it/storage/codici-unita-amministrative/Elenco-comuni-italiani.csv"
IPA_PACKAGE = "https://indicepa.gov.it/ipa-dati/api/3/action/package_show?id=enti"
IPA_FALLBACK = "https://indicepa.gov.it/ipa-dati/datastore/dump/d09adf99-dc10-4349-8c53-27b1e5aa97b6?bom=True"

CMS_MARKERS = [
    ("municipium", r"municipiumapp|municipium"),
    ("halley", r"halleyweb|halley"),
    ("maggioli", r"maggioli|jcitygov|cittadinanzattiva"),
    ("apkappa", r"apkappa|hypersic"),
    ("dedagroup", r"dedagroup|civilianext"),
    ("padigitale", r"pa ?digitale|urbi|halleypa"),
    ("nolanet", r"nolanet"),
    ("gruppo-spaggiari", r"spaggiari"),
    ("drupal-italia", r"design-comuni|bootstrap-italia|drupal"),
    ("wordpress", r"wp-content|wordpress"),
]
# Notice boards are often hosted on vendor domains, not the comune's own domain.
OFFSITE_OK = re.compile(r"municipiumapp|halleyweb|halley|maggioli|apkappa|servizionline|albopretorio|trasparenza|"
                        r"amministrazionetrasparente|dedagroup|cloud|portaleappalti|gov\.it", re.I)
MAX_PAGES = 10
MAX_DOCS = 20


def _col(header: list[str], *names) -> int | None:
    low = [h.strip().lower() for h in header]
    for n in names:
        for i, h in enumerate(low):
            if n in h:
                return i
    return None


def _read_csv(body: bytes) -> list[list[str]]:
    for enc in ("utf-8-sig", "latin-1"):
        try:
            text = body.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    delim = ";" if text[:2000].count(";") > text[:2000].count(",") else ","
    return list(csv.reader(io.StringIO(text), delimiter=delim))


def load_istat() -> dict[str, dict]:
    body, _, _ = http.get(ISTAT_CSV, max_age_hours=24 * 30)
    rows = _read_csv(body)
    h = rows[0]
    i_code = _col(h, "codice comune formato alfanumerico")
    i_name = _col(h, "denominazione in italiano", "denominazione (italiana e straniera)")
    i_reg = _col(h, "denominazione regione")
    i_prov = _col(h, "sigla automobilistica")
    out = {}
    for r in rows[1:]:
        if len(r) <= max(i_code, i_name):
            continue
        code = r[i_code].strip().zfill(6)
        prov = r[i_prov].strip() if i_prov is not None else ""
        out[code] = {
            "name": r[i_name].strip(),
            "province": prov,
            "region": region_for(prov) or (r[i_reg].strip() if i_reg is not None else None),
        }
    return out


def load_ipa_sites(log=print) -> dict[str, str]:
    url = None
    try:
        body, _, _ = http.get(IPA_PACKAGE, max_age_hours=24 * 7)
        pkg = json.loads(body)
        for res in pkg["result"]["resources"]:
            name = (res.get("name") or "").lower()
            if res.get("format", "").lower() == "csv" and "enti" in name:
                url = res["url"]
                break
    except Exception as e:
        log(f"  IndicePA catalogue lookup failed ({e}), trying direct file")
    url = url or IPA_FALLBACK
    body, _, _ = http.get(url, max_age_hours=24 * 7)
    rows = _read_csv(body)
    h = rows[0]
    i_istat = _col(h, "codice_comune_istat")
    i_site = _col(h, "sito_istituzionale")
    i_cat = _col(h, "codice_categoria")
    sites = {}
    for r in rows[1:]:
        if i_cat is not None and r[i_cat].strip() != "L6":  # L6 = comuni
            continue
        code, site = r[i_istat].strip(), r[i_site].strip()
        if not code or not site:
            continue
        if not site.startswith("http"):
            site = "https://" + site
        sites[code.zfill(6)] = site
    return sites


def discover(db: Supa, log=print) -> dict:
    log("Loading the ISTAT list of comuni...")
    istat = load_istat()
    log(f"  {len(istat)} comuni")
    log("Loading official websites from IndicePA...")
    try:
        sites = load_ipa_sites(log)
    except Exception as e:  # noqa: BLE001
        log(f"  IndicePA failed: {e}. Comuni are saved without websites; add them with: comuni import-sites file.csv")
        sites = {}
    log(f"  {len(sites)} websites")
    known = {r["istat"]: r for r in db.select("comuni", {"select": "istat,site"})}
    rows = []
    for code, c in istat.items():
        site = sites.get(code) or (known.get(code) or {}).get("site")
        rows.append({"istat": code, "name": c["name"], "province": c["province"], "region": c["region"], "site": site})
    for i in range(0, len(rows), 500):
        db.upsert("comuni", rows[i : i + 500], on_conflict="istat")
    return {"comuni": len(istat), "with_site": sum(1 for r in rows if r["site"])}


def import_sites(db: Supa, path: str) -> int:
    """CSV with columns istat,site, for when IndicePA is unreachable or wrong."""
    n = 0
    with open(path, newline="", encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            db.update("comuni", {"istat": eq(r["istat"].strip().zfill(6))}, {"site": r["site"].strip()})
            n += 1
    return n


def detect_cms(html: str) -> str:
    low = html.lower()
    for name, pat in CMS_MARKERS:
        if re.search(pat, low):
            return name
    return "unknown"


def _links(html: bytes, base: str) -> list[tuple[str, str]]:
    soup = BeautifulSoup(html, "html.parser")
    out = []
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        if href.startswith(("mailto:", "tel:", "javascript:", "#")):
            continue
        out.append((urljoin(base, href), " ".join(a.get_text(" ").split())[:200]))
    return out


def _link_priority(url: str, text: str) -> int:
    s = (url + " " + text).lower()
    score = 0
    for kw, w in (("alienazion", 10), ("vendita immobil", 9), ("aste", 6), ("asta", 6), ("1 euro", 8),
                  ("patrimonio", 5), ("albo", 5), ("bandi", 4), ("avvisi", 3), ("gare", 2), ("trasparen", 1)):
        if kw in s:
            score += w
    return score


def find_documents(c: dict) -> tuple[dict, dict[str, str]]:
    """Visit a comune site and return (result, {document_url: anchor_text}) for likely property notices."""
    site = c["site"]
    res = {"istat": c["istat"], "pages": 0, "docs": 0, "candidates": 0, "cms": None, "error": None}
    try:
        body, _ctype, final = http.get(site, max_age_hours=20)
    except Exception as e:  # noqa: BLE001
        res["error"] = f"home: {e}"[:300]
        return res, {}
    home_host = urlparse(final).netloc
    res["cms"] = detect_cms(body.decode("utf-8", "replace"))
    candidates = [(u, t) for u, t in _links(body, final) if LINK_HINT.search(u + " " + t)]
    candidates = [(u, t) for u, t in candidates if urlparse(u).netloc == home_host or OFFSITE_OK.search(u)]
    candidates.sort(key=lambda x: -_link_priority(*x))
    seen, doc_links = set(), {}
    for url, _ in candidates:
        if len(seen) >= MAX_PAGES:
            break
        if url in seen:
            continue
        seen.add(url)
        try:
            pbody, pctype, pfinal = http.get(url, max_age_hours=20)
        except Exception:  # noqa: BLE001
            continue
        res["pages"] += 1
        if "html" not in pctype:
            doc_links.setdefault(url, "")
            continue
        for du, dt in _links(pbody, pfinal):
            if DOC_HINT.search(dt) or (du.lower().endswith(".pdf") and DOC_HINT.search(du)):
                doc_links.setdefault(du, dt)
    ranked = dict(sorted(doc_links.items(), key=lambda x: -_link_priority(*x))[:MAX_DOCS])
    return res, ranked


def read_document(url: str) -> tuple[str, str]:
    """Returns (status, text)."""
    dbody, dctype, dfinal = http.get(url, max_age_hours=24 * 7)
    text = to_text(dbody, dctype, dfinal)
    if len(text) < 80 and ("pdf" in dctype or url.lower().endswith(".pdf")):
        return "needs_ocr", text  # scanned PDF with no text layer
    return ("candidate" if is_candidate(text) else "irrelevant"), text


def crawl_one(db: Supa, c: dict, seen_urls: set[str]) -> dict:
    res, links = find_documents(c)
    rows = []
    for url, anchor in links.items():
        if url in seen_urls:
            continue
        seen_urls.add(url)
        try:
            status, text = read_document(url)
        except Exception as e:  # noqa: BLE001
            status, text = "error", ""
            anchor = anchor or str(e)[:200]
        res["docs"] += 1
        res["candidates"] += int(status == "candidate")
        rows.append({
            "source_id": "comune", "url": url, "part": "", "status": status, "language": "it",
            "title": (anchor or None) and f"Comune di {c['name']}: {anchor}"[:300],
            "text_content": text if status in ("candidate", "needs_ocr") else None,
            "meta": {"istat": c["istat"], "comune": c["name"], "province": c["province"], "region": c["region"], "anchor": anchor},
        })
    db.upsert("documents", rows, on_conflict="url,part", ignore_duplicates=True)
    db.update("comuni", {"istat": eq(c["istat"])}, {
        "cms": res["cms"], "last_crawl": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "docs_found": res["candidates"], "note": res["error"],
    })
    return res


def crawl(db: Supa, region: str | None = None, limit: int | None = None, workers: int = 8, log=print) -> dict:
    params = {"select": "*", "site": "not.is.null", "order": "last_crawl.asc.nullsfirst,istat.asc"}
    if region:
        params["region"] = eq(region)
    comuni = db.select("comuni", params)
    if limit:
        comuni = comuni[:limit]
    seen = {r["url"] for r in db.select("documents", {"select": "url", "source_id": eq("comune")})}
    log(f"Crawling {len(comuni)} comuni with {workers} workers ({len(seen)} documents already known)...")
    totals = {"comuni": len(comuni), "pages": 0, "docs": 0, "candidates": 0, "errors": 0}
    with ThreadPoolExecutor(max_workers=workers) as ex:
        futs = {ex.submit(crawl_one, db, c, seen): c for c in comuni}
        for i, f in enumerate(as_completed(futs), 1):
            c = futs[f]
            try:
                r = f.result()
            except Exception as e:  # noqa: BLE001
                totals["errors"] += 1
                log(f"  [{i}/{len(comuni)}] {c['name']}: failed ({e})")
                continue
            for k in ("pages", "docs", "candidates"):
                totals[k] += r[k]
            totals["errors"] += int(bool(r["error"]))
            if r["candidates"]:
                log(f"  [{i}/{len(comuni)}] {c['name']} ({c['province']}): {r['candidates']} property documents")
            elif i % 50 == 0:
                log(f"  [{i}/{len(comuni)}] ...")
    return totals


def cms_report(db: Supa) -> list[dict]:
    rows = db.select("comuni", {"select": "cms,docs_found,note,last_crawl", "site": "not.is.null"})
    agg: dict[str, dict] = {}
    for r in rows:
        k = r["cms"] or ("not crawled" if not r["last_crawl"] else "unknown")
        a = agg.setdefault(k, {"cms": k, "comuni": 0, "docs": 0, "errors": 0})
        a["comuni"] += 1
        a["docs"] += r["docs_found"] or 0
        a["errors"] += int(bool(r["note"]))
    return sorted(agg.values(), key=lambda a: -a["comuni"])
