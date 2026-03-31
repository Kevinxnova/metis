"""Translation service. Translates tool titles and descriptions to Chinese."""

import logging
from deep_translator import GoogleTranslator

logger = logging.getLogger(__name__)

_translator = GoogleTranslator(source='en', target='zh-CN')


def translate_text(text: str) -> str:
    """Translate English text to Chinese. Returns original on failure."""
    if not text or not text.strip():
        return text
    try:
        return _translator.translate(text[:5000])
    except Exception as e:
        logger.warning(f"Translation failed: {e}")
        return text


def translate_tool(tool: dict) -> dict:
    """Add Chinese translations to a tool dict if missing."""
    if not tool.get("title_zh"):
        tool["title_zh"] = translate_text(tool.get("title", ""))
    if not tool.get("description_zh") and tool.get("description"):
        tool["description_zh"] = translate_text(tool["description"][:500])
    return tool
