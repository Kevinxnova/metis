#!/bin/bash
# Metis backend startup script
cd metis
source .venv/bin/activate
export $(grep -v '^#' .env | xargs)
uvicorn backend.api.main:app --host 0.0.0.0 --port 8000
