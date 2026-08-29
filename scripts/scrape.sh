#!/bin/bash
# Metis scraper - run via cron
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

source .venv/bin/activate
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

mkdir -p data
python -m backend.scheduler >> data/scrape.log 2>&1
