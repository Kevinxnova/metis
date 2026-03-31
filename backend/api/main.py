"""FastAPI application entry point."""

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.config import FRONTEND_URL
from backend.db import init_db
from backend.api.routes import tools, issues, send, health, translate, discover

app = FastAPI(title="Metis", description="AI Tool Discovery Newsletter API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tools.router, prefix="/api")
app.include_router(issues.router, prefix="/api")
app.include_router(send.router, prefix="/api")
app.include_router(health.router, prefix="/api")
app.include_router(translate.router, prefix="/api")
app.include_router(discover.router, prefix="/api")


@app.on_event("startup")
def startup():
    init_db()
