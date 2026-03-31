"""Vercel Cron Job — runs scrapers daily."""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from flask import Flask, jsonify, request

app = Flask(__name__)

CRON_SECRET = os.getenv("CRON_SECRET", "")


@app.route("/api/cron", methods=["GET"])
def cron():
    # Verify the request is from Vercel Cron
    if CRON_SECRET and request.headers.get("Authorization") != f"Bearer {CRON_SECRET}":
        return jsonify({"error": "Unauthorized"}), 401

    from backend.db import init_db
    init_db()

    from backend.scheduler import run_all
    results = run_all()

    # Auto-classify + translate new tools
    from backend.db.queries import get_unclassified_tools, save_classification, get_untranslated_tools, save_translation
    from backend.classifier import classify_tool
    from backend.translate import translate_tool

    classified = 0
    for tool in get_unclassified_tools(limit=100):
        ct, domain = classify_tool(tool)
        save_classification(tool["id"], ct, domain)
        classified += 1

    translated = 0
    for tool in get_untranslated_tools(limit=100):
        result = translate_tool(tool)
        save_translation(tool["id"], result.get("title_zh", ""), result.get("description_zh", ""))
        translated += 1

    return jsonify({
        "scrape": results,
        "classified": classified,
        "translated": translated,
    })
