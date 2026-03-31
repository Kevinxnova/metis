"""Newsletter issue management API routes."""

from fastapi import APIRouter, HTTPException

from backend.api.models import CreateIssue
from backend.db.queries import get_issues, get_issue, create_issue, get_tools

router = APIRouter(prefix="/issues", tags=["issues"])


@router.get("")
def list_issues():
    return get_issues()


@router.get("/{issue_number}")
def get_issue_detail(issue_number: int):
    issue = get_issue(issue_number)
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    return issue


@router.post("")
def new_issue(req: CreateIssue = CreateIssue()):
    approved = get_tools(status="approved")
    if not approved:
        raise HTTPException(status_code=400, detail="No approved tools to include in issue")

    issue_number = create_issue(title=req.title)
    return {"ok": True, "issue_number": issue_number}
