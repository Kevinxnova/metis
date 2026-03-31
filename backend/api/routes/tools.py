"""Tool management API routes."""

from fastapi import APIRouter, HTTPException

from backend.api.models import ToolAction, MergeRequest
from backend.db.queries import (
    get_tools, get_tool, update_tool_status,
    log_curation, merge_tools, get_category_counts,
)

router = APIRouter(prefix="/tools", tags=["tools"])


@router.get("")
def list_tools(status: str | None = None, content_type: str | None = None,
               domain: str | None = None, limit: int = 100, offset: int = 0):
    return get_tools(status=status, content_type=content_type,
                     domain=domain, limit=limit, offset=offset)


@router.get("/categories")
def categories():
    return get_category_counts()


@router.get("/{tool_id}")
def get_tool_detail(tool_id: int):
    tool = get_tool(tool_id)
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    return tool


@router.patch("/{tool_id}")
def update_tool(tool_id: int, action: ToolAction):
    tool = get_tool(tool_id)
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")

    valid_statuses = {"approve": "approved", "skip": "skipped", "defer": "deferred",
                      "archive": "archived", "unapprove": "pending"}
    new_status = valid_statuses.get(action.status)
    if not new_status:
        raise HTTPException(status_code=400, detail=f"Invalid action: {action.status}")

    update_tool_status(tool_id, new_status)

    # Log curation decision with full context
    log_curation(
        tool_id=tool_id,
        action=action.status,
        take_text=action.take_text,
    )

    # If take text provided separately, also log it
    if action.take_text and action.status != "skip":
        log_curation(tool_id=tool_id, action="edit_take", take_text=action.take_text)

    return {"ok": True, "status": new_status}


@router.post("/{tool_id}/merge")
def merge_tool(tool_id: int, req: MergeRequest):
    if tool_id == req.merge_into_id:
        raise HTTPException(status_code=400, detail="Cannot merge tool into itself")

    success = merge_tools(keep_id=req.merge_into_id, merge_id=tool_id)
    if not success:
        raise HTTPException(status_code=404, detail="One or both tools not found")

    log_curation(tool_id=tool_id, action="merge", metadata={"merged_into": req.merge_into_id})

    return {"ok": True, "merged_into": req.merge_into_id}
