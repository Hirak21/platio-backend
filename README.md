# Platio — Construction Finance & Expense Tracker (Prototype)

A simple, reliable project-finance tracking system for construction work.
Track income, expenses, budgets, receipts and reports per project — with
correct, auditable money math and Excel export.

## Stack
- **Backend:** Python FastAPI + SQLite (money stored as integer paise)
- **Excel:** openpyxl (real structured `.xlsx`)
- **Frontend:** vanilla HTML/CSS/JS SPA (no build step, mobile-first)
- **Receipts:** stored on local disk, served only through auth

## Run

```bash
cd backend
# install deps locally (system Python is externally-managed here)
python3 -m pip install --target=libs -r requirements.txt
python3 -m pip install --target=libs httpx pytest   # for tests

# start
PYTHONPATH=libs python3 -m uvicorn app:app --port 8000
```

Open http://localhost:8000

**Login:** `admin` / `platio1234`  (auto-created on first start; demo projects
are seeded so the dashboard is populated immediately.)

## Features (MVP / P0)
- Projects (CRUD, budget, status) with full financial isolation
- Income & Expense recording (validated, soft-deleted)
- Transactions list: search + filters + pagination, detail/edit modal
- Receipt upload (jpg/png/webp/pdf, ≤10MB) + protected serve
- Global + per-project dashboard (totals, utilisation, category breakdown, trend)
- Budget-exceeded warning
- Reports with filters + **Excel export** (Summary / Transactions / Expense / Income sheets)
- Audit log (create/edit/delete/budget/receipt)
- Configurable categories (Settings)

## Tests
```bash
cd backend
PYTHONPATH=libs python3 -m pytest -q
```
Covers: exact money math, Indian formatting, project isolation, budget-exceeded,
edit audit trail, date-range reporting, Excel total consistency, receipt upload/serve.

## Notes
- `backend/data/` holds the SQLite DB and receipts (gitignored).
- No external infra (Cloudflare/D1/R2) required; the architecture mirrors that
  topology locally (SQLite ≈ D1, disk ≈ R2).
- Money is exact integer paise — never floats — and the dashboard and reports
  share the same calculation functions, so totals always match.
# platio-backend
