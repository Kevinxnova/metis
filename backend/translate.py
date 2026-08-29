"""Optional translation through an explicitly configured LibreTranslate endpoint."""

import logging
import os

import httpx

logger = logging.getLogger(__name__)

TRANSLATION_API_URL = os.getenv("TRANSLATION_API_URL", "").strip()
TRANSLATION_API_KEY = os.getenv("TRANSLATION_API_KEY", "").strip()


def _translate(text: str, source: str, target: str, fallback: str) -> str:
    if not text or not text.strip():
        return fallback
    if not TRANSLATION_API_URL:
        return fallback

    payload = {
        "q": text[:5000],
        "source": source,
        "target": target,
        "format": "text",
    }
    if TRANSLATION_API_KEY:
        payload["api_key"] = TRANSLATION_API_KEY

    try:
        response = httpx.post(TRANSLATION_API_URL, json=payload, timeout=30)
        response.raise_for_status()
        translated = response.json().get("translatedText", "")
        return translated.strip() or fallback
    except Exception as exc:
        logger.warning("Translation failed: %s", exc)
        return fallback


def translate_text(text: str) -> str:
    """Translate English text to Simplified Chinese, or return the original."""
    return _translate(text, source="en", target="zh", fallback=text)


def translate_take_to_en(text: str) -> str:
    """Translate Chinese curator text to English, or return an empty string."""
    return _translate(text, source="zh", target="en", fallback="")


def translate_tool(tool: dict) -> dict:
    """Add Chinese translations to a tool dict when translation is configured."""
    if not tool.get("title_zh"):
        tool["title_zh"] = translate_text(tool.get("title", ""))
    if not tool.get("description_zh") and tool.get("description"):
        tool["description_zh"] = translate_text(tool["description"][:500])
    return tool
