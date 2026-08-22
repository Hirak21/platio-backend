from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone

import db
import auth
import audit
from models import ProjectCreate, ProjectUpdate
from calc import project_financials, global_financials
from finance import to_paise

router = APIRouter(prefix="/projects", tags=["projects"])


def _now():
    return datetime.now(timezone.utc).isoformat()


def serialize(row, fin):
    d = dict(row)
    d.pop("deleted_at", None)
    d.pop("deleted_by", None)
    d["budget"] = d.pop("budget_paise") / 100
    if fin:
        d.update(
            {
                "total_income": fin["total_income_paise"] / 100,
                "total_expense": fin["total_expense_paise"] / 100,
                "cash_balance": fin["cash_balance_paise"] / 100,
                "remaining_budget": fin["remaining_budget_paise"] / 100,
                "utilisation_pct": fin["utilisation_pct"],
                "budget_exceeded": fin["budget_exceeded"],
                "budget_exceeded_by": fin["budget_exceeded_by_paise"] / 100,
            }
        )
    return d


@router.get("")
def list_projects(user=Depends(auth.require_user)):
    conn = db.get_conn()
    try:
        rows = conn.execute(
            "SELECT * FROM projects WHERE deleted_at IS NULL ORDER BY created_at DESC"
        ).fetchall()
    finally:
        conn.close()
    out = []
    for r in rows:
        fin = project_financials(r["id"])
        out.append(serialize(r, fin))
    return out


@router.post("")
def create_project(payload: ProjectCreate, user=Depends(auth.require_user)):
    conn = db.get_conn()
    try:
        code = payload.project_code
        if not code:
            code = "PRJ-" + _now()[:10].replace("-", "") + "-" + str(conn.execute("SELECT COUNT(*) n FROM projects").fetchone()["n"] + 1).zfill(3)
        exists = conn.execute("SELECT id FROM projects WHERE project_code = ?", (code,)).fetchone()
        if exists:
            raise HTTPException(status_code=400, detail="Project code already exists")
        budget = to_paise(payload.budget)
        cur = conn.execute(
            """INSERT INTO projects
               (project_code, name, description, client_name, location, start_date,
                expected_end_date, budget_paise, status, created_at, updated_at)
               VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
            (
                code,
                payload.name,
                payload.description,
                payload.client_name,
                payload.location,
                payload.start_date,
                payload.expected_end_date,
                budget,
                payload.status,
                _now(),
                _now(),
            ),
        )
        pid = cur.lastrowid
        conn.commit()
    finally:
        conn.close()
    audit.log("project_created", "project", pid, new_value=payload.model_dump(), actor_id=user["id"])
    return {"id": pid, "project_code": code}


@router.get("/{project_id}")
def get_project(project_id: int, user=Depends(auth.require_user)):
    conn = db.get_conn()
    try:
        row = conn.execute(
            "SELECT * FROM projects WHERE id = ? AND deleted_at IS NULL", (project_id,)
        ).fetchone()
    finally:
        conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Project not found")
    return serialize(row, project_financials(project_id))


@router.patch("/{project_id}")
def update_project(project_id: int, payload: ProjectUpdate, user=Depends(auth.require_user)):
    conn = db.get_conn()
    try:
        row = conn.execute("SELECT * FROM projects WHERE id = ? AND deleted_at IS NULL", (project_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Project not found")
        old = {k: row[k] for k in row.keys()}
        data = payload.model_dump(exclude_unset=True)
        updates = {}
        for k, v in data.items():
            if v is None:
                continue
            if k == "budget":
                updates["budget_paise"] = to_paise(v)
            else:
                updates[k] = v
        if not updates:
            return {"ok": True}
        set_sql = ", ".join(f"{k} = ?" for k in updates) + ", updated_at = ?"
        conn.execute(
            f"UPDATE projects SET {set_sql} WHERE id = ?",
            list(updates.values()) + [_now(), project_id],
        )
        conn.commit()
    finally:
        conn.close()
    audit.log("project_updated", "project", project_id, old_value=old, new_value=updates, actor_id=user["id"])
    return {"ok": True}


@router.delete("/{project_id}")
def delete_project(project_id: int, user=Depends(auth.require_user)):
    conn = db.get_conn()
    try:
        conn.execute(
            "UPDATE projects SET deleted_at = ?, deleted_by = ? WHERE id = ?",
            (_now(), user["id"], project_id),
        )
        conn.commit()
    finally:
        conn.close()
    audit.log("project_deleted", "project", project_id, actor_id=user["id"])
    return {"ok": True}
