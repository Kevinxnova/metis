"""GitHub Trending scraper. Fetches trending repos via the unofficial web page."""

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

        # Extract repo entries from the trending page HTML
        # Pattern: <article> blocks containing repo info
        repo_pattern = re.compile(
            r'<h2[^>]*>\s*<a[^>]*href="(/[^"]+)"[^>]*>',
            re.DOTALL
        )
        desc_pattern = re.compile(
            r'<p[^>]*class="[^"]*col-9[^"]*"[^>]*>\s*(.*?)\s*</p>',
            re.DOTALL
        )
        stars_pattern = re.compile(
            r'class="d-inline-block float-sm-right">\s*([0-9,]+)\s*stars today',
            re.DOTALL
        )

        # Split HTML into article blocks
        articles = html.split('<article')

        for article in articles[1:]:  # Skip content before first article
            # Extract repo path
            repo_match = repo_pattern.search(article)
            if not repo_match:
                continue

            repo_path = repo_match.group(1).strip()
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
            desc_match = desc_pattern.search(article)
            if desc_match:
                desc = re.sub(r'<[^>]+>', '', desc_match.group(1)).strip()

            # Extract stars today
            stars_today = 0
            stars_match = stars_pattern.search(article)
            if stars_match:
                stars_today = int(stars_match.group(1).replace(",", ""))

            # Extract total stars (pattern varies)
            total_stars = 0
            total_match = re.search(r'href="/' + re.escape(full_name) + r'/stargazers"[^>]*>\s*([0-9,]+)', article)
            if total_match:
                total_stars = int(total_match.group(1).replace(",", ""))

            tools.append(RawTool(
                url=f"https://github.com/{full_name}",
                title=full_name,
                description=desc,
                source_url=f"https://github.com/trending",
                metrics={
                    "stars": total_stars,
                    "stars_today": stars_today,
                },
            ))

        return tools
