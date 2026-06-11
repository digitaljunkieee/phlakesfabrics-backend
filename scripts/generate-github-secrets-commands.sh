#!/usr/bin/env bash
# Generate GitHub Actions secret set commands (using `gh` CLI) from .env.local
# Usage: ensure `gh` is logged in and run:
#   bash scripts/generate-github-secrets-commands.sh

set -euo pipefail

ENV_FILE=.env.local
if [ ! -f "$ENV_FILE" ]; then
  echo "No $ENV_FILE found in repo root. Create one by copying .env.example and filling values:" >&2
  echo "  cp .env.example .env.local && edit .env.local" >&2
  exit 1
fi

REPO=${1:-}
if [ -z "$REPO" ]; then
  echo "Usage: $0 owner/repo" >&2
  echo "Example: $0 nnebedumemmanuel/phlakesfabrics_backend" >&2
  exit 1
fi

echo "# Run the following commands to set GitHub Actions secrets for $REPO"
echo "# Make sure you are logged in with 'gh auth login' and have repo admin access"
echo
while IFS= read -r line; do
  # skip comments and empty lines
  [[ "$line" =~ ^# ]] && continue
  [[ -z "$line" ]] && continue
  key=$(echo "$line" | sed 's/=.*//')
  val=$(echo "$line" | sed 's/^[^=]*=//')
  # Escape single quotes in value
  esc=$(printf "%s" "$val" | sed "s/'/'\\''/g")
  echo "gh secret set $key --repo $REPO --body '$esc'"
done < <(grep -v '^#' "$ENV_FILE" | sed '/^\s*$/d')
