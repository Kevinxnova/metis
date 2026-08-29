"""Email composition and Buttondown integration."""

from html import escape
from urllib.parse import urlparse

import httpx
from backend.config import BUTTONDOWN_API_KEY

BUTTONDOWN_API = "https://api.buttondown.com/v1/emails"


def _safe_url(value: str) -> str:
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"}:
        return "#"
    return escape(value, quote=True)


def compose_email(issue: dict) -> tuple[str, str]:
    """Compose newsletter HTML from an issue with tools.

    Returns (subject, html_body).
    """
    tools = issue.get("tools", [])
    title = issue.get("title", f"Metis Weekly #{issue['issue_number']}")

    items_html = ""
    for tool in tools:
        take = tool.get("take", "")
        if not take:
            continue
        url = _safe_url(tool.get("url", ""))
        tool_title = escape(str(tool.get("title", "")))
        safe_take = escape(str(take))

        items_html += f"""
        <div style="margin-bottom: 24px; padding-bottom: 20px; border-bottom: 1px solid #eee;">
            <h3 style="margin: 0 0 6px 0; font-size: 16px;">
                <a href="{url}" style="color: #333; text-decoration: none;">{tool_title}</a>
            </h3>
            <p style="margin: 0; color: #555; font-size: 14px; line-height: 1.6;">{safe_take}</p>
        </div>
        """

    safe_title = escape(str(title))
    html_body = f"""
    <div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">
        <div style="text-align: center; padding: 24px 0; border-bottom: 1px solid #eee;">
            <h1 style="margin: 0; font-size: 22px; letter-spacing: -0.5px;">{safe_title}</h1>
        </div>
        <div style="padding: 24px 0;">
            {items_html}
        </div>
        <div style="text-align: center; padding: 16px 0; border-top: 1px solid #eee; font-size: 12px; color: #999;">
            You're getting this because you want to find tools before everyone else.<br>
            Curated by Metis
        </div>
    </div>
    """

    return title, html_body


def send_via_buttondown(subject: str, body: str):
    """Send an email via Buttondown API."""
    if not BUTTONDOWN_API_KEY:
        raise ValueError("BUTTONDOWN_API_KEY not set")

    resp = httpx.post(
        BUTTONDOWN_API,
        headers={"Authorization": f"Token {BUTTONDOWN_API_KEY}"},
        json={
            "subject": subject,
            "body": body,
            "status": "default",
        },
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()
