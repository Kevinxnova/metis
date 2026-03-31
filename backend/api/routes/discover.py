"""Discovery page API routes — serves the 4 sections."""

from fastapi import APIRouter

from backend.db.queries import get_featured_tools, get_metis_picks, get_today_tools
from backend.ai_recommend import generate_recommendations, get_cached_recommendations

router = APIRouter(prefix="/discover", tags=["discover"])


@router.get("/featured")
def featured():
    """Editor's picks — pinned at top."""
    return get_featured_tools()


@router.get("/metis-picks")
def metis_picks():
    """Metis curated picks — manual now, digital twin later."""
    return get_metis_picks()


@router.get("/ai-picks")
def ai_picks():
    """AI-recommended tools with reasons and use cases."""
    return get_cached_recommendations()


@router.post("/ai-picks/generate")
def generate_ai_picks():
    """Trigger AI recommendation generation for today."""
    results = generate_recommendations()
    return {"count": len(results), "picks": results}


@router.get("/today")
def today():
    """All tools discovered today."""
    return get_today_tools()
