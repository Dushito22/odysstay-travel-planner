"""Odysstay worker: finds Italian public property notices and writes verified listings to Supabase.

  python -m odysstay_worker check                      test the Supabase connection
  python -m odysstay_worker gazzetta [--days 14]       collect auctions from the Gazzetta Ufficiale
  python -m odysstay_worker comuni discover            load all comuni and their official websites
  python -m odysstay_worker comuni crawl [--region R] [--limit N] [--workers 8]
  python -m odysstay_worker comuni report              which website software comuni run
  python -m odysstay_worker comuni import-sites FILE   fix or add websites (CSV columns: istat,site)
  python -m odysstay_worker extract [--limit 50]       read candidate notices with AI (needs ANTHROPIC_API_KEY)
  python -m odysstay_worker geocode                    put new listings on the map
  python -m odysstay_worker score                      rank listings and update open/closing/closed
  python -m odysstay_worker grants                     link regional grants to listings as possible fits
  python -m odysstay_worker status                     counts at a glance
  python -m odysstay_worker daily [--limit 200]        everything above, in order
"""
from __future__ import annotations

import argparse
import json
import sys

from .supa import Supa


def status(db: Supa):
    docs = db.select("documents", {"select": "source_id,status", "part": "neq.__issue__"})
    agg: dict[tuple, int] = {}
    for d in docs:
        agg[(d["source_id"], d["status"])] = agg.get((d["source_id"], d["status"]), 0) + 1
    print("Documents:")
    for (src, st), n in sorted(agg.items()):
        print(f"  {src:10} {st:11} {n}")
    comuni = db.select("comuni", {"select": "site,last_crawl"})
    print(f"Comuni: {len(comuni)} known, {sum(1 for c in comuni if c['site'])} with website, {sum(1 for c in comuni if c['last_crawl'])} crawled")
    listings = db.select("listings", {"select": "score,status", "is_demo": "eq.false"})
    print(f"Listings: {len(listings)} real ({sum(1 for l in listings if (l['score'] or 0) >= 70)} scoring 70+, "
          f"{sum(1 for l in listings if l['status'] != 'closed')} open)")


def main(argv=None):
    p = argparse.ArgumentParser(prog="odysstay_worker", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("check")
    g = sub.add_parser("gazzetta")
    g.add_argument("--days", type=int, default=14)
    c = sub.add_parser("comuni")
    cs = c.add_subparsers(dest="action", required=True)
    cs.add_parser("discover")
    cr = cs.add_parser("crawl")
    cr.add_argument("--region")
    cr.add_argument("--limit", type=int)
    cr.add_argument("--workers", type=int, default=8)
    cs.add_parser("report")
    imp = cs.add_parser("import-sites")
    imp.add_argument("file")
    e = sub.add_parser("extract")
    e.add_argument("--limit", type=int, default=50)
    e.add_argument("--retry-errors", action="store_true", help="also retry notices that failed before")
    sub.add_parser("pvp-probe")
    for name in ("geocode", "score", "grants", "status"):
        sub.add_parser(name)
    d = sub.add_parser("daily")
    d.add_argument("--limit", type=int, default=200, help="max notices to read with AI per run")
    d.add_argument("--comuni", type=int, default=1000, help="comuni to crawl per run (0 to skip)")

    a = p.parse_args(argv)
    db = Supa()

    if a.cmd == "check":
        n = len(db.select("sources", {"select": "id"}))
        print(f"Connected to Supabase. {n} sources configured.")
        from . import config
        k = config.ANTHROPIC_API_KEY
        print(f"Anthropic key: {config.key_shape(k)}")
        if k and not k.startswith("sk-ant-api"):
            print("  error: this does not look like an Anthropic API key. It should start with sk-ant-api, from console.anthropic.com > API keys.")
        elif k:
            import anthropic
            try:
                anthropic.Anthropic(api_key=k).models.list(limit=1)
                print("  Anthropic key works.")
            except Exception as e:  # noqa: BLE001
                print(f"  error: Anthropic rejected the key: {str(e)[:200]}")
    elif a.cmd == "gazzetta":
        from .collectors import gazzetta
        print(json.dumps(gazzetta.collect(db, a.days), indent=2))
    elif a.cmd == "comuni":
        from .collectors import comuni
        if a.action == "discover":
            print(json.dumps(comuni.discover(db), indent=2))
        elif a.action == "crawl":
            print(json.dumps(comuni.crawl(db, a.region, a.limit, a.workers), indent=2))
        elif a.action == "report":
            for r in comuni.cms_report(db):
                print(f"  {r['cms']:18} {r['comuni']:5} comuni  {r['docs']:4} property docs  {r['errors']:4} errors")
        elif a.action == "import-sites":
            print(f"Updated {comuni.import_sites(db, a.file)} comuni")
    elif a.cmd == "extract":
        from . import extract
        print(json.dumps(extract.run(db, a.limit, retry_errors=a.retry_errors), indent=2))
    elif a.cmd == "pvp-probe":
        from .collectors import pvp_probe
        pvp_probe.run()
    elif a.cmd == "geocode":
        from . import geocode
        geocode.run(db)
    elif a.cmd == "score":
        from . import score
        score.run(db)
    elif a.cmd == "grants":
        from . import extract
        extract.link_grants(db)
    elif a.cmd == "status":
        status(db)
    elif a.cmd == "daily":
        from . import extract, geocode, score
        from .collectors import comuni, gazzetta
        print(json.dumps(gazzetta.collect(db, 7), indent=2))
        if a.comuni > 0:
            print(json.dumps(comuni.crawl(db, limit=a.comuni), indent=2))
        print(json.dumps(extract.run(db, a.limit), indent=2))
        geocode.run(db)
        extract.link_grants(db)
        score.run(db)
        status(db)


if __name__ == "__main__":
    sys.exit(main())
