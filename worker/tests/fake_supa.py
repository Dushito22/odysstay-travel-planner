"""In-memory stand-in for the Supabase REST client, supporting the filters the worker uses."""
import copy
import json
import uuid

DEFAULTS = {
    "listings": {"status": "active", "score": None, "score_reasons": [], "lat": None, "lng": None, "is_demo": False},
    "documents": {"status": "new", "error": None, "meta": {}},
}


def _match(row: dict, key: str, expr: str) -> bool:
    if key in ("select", "order", "limit", "offset"):
        return True
    v = row.get(key)
    if expr == "is.null":
        return v is None
    if expr == "not.is.null":
        return v is not None
    op, _, val = expr.partition(".")
    sv = None if v is None else (str(v).lower() if isinstance(v, bool) else str(v))
    if op == "eq":
        return sv == val
    if op == "neq":
        return sv != val
    if op == "in":
        return sv in [json.loads(x) if x.startswith('"') else x for x in val.strip("()").split(",") if x]
    if op == "not" and val.startswith("in."):
        return not _match(row, key, val)
    if op == "gt":
        return v is not None and float(v) > float(val)
    raise ValueError(expr)


class FakeSupa:
    def __init__(self):
        self.tables: dict[str, list[dict]] = {}

    def _rows(self, t):
        return self.tables.setdefault(t, [])

    def select(self, table, params=None):
        params = params or {}
        out = [copy.deepcopy(r) for r in self._rows(table) if all(_match(r, k, v) for k, v in params.items())]
        if "limit" in params:
            out = out[: int(params["limit"])]
        return out

    def insert(self, table, rows, returning=True):
        rows = [rows] if isinstance(rows, dict) else rows
        out = []
        for r in rows:
            row = {**DEFAULTS.get(table, {}), "id": str(uuid.uuid4()), **copy.deepcopy(r)}
            self._rows(table).append(row)
            out.append(copy.deepcopy(row))
        return out if returning else []

    def upsert(self, table, rows, on_conflict, ignore_duplicates=False):
        keys = on_conflict.split(",")
        out = []
        for r in rows:
            existing = next((x for x in self._rows(table) if all(x.get(k) == r.get(k) for k in keys)), None)
            if existing:
                if not ignore_duplicates:
                    existing.update(copy.deepcopy(r))
                    out.append(copy.deepcopy(existing))
            else:
                out += self.insert(table, r)
        return out

    def update(self, table, filters, patch):
        hit = [r for r in self._rows(table) if all(_match(r, k, v) for k, v in filters.items())]
        for r in hit:
            r.update(copy.deepcopy(patch))
        return copy.deepcopy(hit)

    def delete(self, table, filters):
        self.tables[table] = [r for r in self._rows(table) if not all(_match(r, k, v) for k, v in filters.items())]
