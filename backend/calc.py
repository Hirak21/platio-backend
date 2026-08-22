"""Shared financial calculation functions.

This is the SINGLE SOURCE OF TRUTH for all money math (directive §27).
Both the Dashboard API and the Reports/Excel export call these functions,
so totals can never diverge.

Money is stored as integer paise; all sums are integer arithmetic.
Soft-deleted rows (deleted_at IS NOT NULL) are always excluded.
"""
from datetime import datetime, timezone

import db


def _conn(conn):
    return conn if conn is not None else db.get_conn()


def _close(conn, own):
    if own:
        conn.close()


def _txn_where(project_id=None, from_date=None, to_date=None, type_=None):
    clauses = ["t.deleted_at IS NULL"]
    params = []
    if project_id is not None:
        clauses.append("t.project_id = ?")
        params.append(project_id)
    if from_date:
        clauses.append("t.date >= ?")
        params.append(from_date)
    if to_date:
        clauses.append("t.date <= ?")
        params.append(to_date)
    if type_:
        clauses.append("t.type = ?")
        params.append(type_)
    return " AND ".join(clauses), params


def project_financials(project_id, conn=None):
    own = conn is None
    c = _conn(conn)
    try:
        proj = c.execute(
            "SELECT * FROM projects WHERE id = ? AND deleted_at IS NULL",
            (project_id,),
        ).fetchone()
        if not proj:
            return None
        budget = proj["budget_paise"]
        income = c.execute(
            "SELECT COALESCE(SUM(amount_paise),0) AS s FROM transactions "
            "WHERE project_id = ? AND type='income' AND deleted_at IS NULL",
            (project_id,),
        ).fetchone()["s"]
        expense = c.execute(
            "SELECT COALESCE(SUM(amount_paise),0) AS s FROM transactions "
            "WHERE project_id = ? AND type='expense' AND deleted_at IS NULL",
            (project_id,),
        ).fetchone()["s"]
        cash_balance = income - expense
        remaining_budget = budget - expense
        utilisation = (expense / budget * 100) if budget > 0 else 0.0
        return {
            "project_id": project_id,
            "budget_paise": budget,
            "total_income_paise": income,
            "total_expense_paise": expense,
            "cash_balance_paise": cash_balance,
            "remaining_budget_paise": remaining_budget,
            "utilisation_pct": round(utilisation, 2),
            "budget_exceeded": remaining_budget < 0,
            "budget_exceeded_by_paise": -remaining_budget if remaining_budget < 0 else 0,
        }
    finally:
        _close(c, own)


def global_financials(conn=None):
    own = conn is None
    c = _conn(conn)
    try:
        budgets = c.execute(
            "SELECT COALESCE(SUM(budget_paise),0) AS s FROM projects WHERE deleted_at IS NULL"
        ).fetchone()["s"]
        income = c.execute(
            "SELECT COALESCE(SUM(amount_paise),0) AS s FROM transactions t "
            "JOIN projects p ON p.id = t.project_id "
            "WHERE t.type='income' AND t.deleted_at IS NULL AND p.deleted_at IS NULL"
        ).fetchone()["s"]
        expense = c.execute(
            "SELECT COALESCE(SUM(amount_paise),0) AS s FROM transactions t "
            "JOIN projects p ON p.id = t.project_id "
            "WHERE t.type='expense' AND t.deleted_at IS NULL AND p.deleted_at IS NULL"
        ).fetchone()["s"]
        cash_balance = income - expense
        remaining_budget = budgets - expense
        total_projects = c.execute(
            "SELECT COUNT(*) AS n FROM projects WHERE deleted_at IS NULL"
        ).fetchone()["n"]
        active_projects = c.execute(
            "SELECT COUNT(*) AS n FROM projects WHERE deleted_at IS NULL AND status='active'"
        ).fetchone()["n"]
        return {
            "total_projects": total_projects,
            "active_projects": active_projects,
            "total_budget_paise": budgets,
            "total_income_paise": income,
            "total_expense_paise": expense,
            "total_cash_balance_paise": cash_balance,
            "total_remaining_budget_paise": remaining_budget,
            "utilisation_pct": round((expense / budgets * 100) if budgets > 0 else 0.0, 2),
        }
    finally:
        _close(c, own)


