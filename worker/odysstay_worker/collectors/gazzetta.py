"""Gazzetta Ufficiale, 5th special series (public contracts).

Public bodies publish their larger property auctions here. Issues come out Monday, Wednesday
and Friday. Each issue is one PDF holding many notices, each ending with a code like (TX26BIA374).
We split each issue into notices and keep only the ones that look like property sales.
"""
from __future__ import annotations

import re
from datetime import date, timedelta

from .. import http
from ..pdftext import pdf_to_text
from ..relevance import is_candidate
from ..supa import Supa, eq

BASE = "https://www.gazzettaufficiale.it"
LAST_30 = BASE + "/30giorni/contratti"
ARCHIVE = BASE + "/ricercaArchivioCompleto/contratti/{y}?anno={y}"
ISSUE_RE = re.compile(r"n[°º]\s*(\d+)\s+del\s+(\d{2})-(\d{2})-(\d{4})")
CODE_RE = re.compile(r"\(?\b(TX\d{2}[A-Z]{3}\d{2,6})\b\)?")


def pdf_url(num: int, d: date) -> str:
    return f"{BASE}/eli/gu/{d:%Y/%m/%d}/{num}/s5/pdf"


def parse_issue_list(html: str, since: date) -> list[tuple[int, date]]:
    found = set()
    for m in ISSUE_RE.finditer(html):
        num, dd, mm, yyyy = int(m[1]), int(m[2]), int(m[3]), int(m[4])
        try:
            d = date(yyyy, mm, dd)
        except ValueError:
            continue
        if d >= since:
            found.add((num, d))
    return sorted(found, key=lambda x: x[1])


def list_issues(days: int) -> list[tuple[int, date]]:
    since = date.today() - timedelta(days=days)
    pages = [LAST_30]
    if days > 28:
        pages += [ARCHIVE.format(y=y) for y in sorted({since.year, date.today().year})]
    out = set()
    for url in pages:
        body, _, _ = http.get(url, max_age_hours=6)
        out.update(parse_issue_list(body.decode("utf-8", "replace"), since))
    return sorted(out, key=lambda x: x[1])


def split_notices(text: str) -> list[tuple[str, str]]:
    """[(code, notice_text)]. A notice runs from the end of the previous one to the last occurrence of
    its own code (the first occurrence is usually in the table of contents)."""
    last_pos: dict[str, int] = {}
    for m in CODE_RE.finditer(text):
        last_pos[m.group(1)] = m.end()
    out, start = [], 0
    for code, end in sorted(last_pos.items(), key=lambda kv: kv[1]):
        chunk = text[start:end].strip()
        start = end
        if len(chunk) > 200:
            out.append((code, chunk))
    return out


def collect(db: Supa, days: int = 14, log=print) -> dict:
    stats = {"issues": 0, "notices": 0, "candidates": 0, "errors": 0}
    issues = list_issues(days)
    done = {r["url"] for r in db.select("documents", {"select": "url", "source_id": eq("gazzetta"), "part": eq("__issue__")})}
    log(f"Gazzetta: {len(issues)} issues in the last {days} days, {sum(1 for n, d in issues if pdf_url(n, d) in done)} already read")
    for num, d in issues:
        url = pdf_url(num, d)
        if url in done:
            continue
        try:
            body, ctype, _ = http.get(url, max_age_hours=24 * 30)
            if not body.startswith(b"%PDF"):
                raise ValueError(f"not a PDF ({ctype})")
            text = pdf_to_text(body)
        except Exception as e:  # noqa: BLE001
            stats["errors"] += 1
            log(f"  n.{num} {d}: error {e}")
            continue
        stats["issues"] += 1
        notices = split_notices(text)
        rows = []
        for code, chunk in notices:
            stats["notices"] += 1
            if is_candidate(chunk):
                rows.append({
                    "source_id": "gazzetta", "url": url, "part": code, "status": "candidate", "language": "it",
                    "title": f"Gazzetta Ufficiale 5a serie n.{num} del {d:%d/%m/%Y}, avviso {code}",
                    "published_at": d.isoformat(), "text_content": chunk, "meta": {"issue": num, "code": code},
                })
        db.upsert("documents", rows, on_conflict="url,part", ignore_duplicates=True)
        stats["candidates"] += len(rows)
        # Marker so the issue is never downloaded again.
        db.upsert("documents", [{
            "source_id": "gazzetta", "url": url, "part": "__issue__", "status": "irrelevant",
            "published_at": d.isoformat(), "meta": {"notices": len(notices), "kept": len(rows)},
        }], on_conflict="url,part", ignore_duplicates=True)
        log(f"  n.{num} {d:%d/%m}: {len(notices)} notices, {len(rows)} property sales")
    return stats
