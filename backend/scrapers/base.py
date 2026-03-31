"""Base scraper with shared pipeline: fetch → normalize → dedup → insert."""

import time
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass

from backend.db.queries import insert_tool, tool_exists, log_scrape_run, save_classification
from backend.dedup.url_normalize import compute_dedup_key
from backend.classifier import classify_tool

logger = logging.getLogger(__name__)


@dataclass
class RawTool:
    url: str
    title: str
    description: str
    source_url: str
    metrics: dict


class BaseScraper(ABC):
    """Abstract base for all source scrapers."""

    source_name: str = "unknown"

    @abstractmethod
    def fetch_raw(self) -> list[RawTool]:
        """Fetch raw tool data from the source. Override per scraper."""
        ...

    def run(self) -> dict:
        """Execute the full scrape pipeline: fetch → dedup → insert."""
        start = time.time()
        tools_found = 0
        tools_new = 0
        tools_deduped = 0
        error_message = None
        status = "success"

        try:
            raw_tools = self.fetch_raw()
            tools_found = len(raw_tools)

            for raw in raw_tools:
                dedup_key = compute_dedup_key(raw.url, raw.title)

                if tool_exists(dedup_key):
                    tools_deduped += 1
                    # Still call insert_tool to merge sources
                    insert_tool(
                        url=raw.url,
                        dedup_key=dedup_key,
                        title=raw.title,
                        description=raw.description,
                        source=self.source_name,
                        source_url=raw.source_url,
                        metrics=raw.metrics,
                    )
                    continue

                result = insert_tool(
                    url=raw.url,
                    dedup_key=dedup_key,
                    title=raw.title,
                    description=raw.description,
                    source=self.source_name,
                    source_url=raw.source_url,
                    metrics=raw.metrics,
                )
                if result is not None:
                    tools_new += 1
                    # Auto-classify new tools
                    tool_dict = {"title": raw.title, "description": raw.description, "url": raw.url}
                    content_type, domain = classify_tool(tool_dict)
                    save_classification(result, content_type, domain)
                else:
                    tools_deduped += 1

        except Exception as e:
            status = "error"
            error_message = str(e)
            logger.error(f"Scraper {self.source_name} failed: {e}")

        duration_ms = int((time.time() - start) * 1000)

        log_scrape_run(
            source=self.source_name,
            status=status,
            tools_found=tools_found,
            tools_new=tools_new,
            tools_deduped=tools_deduped,
            error_message=error_message,
            duration_ms=duration_ms,
        )

        return {
            "source": self.source_name,
            "status": status,
            "tools_found": tools_found,
            "tools_new": tools_new,
            "tools_deduped": tools_deduped,
            "duration_ms": duration_ms,
            "error": error_message,
        }
