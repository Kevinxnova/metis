# Metis

[![CI](https://github.com/Kevinxnova/metis/actions/workflows/ci.yml/badge.svg)](https://github.com/Kevinxnova/metis/actions/workflows/ci.yml)

Metis is a bilingual AI-tool discovery desk. It gathers fresh projects and
technology news, removes duplicates, enriches the results with AI, and gives a
human curator a focused workflow for publishing recommendations and newsletters.

The project is an early-stage personal tool. Expect the data model and UI to
evolve.

## What it does

- Collects GitHub Trending, Hacker News, Product Hunt, and selected AI RSS feeds.
- Normalizes URLs and merges discoveries that appear in more than one source.
- Classifies, scores, summarizes, translates, and introduces items with MiniMax.
- Publishes a bilingual discovery page and AI daily briefing.
- Provides a password-protected curation dashboard.
- Stores data in local SQLite or a hosted Turso database.
- Can send curated issues through Buttondown.

## Architecture

```text
GitHub / HN / Product Hunt / RSS
                  │
                  ▼
          scraper + deduplication
                  │
                  ▼
       SQLite locally / Turso in production
                  │
          ┌───────┴────────┐
          ▼                ▼
   Flask JSON API    scheduled AI pipeline
          │
          ▼
     React + Vite UI ──────► Buttondown
```

The Flask app is served from `backend/api/main.py`. Vercel function entry
points live under `api/`; the React application lives under `frontend/`.

## Quick start

Prerequisites:

- Python 3.12+
- Node.js 20+

```bash
git clone https://github.com/Kevinxnova/metis.git
cd metis

python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt

cp .env.example .env
# Add strong ADMIN_PASSWORD and CRON_SECRET values, plus any optional API keys.

cd frontend
npm ci
cd ..
```

Start the API:

```bash
./scripts/start-backend.sh
```

In a second terminal, start the frontend:

```bash
cd frontend
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The curator dashboard is
available at `/admin`.

To collect data manually:

```bash
source .venv/bin/activate
python -m backend.scheduler
```

## Configuration

Copy `.env.example` to `.env`. Never commit the resulting `.env` file.

| Variable | Purpose | Required |
| --- | --- | --- |
| `ADMIN_PASSWORD` | Protects curator data and every privileged API route | For admin access |
| `CRON_SECRET` | Bearer token required by all scheduled-task routes | For scheduled tasks |
| `MINIMAX_API_KEY` | AI recommendations, summaries, scoring, and daily news | For AI features |
| `TURSO_DATABASE_URL` | Hosted Turso database URL | No; local SQLite is the default |
| `TURSO_AUTH_TOKEN` | Turso authentication token | With a Turso URL |
| `TRANSLATION_API_URL` | Opt-in LibreTranslate-compatible `/translate` endpoint | No |
| `TRANSLATION_API_KEY` | Authentication for the configured translation endpoint | No |
| `PRODUCTHUNT_API_TOKEN` | Product Hunt GraphQL access | No |
| `BUTTONDOWN_API_KEY` | Newsletter delivery | No |
| `ALLOWED_ORIGINS` | Comma-separated browser origins allowed by CORS | In production |
| `VITE_API_URL` | Build-time frontend API origin | Only when API and UI use different origins |

Use long, unique values for `ADMIN_PASSWORD` and `CRON_SECRET`. Only expose the
admin UI over HTTPS. Translation is disabled unless `TRANSLATION_API_URL` is
explicitly configured; text sent there is governed by that provider's privacy
policy.

## Tests

```bash
source .venv/bin/activate
pytest

cd frontend
npm run build
```

The live Turso/MiniMax integration suite is disabled by default. Run it only
against an environment you control:

```bash
METIS_RUN_INTEGRATION_TESTS=1 pytest -m integration -s
```

## Deployment

See [DEPLOY.md](DEPLOY.md) for Vercel, Turso, cron security, and self-hosting
instructions.

## Contributing

Bug reports and focused pull requests are welcome. Read
[CONTRIBUTING.md](CONTRIBUTING.md) before opening a change. For vulnerabilities,
follow [SECURITY.md](SECURITY.md) and do not create a public issue.
