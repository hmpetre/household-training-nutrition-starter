#!/bin/bash
# ============================================================================
# install.sh — set up the local connectors on YOUR computer.
#
# Copies each connector you choose from this repo into ~/mcp-servers/<name>
# (a plain LOCAL folder, never a cloud-synced one) and rebuilds its
# dependencies locally. Then it prints the next steps (auth + Claude config).
#
# Safe to re-run. Nothing is deleted from the repo. Run from the repo root:
#     bash scripts/install.sh
# ============================================================================
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$HOME/mcp-servers"
NPM_CACHE="$DEST/.npm-cache"

c()  { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
ok() { printf '\033[1;32m   ✓ %s\033[0m\n' "$*"; }
warn(){ printf '\033[1;33m   ! %s\033[0m\n' "$*"; }
die(){ printf '\n\033[1;31mERROR: %b\033[0m\n' "$*" >&2; exit 1; }
ask(){ read -r -p "$1 [y/N] " a; [[ "$a" =~ ^[Yy] ]]; }

mkdir -p "$DEST"
c "Installing connectors into: $DEST"
warn "Keep this OUT of OneDrive/Dropbox/iCloud — cloud sync breaks these."

# ---------- WHOOP (Node) ----------
if [ -d "$REPO/connectors/whoop" ] && ls "$REPO/connectors/whoop"/*.js >/dev/null 2>&1 && ask "Set up WHOOP?"; then
  command -v node >/dev/null || die "node not found — install Node LTS from https://nodejs.org"
  mkdir -p "$DEST/whoop"
  rsync -a --exclude node_modules --exclude '.env' --exclude 'tokens*.json' "$REPO/connectors/whoop"/ "$DEST/whoop"/
  [ -f "$DEST/whoop/.env" ] || cp "$REPO/connectors/whoop/.env.example" "$DEST/whoop/.env"
  rm -rf "$DEST/whoop/node_modules"
  ( cd "$DEST/whoop" && npm install --omit=dev --no-audit --no-fund --cache "$NPM_CACHE" ) || die "npm install failed (WHOOP)"
  ok "WHOOP installed → edit $DEST/whoop/.env then run its auth (see connectors/whoop/README.md)"
fi

# ---------- Withings (Node) ----------
if [ -d "$REPO/connectors/withings" ] && ls "$REPO/connectors/withings"/**/*.js >/dev/null 2>&1 && ask "Set up Withings?"; then
  command -v node >/dev/null || die "node not found — install Node LTS from https://nodejs.org"
  mkdir -p "$DEST/withings"
  rsync -a --exclude node_modules --exclude '.env' "$REPO/connectors/withings"/ "$DEST/withings"/
  if [ -d "$DEST/withings/scripts" ] && [ ! -f "$DEST/withings/scripts/.env" ]; then
    cp "$REPO/connectors/withings/.env.example" "$DEST/withings/scripts/.env"
  fi
  # rebuild node deps only if the connector has a package.json
  [ -f "$DEST/withings/mcp/package.json" ] && ( cd "$DEST/withings/mcp" && npm install --omit=dev --no-audit --no-fund --cache "$NPM_CACHE" ) || true
  ok "Withings installed → edit $DEST/withings/scripts/.env then run its auth (see connectors/withings/README.md)"
fi

# ---------- TrainingPeaks (Python 3.11) ----------
if [ -d "$REPO/connectors/trainingpeaks" ] && [ -f "$REPO/connectors/trainingpeaks/pyproject.toml" ] && ask "Set up TrainingPeaks?"; then
  mkdir -p "$DEST/trainingpeaks"
  rsync -a --exclude '.venv' --exclude '.git' --exclude '__pycache__' "$REPO/connectors/trainingpeaks"/ "$DEST/trainingpeaks"/
  PY="$(command -v python3.11 || true)"
  [ -z "$PY" ] && [ -x "$HOME/anaconda3/bin/python3" ] && PY="$HOME/anaconda3/bin/python3"
  [ -z "$PY" ] && PY="$(command -v python3 || true)"
  [ -n "$PY" ] || die "python3 not found — install Python 3.11 from https://www.python.org/downloads/"
  echo "   using $PY ($("$PY" --version 2>&1))"
  ( cd "$DEST/trainingpeaks"
    rm -rf .venv
    "$PY" -m venv .venv
    ./.venv/bin/pip install --no-cache-dir --upgrade pip
    ./.venv/bin/pip install --no-cache-dir --prefer-binary -e .
  ) || die "TrainingPeaks venv build failed — ensure Python 3.11 and network access"
  ok "TrainingPeaks installed → authorize per connectors/trainingpeaks/README.md"
fi

c "Next steps"
cat <<EOF
1. Fill in each connector's .env and run its one-time 'auth' (see the connector READMEs).
2. Add each connector's block from config/claude_desktop_config.example.json to
   ~/Library/Application Support/Claude/claude_desktop_config.json  (back it up first, use absolute paths).
3. Fully quit Claude (Cmd+Q) and reopen it. Test: "what's my recovery / body fat / workouts this week".
4. Set up your plan:  mkdir -p ~/household-planner/my-plan && cp -R "$REPO/meal-planner/templates/" ~/household-planner/my-plan/
   then tell Claude: "help me fill in my household meal-planner files".

Tip: doing this inside Claude Cowork? Just say "finish setting up the household system" and it will drive the rest.
EOF
