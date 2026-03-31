"""Vercel Serverless Function entry point for FastAPI."""

import sys
import os

# Add project root to path so imports work
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from backend.api.main import app

# Vercel uses the `app` variable directly as ASGI handler
