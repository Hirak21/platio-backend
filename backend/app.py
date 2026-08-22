from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path

import db
import seed
import os
from routes import (
    auth_routes, project_routes, transaction_routes,
    dashboard_routes, report_routes, receipt_routes, category_routes,
    audit_routes,
)

from config import FRONTEND_DIR, CORS_ORIGINS

app = FastAPI(title="Platio — Construction Finance Tracker")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    db.init_db()
    seed.ensure_basics()
    if os.environ.get("PLATIO_NO_DEMO") != "1":
        seed.ensure_demo()

app.include_router(auth_routes.router)
app.include_router(project_routes.router)
app.include_router(transaction_routes.router)
app.include_router(dashboard_routes.router)
app.include_router(report_routes.router)
app.include_router(receipt_routes.router)
app.include_router(category_routes.router)
app.include_router(audit_routes.router)

# Serve static files (frontend) in production
app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")

@app.get("/")
def index():
    return FileResponse(str(FRONTEND_DIR / "index.html"))

# Health check endpoint for Cloud Run
@app.get("/health")
def health():
    return {"status": "healthy"}