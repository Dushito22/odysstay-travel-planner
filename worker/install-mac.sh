#!/usr/bin/env bash
# One-time setup on a Mac: loads Immobiliare.it ads into Odysstay from your home connection, then every
# morning at 08:40 (if the Mac was asleep then, it runs as soon as it wakes). Free, no admin rights needed.
# Run it with:
#   bash <(curl -fsSL https://raw.githubusercontent.com/Dushito22/odysstay-travel-planner/main/worker/install-mac.sh)
set -e
DIR="$HOME/odysstay"
REPO="https://github.com/Dushito22/odysstay-travel-planner/archive/refs/heads/main.zip"

echo "1/5 Downloading Odysstay into $DIR"
mkdir -p "$DIR"
TMP=$(mktemp -d)
curl -fsSL "$REPO" -o "$TMP/o.zip"
unzip -q "$TMP/o.zip" -d "$TMP"
rm -rf "$DIR/worker.new" && cp -R "$TMP"/odysstay-travel-planner-main/worker "$DIR/worker.new"
[ -f "$DIR/worker/.env" ] && cp "$DIR/worker/.env" "$DIR/worker.new/.env"
[ -d "$DIR/worker/logs" ] && cp -R "$DIR/worker/logs" "$DIR/worker.new/logs"
rm -rf "$DIR/worker" && mv "$DIR/worker.new" "$DIR/worker"
rm -rf "$TMP"
cd "$DIR/worker"

echo "2/5 Getting Python (uv, free, installs into your home folder)"
if ! command -v uv >/dev/null 2>&1 && [ ! -x "$HOME/.local/bin/uv" ]; then
  curl -LsSf https://astral.sh/uv/install.sh | sh >/dev/null
fi
UV=$(command -v uv || echo "$HOME/.local/bin/uv")
"$UV" venv -q --python 3.12 .venv
"$UV" pip install -q --python .venv/bin/python -r requirements.txt

echo "3/5 Your Supabase key"
if ! grep -q '^SUPABASE_SERVICE_ROLE_KEY=.\+' .env 2>/dev/null; then
  echo "   Supabase > Project Settings > API Keys > service_role (or secret) key > Reveal > copy."
  printf "   Paste it here (it won't show, press Enter after): "
  read -rs KEY </dev/tty; echo
  [ -n "$KEY" ] || { echo "No key pasted. Run the command again."; exit 1; }
  printf 'SUPABASE_URL=https://nryhvtxprjiylajolcef.supabase.co\nSUPABASE_SERVICE_ROLE_KEY=%s\n' "$KEY" > .env
  chmod 600 .env
fi

echo "4/5 First import (a few minutes, it reads slowly on purpose)"
mkdir -p logs
cat > run.sh <<'RUN'
#!/bin/bash
cd "$(dirname "$0")"
{ date; .venv/bin/python -m odysstay_worker immobiliare && .venv/bin/python -m odysstay_worker geocode; .venv/bin/python -m odysstay_worker omi; } >> logs/immobiliare.log 2>&1
RUN
chmod +x run.sh
./run.sh || true
tail -n 25 logs/immobiliare.log

echo "5/5 Scheduling it every day at 08:40"
PL="$HOME/Library/LaunchAgents/xyz.odysstay.immobiliare.plist"
mkdir -p "$HOME/Library/LaunchAgents"
cat > "$PL" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>xyz.odysstay.immobiliare</string>
  <key>ProgramArguments</key><array><string>/bin/bash</string><string>$DIR/worker/run.sh</string></array>
  <key>StartCalendarInterval</key><dict><key>Hour</key><integer>8</integer><key>Minute</key><integer>40</integer></dict>
</dict></plist>
PLIST
launchctl unload "$PL" 2>/dev/null || true
launchctl load "$PL"
echo
echo "Done. Log: $DIR/worker/logs/immobiliare.log"
echo "To stop it any time: launchctl unload $PL"
