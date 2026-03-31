"""Translation API routes. Batch-translate tools to Chinese."""

from fastapi import APIRouter

from backend.db.queries import get_untranslated_tools, save_translation, get_tools
from backend.translate import translate_tool

router = APIRouter(prefix="/translate", tags=["translate"])


@router.post("/batch")
def translate_batch(limit: int = 20):
    """Translate untranslated tools. Returns count of newly translated tools."""
    untranslated = get_untranslated_tools(limit=limit)
    translated = 0

    for tool in untranslated:
        result = translate_tool(tool)
        save_translation(
            tool_id=tool["id"],
            title_zh=result.get("title_zh", ""),
            description_zh=result.get("description_zh", ""),
        )
        translated += 1

    return {"translated": translated, "remaining": len(get_untranslated_tools(limit=1))}


@router.post("/tool/{tool_id}")
def translate_single(tool_id: int):
    """Translate a single tool on demand."""
    from backend.db.queries import get_tool
    tool = get_tool(tool_id)
    if not tool:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Tool not found")

    if tool.get("title_zh"):
        return {"already_translated": True}

    result = translate_tool(tool)
    save_translation(
        tool_id=tool_id,
        title_zh=result.get("title_zh", ""),
        description_zh=result.get("description_zh", ""),
    )
    return {"ok": True, "title_zh": result["title_zh"], "description_zh": result.get("description_zh", "")}
