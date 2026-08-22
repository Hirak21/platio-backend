from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone

import db
import auth
from models import ProjectCreate

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("")
def list_categories(kind: str = "expense", user=Depends(auth.require_user)):
    conn = db.get_conn()
    try:
        rows = conn.execute(
            "SELECT id, name, kind, is_active FROM categories WHERE kind = ? ORDER BY name",
            (kind,),
        ).fetchall()
    finally:
        conn.close()
    return [dict(r) for r in rows]


@router.post("")
def add_category(kind: str, name: str, user=Depends(auth.require_user)):
    if kind not in ("expense", "income"):
        raise HTTPException(status_code=400, detail="kind must be expense or income")
    conn = db.get_conn()
    try:
        exists = conn.execute(
            "SELECT id FROM categories WHERE kind = ? AND name = ?", (kind, name)
        ).fetchone()
        if exists:
            conn.execute("UPDATE categories SET is_active = 1 WHERE id = ?", (exists["id"],))
            conn.commit()
            return {"id": exists["id"], "name": name, "kind": kind}
        cur = conn.execute(
            "INSERT INTO categories (kind, name, is_active, created_at) VALUES (?,?,1,?)",
            (kind, name, datetime.now(timezone.utc).isoformat()),
        )
        conn.commit()
        return {"id": cur.lastrowid, "name": name, "kind": kind}
    finally:
        conn.close()


@router.patch("/{category_id}")
def toggle_category(category_id: int, active: bool, user=Depends(auth.require_user)):
    conn = db.get_conn()
    try:
        conn.execute("UPDATE categories SET is_active = ? WHERE id = ?", (1 if active else 0, category_id))
        conn.commit()
    finally:
        conn.close()
    return {"ok": True}
