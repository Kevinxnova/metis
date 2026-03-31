# Metis

AI tool discovery newsletter. Automated scraping, human curation, email delivery.

## Setup

### Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### Frontend
```bash
cd frontend
npm install
```

### Environment
```bash
cp .env.example .env
# Edit .env with your API keys
```

## Run

### 1. Run scrapers (fetch new tools)
```bash
python -m backend.scheduler
```

### 2. Start API server
```bash
uvicorn backend.api.main:app --reload
```

### 3. Start frontend
```bash
cd frontend && npm run dev
```

Open http://localhost:5173 — review tools, write takes, send newsletter.

## Architecture

```
Scrapers (cron) → SQLite → FastAPI → React Dashboard → Buttondown Email
```

3 sources: GitHub Trending, Hacker News, Product Hunt.
URL-based dedup with manual merge button in dashboard.
Every curation decision logged for Phase 2 digital twin training.
