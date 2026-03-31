"""URL-based deduplication. Tier 1: fast, free, handles 95%+ of cases."""

from urllib.parse import urlparse, urlunparse


def normalize_url(url: str) -> str:
    """Normalize a URL for dedup comparison.

    Strips query params, fragments, trailing slashes, www prefix.
    Lowercases scheme and host.
    """
    parsed = urlparse(url.strip())
    scheme = parsed.scheme.lower() or "https"
    host = parsed.hostname or ""
    host = host.lower().removeprefix("www.")
    path = parsed.path.rstrip("/") or "/"
    return urlunparse((scheme, host, path, "", "", ""))


def extract_github_key(url: str) -> str | None:
    """Extract owner/repo from a GitHub URL. Returns None if not a GitHub URL."""
    parsed = urlparse(url.strip())
    host = (parsed.hostname or "").lower().removeprefix("www.")
    if host != "github.com":
        return None
    parts = parsed.path.strip("/").split("/")
    if len(parts) >= 2:
        return f"github:{parts[0].lower()}/{parts[1].lower()}"
    return None


def compute_dedup_key(url: str, title: str = "") -> str:
    """Compute a dedup key for a tool.

    Priority:
    1. GitHub owner/repo if it's a GitHub URL
    2. Normalized URL otherwise
    """
    github_key = extract_github_key(url)
    if github_key:
        return github_key
    return f"url:{normalize_url(url)}"
