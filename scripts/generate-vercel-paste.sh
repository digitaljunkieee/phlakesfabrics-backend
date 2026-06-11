#!/usr/bin/env bash
# Generate a ready-to-paste block of environment variables for Vercel from .env.local
# Usage: copy a .env.local file into the repo root, then run:
#   bash scripts/generate-vercel-paste.sh

set -euo pipefail

ENV_FILE=.env.local
if [ ! -f "$ENV_FILE" ]; then
  echo "No $ENV_FILE found in repo root. Create one by copying .env.example and filling values:" >&2
  echo "  cp .env.example .env.local && edit .env.local" >&2
  exit 1
fi

echo "# Paste the following into Vercel → Project → Settings → Environment Variables"
echo "# Choose the appropriate Environment (Production / Preview / Development) when adding"
echo
grep -v '^#' "$ENV_FILE" | sed '/^\s*$/d'
