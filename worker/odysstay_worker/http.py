"""Polite HTTP client: identifies itself, waits between requests to the same host,
retries transient failures and caches responses on disk."""
import hashlib
import threading
import time
from pathlib import Path
from urllib.parse import urlparse

import httpx

from .config import CACHE_DIR, HOST_DELAY, USER_AGENT

_locks: dict[str, threading.Lock] = {}
_last: dict[str, float] = {}
_guard = threading.Lock()

_client = httpx.Client(
    headers={"User-Agent": USER_AGENT, "Accept-Language": "it-IT,it;q=0.9,en;q=0.5"},
    follow_redirects=True,
    timeout=httpx.Timeout(30.0, connect=15.0),
)


def _wait_turn(host: str):
    with _guard:
        lock = _locks.setdefault(host, threading.Lock())
    lock.acquire()
    try:
        gap = time.monotonic() - _last.get(host, 0)
        if gap < HOST_DELAY:
            time.sleep(HOST_DELAY - gap)
        _last[host] = time.monotonic()
    finally:
        lock.release()


def _cache_path(url: str) -> Path:
    return CACHE_DIR / hashlib.sha256(url.encode()).hexdigest()


def get(url: str, *, use_cache: bool = True, max_age_hours: float = 20, retries: int = 2) -> tuple[bytes, str, str]:
    """Return (body, content_type, final_url). Raises httpx.HTTPError on failure."""
    cp = _cache_path(url)
    meta = cp.with_suffix(".meta")
    if use_cache and cp.exists() and meta.exists() and (time.time() - cp.stat().st_mtime) < max_age_hours * 3600:
        ctype, final = meta.read_text().split("\n", 1)
        return cp.read_bytes(), ctype, final

    host = urlparse(url).netloc
    last_err = None
    for attempt in range(retries + 1):
        _wait_turn(host)
        try:
            r = _client.get(url)
            if r.status_code in (429, 500, 502, 503, 504) and attempt < retries:
                time.sleep(3 * (attempt + 1))
                continue
            r.raise_for_status()
            ctype = r.headers.get("content-type", "").split(";")[0].strip().lower()
            cp.write_bytes(r.content)
            meta.write_text(f"{ctype}\n{r.url}")
            return r.content, ctype, str(r.url)
        except httpx.HTTPError as e:
            last_err = e
            if attempt < retries:
                time.sleep(2 * (attempt + 1))
    raise last_err
