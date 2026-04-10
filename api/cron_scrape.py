"""Vercel Cron — scrape all sources."""

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv
load_dotenv()

from flask import Flask, jsonify, request

app = Flask(__name__)
CRON_SECRET = os.getenv("CRON_SECRET", "")


@app.route("/api/cron/scrape", methods=["GET"])
def cron_scrape():
    if CRON_SECRET and request.headers.get("Authorization") != f"Bearer {CRON_SECRET}":
        return jsonify({"error": "Unauthorized"}), 401
    from backend.cron_tasks import task_scrape
    return jsonify(task_scrape())
