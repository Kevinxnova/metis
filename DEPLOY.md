# Deploying Metis

Metis can run as one Vercel project with a Turso database. It can also be
self-hosted with local SQLite.

## Vercel + Turso

### 1. Create a Turso database

Create a database in Turso and copy its database URL and authentication token.
Metis initializes missing tables on startup.

### 2. Import the GitHub repository

Import `Kevinxnova/metis` into Vercel and keep the repository root as the
project root. The checked-in `vercel.json` builds the frontend and maps the
Python API functions.

### 3. Configure environment variables

Set these values for Production and Preview as appropriate:

```text
TURSO_DATABASE_URL=libsql://...
TURSO_AUTH_TOKEN=...
ADMIN_PASSWORD=<long-random-value>
CRON_SECRET=<different-long-random-value>
MINIMAX_API_KEY=...
ALLOWED_ORIGINS=https://your-project.vercel.app
```

Optional features use:

```text
PRODUCTHUNT_API_TOKEN=...
BUTTONDOWN_API_KEY=...
TRANSLATION_API_URL=https://your-translator.example/translate
TRANSLATION_API_KEY=...
```

If the frontend and API are deployed together, leave `VITE_API_URL` unset. If
they use different origins, set it to the API origin without a trailing
`/api`, then add the frontend origin to `ALLOWED_ORIGINS`.

Vercel automatically sends `Authorization: Bearer <CRON_SECRET>` to cron
requests when `CRON_SECRET` is configured. Metis fails closed when the value is
missing.

### 4. Deploy and verify

After deployment:

```bash
curl https://your-project.vercel.app/api/health
```

The response should report `status: ok`. Then open `/admin` and verify that
the configured admin password works.

Review your Vercel plan's current cron frequency and function-duration limits.
The included schedules are a starting point and may need to be reduced for your
plan.

## Self-hosting

Local SQLite is used whenever `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` are
not set.

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Configure at least ADMIN_PASSWORD and CRON_SECRET.

./scripts/start-backend.sh
```

The server binds to `API_HOST` and `API_PORT`, which default to
`127.0.0.1:8000`. Put a TLS-terminating reverse proxy in front of it before
making it reachable from the internet.

Run the collector manually with:

```bash
source .venv/bin/activate
python -m backend.scheduler
```

The macOS helper in `scripts/setup-mac.sh` can create launchd services for the
API and collector. Read the script before running it because it writes service
definitions under `~/Library/LaunchAgents`.

## Secret handling

- Do not commit `.env`, database files, logs, or Vercel metadata.
- Use different values for the admin password and cron secret.
- Rotate a credential immediately if it appears in Git history or application
  logs.
- Do not expose the admin API over plain HTTP.
- Keep Preview environment credentials separate from Production.
- Translation text leaves Metis only when `TRANSLATION_API_URL` is explicitly
  configured; a self-hosted endpoint is recommended for sensitive content.
