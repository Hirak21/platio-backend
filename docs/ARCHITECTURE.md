# ARCHITECTURE — Platio

## High-Level

```
Browser (Vanilla SPA)
        │  HTTPS / fetch
        ▼
FastAPI Backend (Python)
   ├─ Auth (session cookie)
   ├─ Projects API
   ├─ Transactions API
   ├─ Dashboard API
   ├─ Reports API  ──► openpyxl  ──► .xlsx
   ├─ Receipts API ──► local disk (auth-protected)
   └─ Audit logger
        │
        ▼
SQLite (backend/data/platio.db)
```

This mirrors the preferred Cloudflare topology (Frontend → API → SQL → Object storage)
without external infrastructure: SQLite replaces D1, local disk replaces R2.

## Directory Layout

```
platio/
  docs/                 required Hermes docs
  backend/
    app.py              FastAPI app + router wiring + static serving
    config.py           paths, secrets, settings
    db.py               sqlite connection + schema/migration bootstrap
    finance.py          money (paise) utils + shared calculation functions
    auth.py             password hashing, session, dependency
    audit.py            audit log helper
    seed.py             seed categories, admin user, demo data
    models.py           pydantic request/response models
    routes/
      auth_routes.py
      project_routes.py
      transaction_routes.py
      dashboard_routes.py
      report_routes.py
      receipt_routes.py
    data/               sqlite db + receipts/ (gitignored)
    tests/              pytest suite
  frontend/
    index.html          single page shell
    css/styles.css      professional, mobile-first design
    js/app.js           router + API client + view rendering
```

## Money Model

- All amounts stored as **INTEGER paise** (e.g. ₹1,250.50 → `125050`).
- `finance.py` owns conversion: `to_paise(Decimal) -> int`, `to_inr(int) -> "₹1,25,000.00"`.
- All sums done in integer space; never float.

## Calculation Source of Truth (`finance.py`)

- `project_financials(project)`: budget, total_income, total_expense, cash_balance, remaining_budget, utilisation%.
- `global_financials()`: aggregates across non-deleted projects/transactions.
- `expense_by_category()`, `income_by_category()`, `monthly_series()`.
- Dashboard AND reports call these same functions → totals always match (directive §27).

## Isolation & Security

- Every query filters by `project_id` at SQL level.
- Auth enforced by backend dependency (`require_user`); never frontend-only.
- Receipts served only through `/receipts/{id}` after auth + project membership check.
- Secrets via env (`PLATIO_SECRET`); `.env` gitignored.

## API Surface (summary)

- `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`
- `GET/POST /projects`, `GET/PATCH/DELETE /projects/{id}`
- `GET/POST /transactions`, `GET/PATCH/DELETE /transactions/{id}`
- `GET /dashboard`, `GET /projects/{id}/dashboard`
- `GET /reports` (filters), `POST /reports/export` (xlsx)
- `POST /receipts/upload`, `GET /receipts/{id}`
- `GET /audit-logs`
