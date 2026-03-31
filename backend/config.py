import os
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent
DATA_DIR = PROJECT_ROOT / "data"
DB_PATH = DATA_DIR / "metis.db"

# API Keys (from environment)
BUTTONDOWN_API_KEY = os.getenv("BUTTONDOWN_API_KEY", "")
PRODUCTHUNT_API_TOKEN = os.getenv("PRODUCTHUNT_API_TOKEN", "")

# Scraper settings
SCRAPE_TIMEOUT_SECONDS = 30
SCRAPE_RETRY_COUNT = 1

# HN settings
HN_MIN_POINTS = 10
HN_MAX_STORIES = 50

# GitHub Trending settings
GITHUB_TRENDING_LANGUAGES = ["python", "typescript", "javascript", "rust", "go", ""]

# API settings
API_HOST = os.getenv("API_HOST", "127.0.0.1")
API_PORT = int(os.getenv("API_PORT", "8000"))
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
