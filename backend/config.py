import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = Path(os.environ.get("PLATIO_DATA_DIR", str(BASE_DIR / "data")))
DB_PATH = DATA_DIR / "platio.db"
RECEIPTS_DIR = DATA_DIR / "receipts"
FRONTEND_DIR = BASE_DIR.parent / "frontend"

DATA_DIR.mkdir(parents=True, exist_ok=True)
RECEIPTS_DIR.mkdir(parents=True, exist_ok=True)

# Secret key - MUST be set in production via env var
SECRET = os.environ.get("PLATIO_SECRET")
if not SECRET:
    raise RuntimeError("PLATIO_SECRET environment variable must be set in production")

SESSION_COOKIE = "platio_session"
SESSION_MAX_AGE = 60 * 60 * 24 * 7  # 7 days

# CORS origins - comma-separated list in production
CORS_ORIGINS = os.environ.get("PLATIO_CORS_ORIGINS", "http://localhost:8000,http://127.0.0.1:8000").split(",")

ALLOWED_RECEIPT_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "application/pdf": ".pdf",
}
MAX_RECEIPT_BYTES = 10 * 1024 * 1024  # 10 MB
