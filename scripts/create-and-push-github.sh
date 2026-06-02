#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Usage: ./scripts/create-and-push-github.sh owner/repo [private|public]"
  exit 1
fi

REPO="$1"
VISIBILITY="${2:-private}"

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI is not installed. Install gh or create the repo manually first."
  exit 1
fi

if [ "$VISIBILITY" = "public" ]; then
  gh repo create "$REPO" --public --source=. --remote=origin --push
else
  gh repo create "$REPO" --private --source=. --remote=origin --push
fi
