"""Tests candidate listing sources from the worker's own network: can we read them, are we blocked,
what does robots.txt allow, and is the data in the HTML or behind an API. Diagnostic only."""
from __future__ import annotations

import re
import urllib.robotparser
from urllib.parse import urlparse

import httpx

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
CANDIDATES = {
    "idealista": "https://www.idealista.it/vendita-case/sicilia/",
    "immobiliare": "https://www.immobiliare.it/vendita-case/palermo/",
    "casa.it": "https://www.casa.it/vendita/residenziale/palermo/",
    "subito": "https://www.subito.it/annunci-sicilia/vendita/immobili/",
    "gate-away": "https://www.gate-away.com/properties/italy/sicily/",
    "kyero": "https://www.kyero.com/en/sicily-property-for-sale-0l55578",
    "green-acres": "https://www.green-acres.it/en/properties/sicily",
    "rightmove-overseas": "https://www.rightmove.co.uk/overseas-property/in-Sicily.html",
    "casea1euro": "https://www.casea1euro.it/",
    "avvisinotarili": "https://www.avvisinotarili.it/",
    "astegiudiziarie": "https://www.astegiudiziarie.it/",
    "asteannunci": "https://www.asteannunci.it/",
    "fallcoaste": "https://www.fallcoaste.it/",
    "demanio": "https://www.agenziademanio.it/it/vendite/",
    "ismea-terre": "https://www.ismea.it/banca-delle-terre",
    "tecnocasa": "https://www.tecnocasa.it/annunci/immobili/sicilia/palermo.html",
    "wikicasa": "https://www.wikicasa.it/vendita-case/palermo/",
}
BLOCK = re.compile(r"datadome|captcha|cf-chl|Just a moment|Access denied|blocked|px-captcha|perimeterx|incapsula", re.I)


def robots_ok(url: str) -> str:
    p = urlparse(url)
    rp = urllib.robotparser.RobotFileParser()
    try:
        r = httpx.get(f"{p.scheme}://{p.netloc}/robots.txt", headers={"User-Agent": UA}, timeout=20, follow_redirects=True)
        if r.status_code >= 400:
            return f"robots {r.status_code}"
        rp.parse(r.text.splitlines())
        return "robots allows" if rp.can_fetch("*", url) else "robots DISALLOWS"
    except Exception as e:  # noqa: BLE001
        return f"robots error {type(e).__name__}"


def run(log=print):
    for name, url in CANDIDATES.items():
        try:
            r = httpx.get(url, headers={"User-Agent": UA, "Accept-Language": "it-IT,it;q=0.9,en;q=0.8",
                                        "Accept": "text/html,application/xhtml+xml"}, timeout=30, follow_redirects=True)
            body = r.text
            title = (re.search(r"<title[^>]*>(.*?)</title>", body, re.S | re.I) or [None, ""])[1].strip()[:80]
            hints = [h for h, rx in (("json-ld", r"application/ld\+json"), ("next-data", r"__NEXT_DATA__"),
                                    ("nuxt", r"__NUXT__"), ("api-json", r"/api/"), ("sitemap", r"sitemap")) if re.search(rx, body)]
            blocked = bool(BLOCK.search(body[:5000])) and r.status_code != 200 or r.status_code in (401, 403, 429)
            prices = len(re.findall(r"€\s?\d{1,3}(?:\.\d{3})+|\d{1,3}(?:\.\d{3})+\s?€", body))
            log(f"{name}: HTTP {r.status_code}, {len(body)//1024} KB, prices on page {prices}, "
                f"{'BLOCKED' if blocked else 'readable'}, {robots_ok(url)}, hints {','.join(hints) or '-'}, title {title!r}")
        except Exception as e:  # noqa: BLE001
            log(f"{name}: error {type(e).__name__} {str(e)[:120]}")
