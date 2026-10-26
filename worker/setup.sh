#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
PY=$(command -v python3.12 || command -v python3.11 || command -v python3)
"$PY" -c 'import sys; assert sys.version_info >= (3,10), "Python 3.10+ needed (brew install python@3.12)"'
"$PY" -m venv .venv
.venv/bin/pip install -q --upgrade pip
.venv/bin/pip install -q -r requirements.txt
[ -f .env ] || cp .env.example .env
echo "Ready. Add your keys to worker/.env, then: source .venv/bin/activate && python -m odysstay_worker check"
