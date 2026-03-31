"""Health and scrape status routes."""

from fastapi import APIRouter
from backend.db.queries import get_latest_scrape_runs

router = APIRouter(prefix="/health", tags=["health"])


@router.get("")
def health_check():
    return {"status": "ok"}


@router.get("/scrapes")
def scrape_status():
    runs = get_latest_scrape_runs()
    return {"scrapes": runs}
