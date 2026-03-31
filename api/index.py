"""Vercel Serverless Function entry point for FastAPI."""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from mangum import Mangum
from backend.api.main import app

handler = Mangum(app, lifespan="off")
