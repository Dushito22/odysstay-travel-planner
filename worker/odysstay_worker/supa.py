"""Minimal Supabase REST client (PostgREST) using the service key. Only the worker uses this."""
from __future__ import annotations

import json
import time
from typing import Any

import httpx

from . import config


class Supa:
    def __init__(self, url: str | None = None, key: str | None = None, client: httpx.Client | None = None):
        self.url = (url or config.SUPABASE_URL).rstrip("/")
        key = key or config.SUPABASE_SERVICE_KEY
        if not self.url or not key:
            raise SystemExit("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in worker/.env")
        headers = {"apikey": key, "Content-Type": "application/json"}
        if key.startswith("eyJ"):  # legacy JWT service_role key
            headers["Authorization"] = f"Bearer {key}"
        self.http = client or httpx.Client(base_url=f"{self.url}/rest/v1", headers=headers, timeout=60)

    def _send(self, method: str, url: str, **kw) -> httpx.Response:
        """One request with retries on dropped connections and 5xx, which happen on long runs."""
        for attempt in range(5):
            try:
                r = self.http.request(method, url, **kw)
                if r.status_code in (502, 503, 504) and attempt < 4:
                    time.sleep(2 * (attempt + 1))
                    continue
                return r
            except (httpx.TransportError, httpx.TimeoutException):
                if attempt == 4:
                    raise
                time.sleep(2 * (attempt + 1))
        raise RuntimeError("unreachable")

    def _check(self, r: httpx.Response):
        if r.status_code >= 400:
            raise RuntimeError(f"Supabase {r.request.method} {r.request.url.path}: {r.status_code} {r.text[:500]}")
        return r

    def select(self, table: str, params: dict[str, str] | None = None) -> list[dict[str, Any]]:
        out, offset = [], 0
        while True:
            p = {"select": "*", **(params or {}), "offset": str(offset), "limit": "1000"}
            rows = self._check(self._send("GET", f"/{table}", params=p)).json()
            out.extend(rows)
            if len(rows) < 1000 or "limit" in (params or {}):
                return out
            offset += 1000

    def insert(self, table: str, rows: list[dict] | dict, returning: bool = True) -> list[dict]:
        if isinstance(rows, dict):
            rows = [rows]
        if not rows:
            return []
        prefer = "return=representation" if returning else "return=minimal"
        r = self._check(self._send("POST", f"/{table}", content=json.dumps(rows), headers={"Prefer": prefer}))
        return r.json() if returning else []

    def upsert(self, table: str, rows: list[dict], on_conflict: str, ignore_duplicates: bool = False) -> list[dict]:
        if not rows:
            return []
        res = "ignore-duplicates" if ignore_duplicates else "merge-duplicates"
        r = self._check(
            self._send(
                "POST",
                f"/{table}",
                params={"on_conflict": on_conflict},
                content=json.dumps(rows),
                headers={"Prefer": f"resolution={res},return=representation"},
            )
        )
        return r.json()

    def update(self, table: str, filters: dict[str, str], patch: dict) -> list[dict]:
        r = self._check(self._send("PATCH", f"/{table}", params=filters, content=json.dumps(patch), headers={"Prefer": "return=representation"}))
        return r.json()

    def delete(self, table: str, filters: dict[str, str]):
        self._check(self._send("DELETE", f"/{table}", params=filters))


def eq(v: Any) -> str:
    return f"eq.{v}"


def in_(values: list[str]) -> str:
    return "in.(" + ",".join(json.dumps(v) for v in values) + ")"
