"""Email sending API routes."""

from fastapi import APIRouter, HTTPException

from backend.db.queries import get_issue, mark_issue_sent
from backend.email.sender import compose_email, send_via_buttondown

router = APIRouter(prefix="/send", tags=["send"])


@router.post("/{issue_number}")
def send_issue(issue_number: int):
    issue = get_issue(issue_number)
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")

    if issue["status"] == "sent":
        raise HTTPException(status_code=409, detail="Issue already sent")

    if not issue.get("tools"):
        raise HTTPException(status_code=400, detail="Issue has no tools")

    # Compose email HTML
    subject, html_body = compose_email(issue)

    # Send via Buttondown
    try:
        send_via_buttondown(subject=subject, body=html_body)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Buttondown send failed: {e}")

    # Mark as sent
    mark_issue_sent(issue_number)

    return {"ok": True, "issue_number": issue_number, "status": "sent"}
