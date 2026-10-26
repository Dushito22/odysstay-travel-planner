# Odysstay worker

Finds Italian public property notices, reads them with AI, keeps only facts it can quote from the
original, scores them, and writes them into the same Supabase tables the app reads. Nothing in the
app needs to change when real listings arrive.

## What it reads

| Source | What | How often |
|---|---|---|
| Gazzetta Ufficiale, 5th series | Larger public auctions by comuni, ASL, universities, regions | Daily |
| Comune websites | Sales published only on each comune's own notice board, often as Italian PDFs | Weekly crawl |

Next sources: notary auctions (RAN / Avvisi Notarili), Agenzia del Demanio, ISMEA land bank.

## How a notice becomes a listing

1. **Collect.** Download notices and keep the originals. No AI.
2. **Triage.** Keyword filter keeps only things that look like property sales. No AI cost.
3. **Extract.** Claude returns every field with the exact Italian sentence it came from, plus an English translation.
4. **Verify.** Code checks each quote is really in the notice and the number, date or word is really in the quote. Anything that fails is dropped and never reaches the app.
5. **Place, link, score.** Map position from the comune name (OpenStreetMap), regional grants linked as "possible" fits only, then a 0 to 100 score with readable reasons. Status flips to closing soon and closed by deadline.

## Run it on GitHub (no server needed)

The workflow in `.github/workflows/worker.yml` runs daily (Gazzetta, extraction, map, scores) and on
Sundays (comune crawl). It stays idle until you add three repository secrets:

GitHub repo > Settings > Secrets and variables > Actions > New repository secret:

- `SUPABASE_URL`: `https://nryhvtxprjiylajolcef.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase > Project Settings > API keys > the **secret / service_role** key
- `ANTHROPIC_API_KEY`: your Anthropic key

Then: Actions tab > Worker > Run workflow, once with **comuni-discover** (loads all ~7,900 comuni and
their websites), then once with **daily**.

## Run it on your Mac

```bash
cd worker
./setup.sh
open -e .env            # paste the three keys
source .venv/bin/activate
python -m odysstay_worker check
python -m odysstay_worker gazzetta --days 30
python -m odysstay_worker comuni discover
python -m odysstay_worker comuni crawl --limit 200
python -m odysstay_worker extract --limit 30
python -m odysstay_worker geocode
python -m odysstay_worker grants
python -m odysstay_worker score
python -m odysstay_worker status
```

## Costs

- GitHub Actions: private repos get 2,000 free minutes a month. The daily run takes a few minutes; the weekly crawl longer.
- Anthropic: roughly a few cents per notice read. `--limit` caps how many notices are read per run.

## Safety

- The service role key bypasses row-level security. Keep it only in GitHub secrets or `worker/.env`. Never in the app, never in git.
- The crawler identifies itself, waits between requests to the same site and caches pages.
- The worker only inserts listings from new notices. It never deletes listings, so users' deals and saved items stay intact.

## Tests

```bash
cd worker && python -m pytest -q
```
