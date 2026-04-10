"""Flask application entry point."""

import os
from dotenv import load_dotenv
load_dotenv()

from flask import Flask, request, jsonify

from backend.config import FRONTEND_URL
from backend.db import init_db
from backend.db.queries import (
    get_tools, get_tool, update_tool_status, log_curation, merge_tools,
    get_category_counts, set_featured, set_metis_pick,
    get_featured_tools, get_metis_picks, get_today_tools, get_random_tool,
    get_week_tools, save_user_message, get_user_messages,
    get_daily_digest,
    get_issues, get_issue, create_issue, mark_issue_sent,
    get_latest_scrape_runs, get_untranslated_tools, save_translation,
    get_daily_news, get_daily_news_list,
)
from backend.translate import translate_tool
from backend.email.sender import compose_email, send_via_buttondown
from backend.ai_recommend import generate_recommendations, get_cached_recommendations

app = Flask(__name__)

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", FRONTEND_URL).split(",")


@app.after_request
def cors(response):
    origin = request.headers.get("Origin", "")
    if origin in ALLOWED_ORIGINS or "*" in ALLOWED_ORIGINS:
        response.headers["Access-Control-Allow-Origin"] = origin
    else:
        response.headers["Access-Control-Allow-Origin"] = ALLOWED_ORIGINS[0]
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PATCH, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Allow-Credentials"] = "true"
    return response


@app.before_request
def handle_preflight():
    if request.method == "OPTIONS":
        return "", 204


ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "")


# --- Auth ---

@app.route("/api/admin/verify", methods=["POST"])
def admin_verify():
    data = request.get_json() or {}
    if not ADMIN_PASSWORD:
        return jsonify({"ok": True})  # No password set = open
    if data.get("password") == ADMIN_PASSWORD:
        return jsonify({"ok": True})
    return jsonify({"ok": False, "detail": "Wrong password"}), 401


# --- Health ---

@app.route("/api/health")
def health():
    return jsonify({"status": "ok"})


@app.route("/api/debug")
def debug():
    """Temporary debug endpoint to diagnose Turso connection."""
    import traceback
    info = {
        "turso_url_set": bool(os.getenv("TURSO_DATABASE_URL")),
        "turso_url_prefix": (os.getenv("TURSO_DATABASE_URL") or "")[:30],
        "turso_token_set": bool(os.getenv("TURSO_AUTH_TOKEN")),
        "turso_token_len": len(os.getenv("TURSO_AUTH_TOKEN") or ""),
    }
    try:
        from backend.db import get_db, _use_turso
        info["use_turso"] = _use_turso()
        with get_db() as db:
            count = db.execute("SELECT COUNT(*) as c FROM tools").fetchone()
            info["tools_count"] = count["c"]
            info["db_ok"] = True
    except Exception as e:
        info["db_ok"] = False
        info["error"] = str(e)
        info["traceback"] = traceback.format_exc()
    return jsonify(info)


@app.route("/api/health/scrapes")
def scrape_status():
    return jsonify({"scrapes": get_latest_scrape_runs()})


# --- Tools ---

@app.route("/api/tools")
def list_tools():
    return jsonify(get_tools(
        status=request.args.get("status"),
        content_type=request.args.get("content_type"),
        domain=request.args.get("domain"),
        limit=int(request.args.get("limit", 100)),
        offset=int(request.args.get("offset", 0)),
    ))


@app.route("/api/tools/categories")
def categories():
    return jsonify(get_category_counts())


@app.route("/api/tools/<int:tool_id>")
def get_tool_detail(tool_id):
    tool = get_tool(tool_id)
    if not tool:
        return jsonify({"detail": "Tool not found"}), 404
    return jsonify(tool)


@app.route("/api/tools/<int:tool_id>", methods=["PATCH"])
def update_tool(tool_id):
    tool = get_tool(tool_id)
    if not tool:
        return jsonify({"detail": "Tool not found"}), 404

    data = request.get_json()
    valid = {"approve": "approved", "skip": "skipped", "defer": "deferred",
             "archive": "archived", "unapprove": "pending"}
    action = data.get("status")
    new_status = valid.get(action)
    if not new_status:
        return jsonify({"detail": f"Invalid action: {action}"}), 400

    update_tool_status(tool_id, new_status)
    log_curation(tool_id=tool_id, action=action, take_text=data.get("take_text"))
    if data.get("take_text") and action != "skip":
        log_curation(tool_id=tool_id, action="edit_take", take_text=data["take_text"])
        # Auto-translate take to English
        try:
            from backend.translate import translate_take_to_en
            from backend.db.queries import save_take_en
            en = translate_take_to_en(data["take_text"])
            if en:
                save_take_en(tool_id, en)
        except Exception:
            pass

    return jsonify({"ok": True, "status": new_status})


@app.route("/api/tools/<int:tool_id>/merge", methods=["POST"])
def merge_tool(tool_id):
    data = request.get_json()
    merge_into = data.get("merge_into_id")
    if tool_id == merge_into:
        return jsonify({"detail": "Cannot merge tool into itself"}), 400
    if not merge_tools(keep_id=merge_into, merge_id=tool_id):
        return jsonify({"detail": "One or both tools not found"}), 404
    log_curation(tool_id=tool_id, action="merge", metadata={"merged_into": merge_into})
    return jsonify({"ok": True, "merged_into": merge_into})


