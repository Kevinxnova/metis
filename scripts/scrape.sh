#!/bin/bash
# Metis scraper - run via cron
cd metis
source .venv/bin/activate
export $(grep -v '^#' .env | xargs)
python -m backend.scheduler >> metis/data/scrape.log 2>&1
