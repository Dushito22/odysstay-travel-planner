"""Odysstay worker: finds Italian public property notices and writes verified listings to Supabase.

  python -m odysstay_worker check                      test the Supabase connection
  python -m odysstay_worker gazzetta [--days 14]       collect auctions from the Gazzetta Ufficiale
  python -m odysstay_worker pvp [--max-price 300000]   collect court-ordered sales (Portale Vendite Pubbliche)
  python -m odysstay_worker comuni discover            load all comuni and their official websites
  python -m odysstay_worker comuni crawl [--region R] [--limit N] [--workers 8]
  python -m odysstay_worker comuni report              which website software comuni run
  python -m odysstay_worker comuni import-sites FILE   fix or add websites (CSV columns: istat,site)
  python -m odysstay_worker extract [--limit 50]       read candidate notices with AI (needs ANTHROPIC_API_KEY)
  python -m odysstay_worker geocode                    put new listings on the map
  python -m odysstay_worker score                      rank listings and update open/closing/closed
  python -m odysstay_worker costs                      add default renovation estimates
  python -m odysstay_worker perizia [--limit 40]       read court appraisal reports of the best listings with AI
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
    listings = db.select("listings", {"select": "score,status,discount_pct,surface_sqm,photo_urls,lat", "is_demo": "eq.false"})
    open_ = [l for l in listings if l["status"] not in ("closed", "withdrawn")]
    print(f"Listings: {len(listings)} real ({sum(1 for l in listings if (l['score'] or 0) >= 70)} scoring 70+, "
          f"{len(open_)} open)")
    if open_:
        buckets = [0] * 11
        for l in open_:
            buckets[int((l["score"] or 0) // 10)] += 1
        print("Open by score: " + " ".join(f"{i * 10}s:{n}" for i, n in enumerate(buckets) if n))
        pct = lambda f: round(100 * sum(1 for l in open_ if f(l)) / len(open_))  # noqa: E731
        print(f"Open with: appraisal discount {pct(lambda l: l['discount_pct'] is not None)}%, surface {pct(lambda l: l['surface_sqm'])}%, "
              f"photos {pct(lambda l: l['photo_urls'])}%, on map {pct(lambda l: l['lat'] is not None)}%")


def main(argv=None):
    p = argparse.ArgumentParser(prog="odysstay_worker", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("check")
    g = sub.add_parser("gazzetta")
    g.add_argument("--days", type=int, default=14)
    pz = sub.add_parser("perizia")
    pz.add_argument("--limit", type=int, default=40)
    pv = sub.add_parser("pvp")
    pv.add_argument("--max-price", type=float, default=300_000)
    pv.add_argument("--limit", type=int, default=6000, help="max lot details to read this run")
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
    for name in ("geocode", "score", "grants", "status", "costs"):
        sub.add_parser(name)
    d = sub.add_parser("daily")
    d.add_argument("--limit", type=int, default=200, help="max notices to read with AI per run")
    d.add_argument("--comuni", type=int, default=1000, help="comuni to crawl per run (0 to skip)")

    a = p.parse_args(argv)
    from . import config
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
    elif a.cmd == "pvp":
        from .collectors import pvp
        print(json.dumps(pvp.collect(db, max_price=a.max_price, detail_limit=a.limit), indent=2))
    elif a.cmd == "perizia":
        from . import perizia
        print(json.dumps(perizia.run(db, limit=a.limit), indent=2))
    elif a.cmd == "costs":
        from . import costs
        costs.run(db)
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
        from . import costs, extract, geocode, score
        from .collectors import comuni, gazzetta, pvp
        for name, step in (("gazzetta", lambda: gazzetta.collect(db, 7)), ("court sales", lambda: pvp.collect(db))):
            try:
                print(json.dumps(step(), indent=2))
            except Exception as e:  # noqa: BLE001  one source failing must not stop the others
                print(f"{name}: error {e}")
        if a.comuni > 0:
            print(json.dumps(comuni.crawl(db, limit=a.comuni), indent=2))
        if config.ANTHROPIC_API_KEY.startswith("sk-ant-api"):
            print(json.dumps(extract.run(db, a.limit), indent=2))
        else:
            print("Skipping AI reading: no valid ANTHROPIC_API_KEY")
        geocode.run(db)
        extract.link_grants(db)
        score.run(db)
        from . import perizia
        print(json.dumps(perizia.run(db), indent=2))
        score.run(db)  # again: report red flags change scores
        costs.run(db)
        status(db)


if __name__ == "__main__":
    sys.exit(main())
