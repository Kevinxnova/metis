"""Vercel Cron — classify and translate tools."""

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv
load_dotenv()

from flask import Flask, jsonify, request
from backend.security import bearer_matches, secret_is_configured

app = Flask(__name__)
@app.route("/api/cron/classify", methods=["GET"])
def cron_classify():
    if not secret_is_configured("CRON_SECRET"):
        return jsonify({"error": "Cron access is not configured"}), 503
    if not bearer_matches(request.headers.get("Authorization")):
        return jsonify({"error": "Unauthorized"}), 401
    from backend.cron_tasks import task_classify
    return jsonify(task_classify())
