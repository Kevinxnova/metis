"""Vercel Cron — full pipeline (manual trigger / legacy).

Runs all tasks sequentially: scrape → daily_news → classify → digest.
Kept as a manual full-pipeline trigger. Scheduled crons now use individual endpoints.
"""

import sys
import os
import time
import logging

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from flask import Flask, jsonify, request
from backend.security import bearer_matches, secret_is_configured

app = Flask(__name__)
logger = logging.getLogger(__name__)

MAX_DURATION = 270


@app.route("/api/cron", methods=["GET"])
def cron():
    if not secret_is_configured("CRON_SECRET"):
        return jsonify({"error": "Cron access is not configured"}), 503
    if not bearer_matches(request.headers.get("Authorization")):
        return jsonify({"error": "Unauthorized"}), 401

    start = time.time()
    from backend.cron_tasks import task_scrape, task_daily_news, task_classify, task_digest

    results = {}

    for name, fn in [("scrape", task_scrape), ("daily_news", task_daily_news),
                     ("classify", task_classify), ("digest", task_digest)]:
        if time.time() - start > MAX_DURATION:
            results[name] = {"status": "skipped", "reason": "time_budget_exhausted"}
            break
        try:
            results[name] = fn()
        except Exception as e:
            results[name] = {"status": "error", "error": str(e)}

    results["elapsed_seconds"] = round(time.time() - start, 1)
    return jsonify(results)
