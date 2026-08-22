# PROJECT CONTEXT — Platio

> Construction Project Finance & Expense Tracking System

## What This Is

Platio is an operational **project-finance tracking system** for construction businesses.
It is NOT accounting/ERP/payroll software. Its job is to make construction project
finances **clear, searchable, traceable and reportable**.

## Environment Inspection (Phase 1 findings)

- Working directory: `/home/hrk/Documents/Default Project` — **empty / new project**.
- Runtime available: **Node v26.7.0**, **Python 3.13.5**, npm 11, pip3.
- No Cloudflare, no D1, no R2, no external DB configured.
- Internet access to npm + PyPI confirmed.
- No existing code, UI framework, auth, or DB to integrate with.

**Conclusion:** Greenfield prototype. Per directive §28 we do NOT force Cloudflare.
We choose the simplest defensible architecture that satisfies reliability requirements.

## Chosen Stack

| Layer       | Choice                                              | Reason |
|-------------|-----------------------------------------------------|--------|
| API         | Python **FastAPI** (uvicorn)                        | Typed, fast, predictable REST |
| Database    | **SQLite** (file) via stdlib `sqlite3`              | Zero-infra, embedded, reliable, supports `INTEGER` money |
| Money       | Store as **integer paise** (smallest unit)          | Avoids float drift (directive §10) |
| Excel       | **openpyxl**                                        | Real structured `.xlsx` (directive §25) |
| Frontend    | **Vanilla HTML/CSS/JS** SPA served by API           | No build step, mobile-first, data-first (directive §35,36) |
| Receipts    | Local disk under `backend/data/receipts/`, metadata in DB, auth-served | Mirrors R2 pattern (directive §15,16) without external infra |
| Auth        | Session cookie + password hash (seeded admin)       | Simple, backend-enforced (directive §31) |

## Core Principles (from directive)

1. **Project isolation is fundamental** — every transaction has `project_id`; all queries filter at DB level.
2. **No approval workflow** — Record → Track → Categorise → Analyse → Report.
3. **Two cash concepts are distinct**: `Current Cash Balance = Income − Expenses` vs `Remaining Budget = Budget − Expenses`.
4. **Money is exact** — integer paise everywhere; Indian formatting on display.
5. **Auditability without approval** — audit log for create/edit/delete/budget changes; soft deletes.
6. **Dashboard & reports share one source of truth** — reusable finance functions.

## Scope for this Prototype (MVP = P0)

- Projects (CRUD, budget, status)
- Income & Expense recording
- Transaction list (search/filter), detail, edit, soft-delete
- Receipt upload (optional) + protected serve
- Global + per-project dashboard (totals, utilisation, category breakdown, trends)
- Reports with filters + **Excel export**
- Authentication (single seeded admin; roles field reserved)
- Audit log

Deferred (P1/P2): notifications, advanced permissions, vendor mgmt, budget planning.
