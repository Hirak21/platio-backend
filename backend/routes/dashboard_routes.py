from fastapi import APIRouter, Depends, HTTPException

import db
import auth
from calc import (
    global_financials, project_financials, expense_by_category,
    income_by_category, monthly_series, fetch_transactions,
)

router = APIRouter(tags=["dashboard"])


@router.get("/dashboard")
def dashboard(user=Depends(auth.require_user)):
    g = global_financials()
    return {
        "global": g,
        "expense_by_category": expense_by_category(),
        "income_by_category": income_by_category(),
        "monthly": monthly_series(),
        "recent": [
            {k: v for k, v in r.items()}
            for r in fetch_transactions(limit=10)[0]
        ],
    }


@router.get("/projects/{project_id}/dashboard")
def project_dashboard(project_id: int, user=Depends(auth.require_user)):
    fin = project_financials(project_id)
    if not fin:
        raise HTTPException(status_code=404, detail="Project not found")
    conn = db.get_conn()
    try:
        name = conn.execute(
            "SELECT name, project_code FROM projects WHERE id = ? AND deleted_at IS NULL",
            (project_id,),
        ).fetchone()
    finally:
        conn.close()
    return {
        "project_id": project_id,
        "project_name": name["name"],
        "project_code": name["project_code"],
        "financials": fin,
        "expense_by_category": expense_by_category(project_id=project_id),
        "income_by_category": income_by_category(project_id=project_id),
        "monthly": monthly_series(project_id=project_id),
        "recent": [
            {k: v for k, v in r.items()}
            for r in fetch_transactions(project_id=project_id, limit=10)[0]
        ],
    }
