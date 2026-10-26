"""Gazzetta Ufficiale, 5th special series (public contracts).

Public bodies publish their larger property auctions here. Issues come out Monday, Wednesday
and Friday. Each issue is one PDF holding many notices, each ending with a code like (TX26BIA374).
We split each issue into notices and keep only the ones that look like property sales.
"""
from __future__ import annotations

import html as html_lib
import re
from datetime import date, timedelta
from urllib.parse import urljoin

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


_LINK_RE = re.compile(
    r"""href=["']([^"']*?dataPubblicazioneGazzetta=(\d{4})-?(\d{2})-?(\d{2})[^"']*?numeroGazzetta=(\d+)[^"']*)["']""",
    re.I,
)
_LINK_RE_REV = re.compile(
    r"""href=["']([^"']*?numeroGazzetta=(\d+)[^"']*?dataPubblicazioneGazzetta=(\d{4})-?(\d{2})-?(\d{2})[^"']*)["']""",
    re.I,
)


def parse_issue_list(html: str, since: date) -> list[tuple[int, date, str | None]]:
    """[(number, date, download_url)]. Reads the issue links (their URLs carry the date and number),
    and falls back to the visible "n° 121 del 23-10-2026" labels."""
    found: dict[tuple[int, date], str | None] = {}

    def add(num: int, d: date, href: str | None):
        if d < since:
            return
        key = (num, d)
        if href and "downloadPdf" in href:
            found[key] = href
        else:
            found.setdefault(key, None)

    for m in _LINK_RE.finditer(html):
        try:
            add(int(m[5]), date(int(m[2]), int(m[3]), int(m[4])), html_lib.unescape(m[1]))
        except ValueError:
            pass
    for m in _LINK_RE_REV.finditer(html):
        try:
            add(int(m[2]), date(int(m[3]), int(m[4]), int(m[5])), html_lib.unescape(m[1]))
        except ValueError:
            pass
    text = re.sub(r"\s+", " ", html_lib.unescape(re.sub(r"<[^>]+>", " ", html)))
    for m in ISSUE_RE.finditer(text):
        try:
            add(int(m[1]), date(int(m[4]), int(m[3]), int(m[2])), None)
        except ValueError:
            pass
    out = []
    for (num, d), href in sorted(found.items(), key=lambda kv: kv[0][1]):
        out.append((num, d, urljoin(BASE + "/", href) if href else None))
    return out


def list_issues(days: int, log=print) -> list[tuple[int, date, str | None]]:
    since = date.today() - timedelta(days=days)
    pages = [LAST_30]
    if days > 28:
        pages += [ARCHIVE.format(y=y) for y in sorted({since.year, date.today().year})]
    out: dict[tuple[int, date], str | None] = {}
    for url in pages:
        body, _, _ = http.get(url, max_age_hours=6)
        page = body.decode("utf-8", "replace")
        got = parse_issue_list(page, since)
        if not got:
            i = page.find("numeroGazzetta")
            sample = page[max(0, i - 200) : i + 200] if i >= 0 else page[:400]
            log(f"  No issues recognised on {url} ({len(page)} chars). Sample: {' '.join(sample.split())[:400]}")
        for num, d, href in got:
            if href or (num, d) not in out:
                out[(num, d)] = href
    return [(n, d, h) for (n, d), h in sorted(out.items(), key=lambda kv: kv[0][1])]


def fetch_issue_pdf(num: int, d: date, download_url: str | None) -> bytes:
    """Tries the site's own download link first, then the stable /eli/ address."""
    last = None
    for url in [u for u in (download_url, pdf_url(num, d)) if u]:
        try:
            body, ctype, _ = http.get(url, max_age_hours=24 * 30)
            if body.startswith(b"%PDF"):
                return body
            last = ValueError(f"not a PDF from {url} ({ctype})")
        except Exception as e:  # noqa: BLE001
            last = e
    raise last or ValueError("no download link")


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
    issues = list_issues(days, log)
    done = {r["url"] for r in db.select("documents", {"select": "url", "source_id": eq("gazzetta"), "part": eq("__issue__")})}
    log(f"Gazzetta: {len(issues)} issues in the last {days} days, {sum(1 for n, d, _ in issues if pdf_url(n, d) in done)} already read")
    for num, d, download_url in issues:
        url = pdf_url(num, d)  # stable address, used as the document's identity and source link
        if url in done:
            continue
        try:
            text = pdf_to_text(fetch_issue_pdf(num, d, download_url))
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
