"""Deep dive on a starred listing: read the court appraisal report with rules, no AI.

Only listings someone has starred are read (the deep_dives queue). The report is downloaded, its
text extracted, and every sentence that mentions a known problem is stored as a red flag with the
Italian sentence verbatim and its page. Nothing is paraphrased or guessed, and it costs nothing
per listing beyond the download.
"""
from __future__ import annotations

import re
from datetime import datetime, timezone

from . import http
from .perizia import MAX_PDF, appraisal_url, pdf_pages
from .supa import Supa, eq

# (English label, severity, pattern). Patterns run on lowercased text.
RULES: list[tuple[str, str, str]] = [
    ("The report mentions building work without permits or not matching the approved plans", "high",
     r"abus\w* edilizi|opere abusive|difformit\w* (urbanistic|edilizi)|non sanabil|non conform\w* (urbanistic|edilizi)"),
    ("The report mentions a land registry mismatch", "medium", r"difformit\w* catastal|non conform\w* catastal|non corrispond\w* (alla|con la) planimetria"),
    ("The report mentions regularisation (sanatoria or condono) and its cost", "medium", r"sanatoria|condono|costi? (di|per la) regolarizzazione|oneri di regolarizzazione"),
    ("The report mentions unpaid condominium fees", "medium", r"spese condominiali (insolut|non pagat|arretrat|scadut)|morosit\w*|insoluti condominiali"),
    ("The report mentions that the property is occupied or let", "high", r"\boccupat[oa]\b|locazione|contratto di affitto|comodato"),
    ("The report mentions partial ownership or someone else's right to live there", "high",
     r"diritto di abitazione|assegnazion\w* (della )?casa coniugale|nuda propriet|usufrutt|quota (di|pari a) \d"),
    ("The report mentions an easement", "low", r"servit[uù]"),
    ("The report mentions a planning or heritage restriction", "low", r"vincol\w* (paesaggistic|storic|archeologic|idrogeologic|monumental)"),
    ("The report mentions asbestos", "high", r"amianto|eternit"),
    ("The report mentions damp or water infiltration", "medium", r"umidit[aà] di risalita|infiltrazion|muffa|umidit[aà]"),
    ("The report mentions cracks or structural problems", "high", r"crepe|fessurazion|lesioni (struttural|nelle murature|sulle pareti)|dissest|problemi statici"),
    ("The report mentions there is no direct access", "high", r"intercluso|interclusa"),
    ("The report mentions a missing habitability certificate", "medium", r"(privo|priva|mancanza|assenza) (del certificato |della dichiarazione )?di (agibilit|abitabilit)|non (è|risulta) (agibile|abitabile)"),
    ("The report mentions systems not to code", "medium", r"impiant\w* non (conform|a norma|certificat)|privi di (certificazion|dichiarazion)\w* di conformit"),
]
COMPILED = [(label, sev, re.compile(p)) for label, sev, p in RULES]
NEGATION = re.compile(r"\b(non (\w+ ){0,3}(rilevat|riscontrat|risult|present|emers|evidenziat|sussist)\w*|nessun\w*|assenza di|esente da|liber[oa] da|privo di (vizi|abusi))")
SENT_SPLIT = re.compile(r"(?<=[.;])\s+(?=[A-ZÀ-Ý0-9])|\n{2,}")
PER_RULE = 2
MAX_FLAGS = 14


def sentences(page: str) -> list[str]:
    out = []
    for s in SENT_SPLIT.split(page):
        s = " ".join(s.split())
        if 25 <= len(s) <= 420:
            out.append(s)
        elif len(s) > 420:
            out.extend(" ".join(c.split()) for c in re.split(r"(?<=[,:])\s+", s) if 25 <= len(c) <= 420)
    return out


def scan(pages: list[str]) -> list[dict]:
    """Red flags from the report text: first matching sentences per rule, skipping negated ones."""
    found: dict[str, list[dict]] = {}
    seen: set[str] = set()
    for pno, page in enumerate(pages, 1):
        for s in sentences(page):
            low = s.lower()
            for label, sev, rx in COMPILED:
                m = rx.search(low)
                if not m or len(found.get(label, [])) >= PER_RULE or s in seen:
                    continue
                if NEGATION.search(low[max(0, m.start() - 70): m.start()]) or NEGATION.search(low[m.end(): m.end() + 30]):
                    continue
                found.setdefault(label, []).append({"flag_en": label, "severity": sev, "quote": s, "page": pno})
                seen.add(s)
    order = {"high": 0, "medium": 1, "low": 2}
    flags = [f for fs in found.values() for f in fs]
    return sorted(flags, key=lambda f: (order[f["severity"]], f["page"]))[:MAX_FLAGS]


def dive(db: Supa, listing: dict) -> dict:
    url = appraisal_url(listing)
    if not url:
        return {"status": "no_document", "note": "No appraisal report published"}
    body, _, _ = http.get(url, max_age_hours=24 * 60)
    if len(body) > MAX_PDF or body[:5] != b"%PDF-":
        return {"status": "error", "note": "Appraisal link is not a readable PDF"}
    pages = pdf_pages(body)
    if sum(len(p) for p in pages) < 1500:
        return {"status": "no_text", "pages": len(pages), "note": "Scanned report, no text layer"}
    flags = scan(pages)
    db.delete("listing_red_flags", {"listing_id": eq(listing["id"]), "origin": eq("rules")})
    if flags:
        db.insert("listing_red_flags", [{"listing_id": listing["id"], "origin": "rules", "doc_url": url, "quote_en": None, **f} for f in flags],
                  returning=False)
    return {"status": "done", "pages": len(pages), "flags": len(flags)}


def enqueue_top(db: Supa, n: int) -> int:
    """Queue the n best open court sales that have no deep dive yet."""
    have = {r["listing_id"] for r in db.select("deep_dives", {"select": "listing_id"})}
    rows = db.select("listings", {"select": "id", "external_id": "like.pvp:*", "status": "in.(active,closing_soon)",
                                  "order": "score.desc", "limit": str(n * 5)})
    ids = [r["id"] for r in rows if r["id"] not in have][:n]
    if ids:
        db.insert("deep_dives", [{"listing_id": i} for i in ids], returning=False)
    return len(ids)


def run(db: Supa, limit: int = 30, log=print) -> dict:
    queue = db.select("deep_dives", {"select": "listing_id", "status": "in.(pending,running)", "order": "requested_at.asc", "limit": str(limit)})
    stats = {"queued": len(queue), "done": 0, "no_text": 0, "no_document": 0, "error": 0}
    log(f"Deep dives: {len(queue)} starred listings to read")
    for q in queue:
        lid = q["listing_id"]
        db.update("deep_dives", {"listing_id": eq(lid)}, {"status": "running"})
        rows = db.select("listings", {"select": "id,attachments", "id": eq(lid)})
        try:
            res = dive(db, rows[0]) if rows else {"status": "no_document", "note": "Listing not found"}
        except Exception as e:  # noqa: BLE001
            res = {"status": "error", "note": str(e)[:300]}
        stats[res["status"]] += 1
        db.update("deep_dives", {"listing_id": eq(lid)}, {
            "status": res["status"], "pages": res.get("pages"), "flags": res.get("flags"), "note": res.get("note"),
            "done_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        })
        log(f"  {lid}: {res['status']} {res.get('flags', '')} {res.get('note', '')}")
    return stats