@app.route("/api/tools/<int:tool_id>/featured", methods=["POST"])
def toggle_featured(tool_id):
    tool = get_tool(tool_id)
    if not tool:
        return jsonify({"detail": "Tool not found"}), 404
    on = request.args.get("on", "true").lower() == "true"
    set_featured(tool_id, on)
    return jsonify({"ok": True, "is_featured": on})


@app.route("/api/tools/<int:tool_id>/metis-pick", methods=["POST"])
def toggle_metis_pick(tool_id):
    tool = get_tool(tool_id)
    if not tool:
        return jsonify({"detail": "Tool not found"}), 404
    on = request.args.get("on", "true").lower() == "true"
    set_metis_pick(tool_id, on)
    return jsonify({"ok": True, "is_metis_pick": on})


# --- Issues ---

@app.route("/api/issues")
def list_issues():
    return jsonify(get_issues())


@app.route("/api/issues/<int:issue_number>")
def get_issue_detail(issue_number):
    issue = get_issue(issue_number)
    if not issue:
        return jsonify({"detail": "Issue not found"}), 404
    return jsonify(issue)


@app.route("/api/issues", methods=["POST"])
def new_issue():
    data = request.get_json() or {}
    approved = get_tools(status="approved")
    if not approved:
        return jsonify({"detail": "No approved tools"}), 400
    num = create_issue(title=data.get("title"))
    return jsonify({"ok": True, "issue_number": num})


# --- Send ---

@app.route("/api/send/<int:issue_number>", methods=["POST"])
def send_issue(issue_number):
    issue = get_issue(issue_number)
    if not issue:
        return jsonify({"detail": "Issue not found"}), 404
    if issue["status"] == "sent":
        return jsonify({"detail": "Issue already sent"}), 409
    if not issue.get("tools"):
        return jsonify({"detail": "Issue has no tools"}), 400
    subject, html_body = compose_email(issue)
    try:
        send_via_buttondown(subject=subject, body=html_body)
    except Exception as e:
        return jsonify({"detail": f"Buttondown send failed: {e}"}), 502
    mark_issue_sent(issue_number)
    return jsonify({"ok": True, "issue_number": issue_number, "status": "sent"})


# --- Translate ---

@app.route("/api/translate/batch", methods=["POST"])
def translate_batch():
    limit = int(request.args.get("limit", 20))
    untranslated = get_untranslated_tools(limit=limit)
    translated = 0
    for tool in untranslated:
        result = translate_tool(tool)
        save_translation(tool["id"], result.get("title_zh", ""), result.get("description_zh", ""))
        translated += 1
    return jsonify({"translated": translated, "remaining": len(get_untranslated_tools(limit=1))})


# --- Discover ---

@app.route("/api/discover/featured")
def featured():
    return jsonify(get_featured_tools())


@app.route("/api/discover/metis-picks")
def metis_picks():
    return jsonify(get_metis_picks())


@app.route("/api/discover/ai-picks")
def ai_picks():
    return jsonify(get_cached_recommendations())


@app.route("/api/discover/ai-picks/generate", methods=["POST"])
def generate_ai_picks():
    results = generate_recommendations()
    return jsonify({"count": len(results), "picks": results})


@app.route("/api/discover/today")
def today():
    return jsonify(get_today_tools())


@app.route("/api/discover/week")
def week():
    return jsonify(get_week_tools())


@app.route("/api/discover/digest")
def digest():
    return jsonify(get_daily_digest())


@app.route("/api/discover/random")
def random_tool():
    tool = get_random_tool()
    if not tool:
        return jsonify({"detail": "No tools found"}), 404
    return jsonify(tool)


# --- User Messages ---

@app.route("/api/messages", methods=["POST"])
def post_message():
    data = request.get_json() or {}
    content = (data.get("content") or "").strip()
    if not content:
        return jsonify({"detail": "Content required"}), 400
    nickname = (data.get("nickname") or "").strip()
    msg_id = save_user_message(content, nickname)
    return jsonify({"ok": True, "id": msg_id})


@app.route("/api/messages")
def list_messages():
    return jsonify(get_user_messages())


# --- AI Daily News ---

@app.route("/api/daily-news")
def daily_news():
    date = request.args.get("date")
    news = get_daily_news(date)
    if not news:
        return jsonify({"detail": "No daily news available"}), 404
    return jsonify(news)


@app.route("/api/daily-news/list")
def daily_news_list():
    limit = int(request.args.get("limit", 7))
    offset = int(request.args.get("offset", 0))
    return jsonify(get_daily_news_list(limit, offset))


@app.route("/api/daily-news/generate", methods=["POST"])
def generate_daily_news_route():
    from backend.daily_news import generate_daily_news
    force = request.args.get("force", "false").lower() == "true"
    result = generate_daily_news(force=force)
    if not result:
        return jsonify({"detail": "Generation failed — check logs or news availability"}), 500
    return jsonify({"ok": True, "news": result})


# --- Cron Logs ---

@app.route("/api/cron-logs")
def cron_logs():
    from backend.db.queries import get_cron_logs
    task = request.args.get("task")
    limit = int(request.args.get("limit", 50))
    return jsonify(get_cron_logs(limit=limit, task_name=task))


# Init DB on import
init_db()
