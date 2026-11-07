#!/usr/bin/env bash
# Headless Chrome on the LIVE site: the path renders all modules and Chrome logs no
# CSP violation or JavaScript error.
#   usage: scripts/e2e-site.sh <page URL, e.g. https://apps.badita.com/linux/>
set -euo pipefail
URL=$1
CHROME=${CHROME:-google-chrome}
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
"$CHROME" --version
timeout 120 "$CHROME" --headless=new --disable-gpu --no-first-run --enable-logging=stderr --v=0 \
  --virtual-time-budget=15000 --dump-dom "$URL" >"$tmp/dom.html" 2>"$tmp/console.log"
python3 - "$tmp/dom.html" "$tmp/console.log" <<'PY'
import re, sys
dom = open(sys.argv[1], encoding="utf-8").read()
log = open(sys.argv[2], encoding="utf-8", errors="replace").read()
nodes = len(re.findall(r'class="node', dom))
bad = [l for l in log.splitlines() if "Content Security Policy" in l or "Refused to" in l or "Uncaught" in l]
print(f"path nodes: {nodes}, console problems: {bad or 'none'}")
sys.exit(0 if nodes >= 49 and not bad else 1)
PY