def expense_by_category(project_id=None, from_date=None, to_date=None, conn=None):
    own = conn is None
    c = _conn(conn)
    try:
        where, params = _txn_where(project_id, from_date, to_date, "expense")
        rows = c.execute(
            f"""SELECT COALESCE(c.name, 'Uncategorised') AS category,
                       COALESCE(SUM(t.amount_paise),0) AS total
                FROM transactions t
                LEFT JOIN categories c ON c.id = t.category_id
                WHERE {where}
                GROUP BY category ORDER BY total DESC""",
            params,
        ).fetchall()
        total = sum(r["total"] for r in rows)
        return [
            {
                "category": r["category"],
                "total_paise": r["total"],
                "pct": round((r["total"] / total * 100) if total else 0, 2),
            }
            for r in rows
        ]
    finally:
        _close(c, own)


def income_by_category(project_id=None, from_date=None, to_date=None, conn=None):
    own = conn is None
    c = _conn(conn)
    try:
        where, params = _txn_where(project_id, from_date, to_date, "income")
        rows = c.execute(
            f"""SELECT COALESCE(c.name, 'Uncategorised') AS category,
                       COALESCE(SUM(t.amount_paise),0) AS total
                FROM transactions t
                LEFT JOIN categories c ON c.id = t.category_id
                WHERE {where}
                GROUP BY category ORDER BY total DESC""",
            params,
        ).fetchall()
        total = sum(r["total"] for r in rows)
        return [
            {
                "category": r["category"],
                "total_paise": r["total"],
                "pct": round((r["total"] / total * 100) if total else 0, 2),
            }
            for r in rows
        ]
    finally:
        _close(c, own)


def monthly_series(project_id=None, from_date=None, to_date=None, conn=None):
    own = conn is None
    c = _conn(conn)
    try:
        where, params = _txn_where(project_id, from_date, to_date)
        rows = c.execute(
            f"""SELECT substr(t.date,1,7) AS month, t.type AS type,
                       COALESCE(SUM(t.amount_paise),0) AS total
                FROM transactions t WHERE {where}
                GROUP BY month, type ORDER BY month""",
            params,
        ).fetchall()
        data = {}
        for r in rows:
            m = data.setdefault(r["month"], {"income_paise": 0, "expense_paise": 0})
            m[r["type"] + "_paise"] = r["total"]
        return [
            {
                "month": k,
                "income_paise": v["income_paise"],
                "expense_paise": v["expense_paise"],
            }
            for k, v in sorted(data.items())
        ]
    finally:
        _close(c, own)


def fetch_transactions(
    project_id=None,
    type_=None,
    category=None,
    party=None,
    payment_method=None,
    from_date=None,
    to_date=None,
    has_receipt=None,
    search=None,
    limit=100,
    offset=0,
    conn=None,
):
    own = conn is None
    c = _conn(conn)
    try:
        clauses = ["t.deleted_at IS NULL"]
        params = []
        if project_id is not None:
            clauses.append("t.project_id = ?")
            params.append(project_id)
        if type_:
            clauses.append("t.type = ?")
            params.append(type_)
        if category:
            clauses.append("c.name = ?")
            params.append(category)
        if party:
            clauses.append("t.party LIKE ?")
            params.append(f"%{party}%")
        if payment_method:
            clauses.append("t.payment_method = ?")
            params.append(payment_method)
        if from_date:
            clauses.append("t.date >= ?")
            params.append(from_date)
        if to_date:
            clauses.append("t.date <= ?")
            params.append(to_date)
        if has_receipt is True:
            clauses.append("t.receipt_id IS NOT NULL")
        elif has_receipt is False:
            clauses.append("t.receipt_id IS NULL")
        if search:
            clauses.append(
                "(t.description LIKE ? OR t.party LIKE ? OR t.reference_number LIKE ? OR t.notes LIKE ?)"
            )
            params.extend([f"%{search}%"] * 4)
        where = " AND ".join(clauses)
        count = c.execute(
            f"SELECT COUNT(*) AS n FROM transactions t LEFT JOIN categories c ON c.id=t.category_id WHERE {where}",
            params,
        ).fetchone()["n"]
        rows = c.execute(
            f"""SELECT t.*, c.name AS category_name, p.name AS project_name,
                       p.project_code AS project_code,
                       u.display_name AS recorded_by,
                       r.id AS receipt_present
                FROM transactions t
                LEFT JOIN categories c ON c.id = t.category_id
                LEFT JOIN projects p ON p.id = t.project_id
                LEFT JOIN users u ON u.id = t.created_by
                LEFT JOIN receipts r ON r.id = t.receipt_id
                WHERE {where}
                ORDER BY t.date DESC, t.id DESC
                LIMIT ? OFFSET ?""",
            params + [limit, offset],
        ).fetchall()
        return [dict(r) for r in rows], count
    finally:
        _close(c, own)
