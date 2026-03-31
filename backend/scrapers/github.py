"""GitHub Trending scraper. Parses trending page for repos, then fetches star counts via GitHub API."""

import re
import logging
import httpx
from backend.scrapers.base import BaseScraper, RawTool
from backend.config import GITHUB_TRENDING_LANGUAGES, SCRAPE_TIMEOUT_SECONDS

logger = logging.getLogger(__name__)


class GitHubScraper(BaseScraper):
    source_name = "github"

    def fetch_raw(self) -> list[RawTool]:
        tools = []
        seen_repos = set()

        for lang in GITHUB_TRENDING_LANGUAGES:
            url = f"https://github.com/trending/{lang}" if lang else "https://github.com/trending"
            try:
                resp = httpx.get(url, timeout=SCRAPE_TIMEOUT_SECONDS, follow_redirects=True)
                resp.raise_for_status()
                tools.extend(self._parse_trending_page(resp.text, seen_repos))
            except Exception as e:
                logger.warning(f"GitHub trending fetch failed for lang={lang}: {e}")

        return tools

    def _parse_trending_page(self, html: str, seen_repos: set) -> list[RawTool]:
        tools = []
        articles = html.split('<article')

        for article in articles[1:]:
            # Extract repo path from <h2> link
            h2_match = re.search(r'<h2[^>]*>[\s\S]*?href="(/[^"]+)"', article)
            if not h2_match:
                continue

            repo_path = h2_match.group(1).strip()
            parts = repo_path.strip("/").split("/")
            if len(parts) < 2:
                continue

            owner, repo = parts[0], parts[1]
            full_name = f"{owner}/{repo}"

            if full_name in seen_repos:
                continue
            seen_repos.add(full_name)

            # Extract description
            desc = ""
            desc_match = re.search(r'<p[^>]*class="[^"]*col-9[^"]*"[^>]*>\s*(.*?)\s*</p>', article, re.DOTALL)
            if desc_match:
                desc = re.sub(r'<[^>]+>', '', desc_match.group(1)).strip()

            # Extract stars today
            stars_today = 0
            today_match = re.search(r'([\d,]+)\s+stars?\s+today', article)
            if today_match:
                stars_today = int(today_match.group(1).replace(",", ""))

            # Fetch real star count from GitHub API
            stars = self._fetch_stars(owner, repo)

            tools.append(RawTool(
                url=f"https://github.com/{full_name}",
                title=full_name,
                description=desc,
                source_url="https://github.com/trending",
                metrics={
                    "stars": stars,
                    "stars_today": stars_today,
                },
            ))

        return tools

    def _fetch_stars(self, owner: str, repo: str) -> int:
        """Fetch star count from GitHub REST API. Returns 0 on failure."""
        try:
            resp = httpx.get(
                f"https://api.github.com/repos/{owner}/{repo}",
                timeout=10,
                headers={"Accept": "application/vnd.github.v3+json"},
            )
            if resp.status_code == 200:
                return resp.json().get("stargazers_count", 0)
        except Exception as e:
            logger.debug(f"GitHub API failed for {owner}/{repo}: {e}")
        return 0
