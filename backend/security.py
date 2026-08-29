"""Small, framework-independent helpers for protecting privileged endpoints."""

from __future__ import annotations

import hmac
import os


def secret_is_configured(name: str) -> bool:
    """Return whether a non-empty secret exists in the environment."""
    return bool(os.getenv(name, "").strip())


def secret_matches(provided: str | None, name: str) -> bool:
    """Compare a provided value with an environment secret in constant time."""
    expected = os.getenv(name, "").strip()
    candidate = (provided or "").strip()
    return bool(expected and candidate and hmac.compare_digest(candidate, expected))


def bearer_matches(authorization: str | None, name: str = "CRON_SECRET") -> bool:
    """Validate an Authorization: Bearer header against an environment secret."""
    expected = os.getenv(name, "").strip()
    candidate = authorization or ""
    return bool(
        expected
        and hmac.compare_digest(candidate, f"Bearer {expected}")
    )
