# Contributing to Metis

Thanks for helping improve Metis.

## Before opening a change

1. Search existing issues and pull requests.
2. Keep the change focused; separate unrelated fixes.
3. Never add credentials, local databases, scraped production data, or logs.
4. For a security issue, follow `SECURITY.md` instead of filing a public issue.

## Development setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt

cp .env.example .env

cd frontend
npm ci
```

Use placeholder credentials and a disposable local database while developing.

## Validation

Run both checks before opening a pull request:

```bash
source .venv/bin/activate
pytest

cd frontend
npm run build
```

Live integration tests are opt-in because they can modify Turso data and spend
MiniMax credits.

## Pull requests

Describe the user-visible behavior, note any configuration or schema changes,
and include screenshots for UI changes. By contributing, you agree that your
work may be distributed under the repository's license.
