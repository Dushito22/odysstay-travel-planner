#!/usr/bin/env bash
# Immobiliare.it blocks cloud servers (GitHub, Supabase) but lets a home connection through.
# Run this once on your own computer: it sets up the worker, loads today's Immobiliare.it ads into Odysstay,
# and schedules itself every day at 08:40 while the computer is on. Free. Needs worker/.env with
# SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (the file stays on your computer).
set -e
cd "$(dirname "$0")"
[ -d .venv ] || bash setup.sh
.venv/bin/pip install -q -r requirements.txt
grep -q '^SUPABASE_SERVICE_ROLE_KEY=.\+' .env || { echo "Put SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in $(pwd)/.env first."; exit 1; }
HERE=$(pwd)
mkdir -p logs
.venv/bin/python -m odysstay_worker immobiliare 2>&1 | tee -a logs/immobiliare.log
.venv/bin/python -m odysstay_worker geocode >> logs/immobiliare.log 2>&1 || true
.venv/bin/python -m odysstay_worker omi >> logs/immobiliare.log 2>&1 || true
LINE="40 8 * * * cd '$HERE' && .venv/bin/python -m odysstay_worker immobiliare >> logs/immobiliare.log 2>&1 && .venv/bin/python -m odysstay_worker geocode >> logs/immobiliare.log 2>&1; .venv/bin/python -m odysstay_worker omi >> logs/immobiliare.log 2>&1"
( crontab -l 2>/dev/null | grep -v 'odysstay_worker immobiliare'; echo "$LINE" ) | crontab -
echo "Done. It runs again every day at 08:40. Log: $HERE/logs/immobiliare.log"
