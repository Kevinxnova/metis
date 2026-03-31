"""Pydantic models for API request/response."""

from pydantic import BaseModel


class ToolAction(BaseModel):
    status: str  # approve, skip, defer, archive, unapprove
    take_text: str | None = None


class MergeRequest(BaseModel):
    merge_into_id: int


class CreateIssue(BaseModel):
    title: str | None = None


class SendIssue(BaseModel):
    pass  # No body needed, issue_number is in the URL
