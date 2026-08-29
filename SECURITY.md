# Security policy

## Reporting a vulnerability

Please do not open a public issue for a suspected vulnerability.

Use GitHub's private vulnerability reporting for this repository:

https://github.com/Kevinxnova/metis/security/advisories/new

Include the affected route or component, reproduction steps, impact, and any
suggested mitigation. Avoid including real credentials or production data.

## Operational guidance

- Set strong, different values for `ADMIN_PASSWORD` and `CRON_SECRET`.
- Serve the admin interface only over HTTPS.
- Keep `.env`, SQLite files, logs, and provider metadata out of Git.
- Treat community messages and all scraped content as untrusted input.
- Rotate credentials immediately after any suspected disclosure.
