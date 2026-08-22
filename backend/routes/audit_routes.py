from fastapi import APIRouter, Depends, HTTPException

import db
import auth

router = APIRouter(prefix="/audit-logs", tags=["audit"])


@router.get("")
def list_audit(limit: int = 100, entity_type: str | None = None, user=Depends(auth.require_user)):
    conn = db.get_conn()
    try:
        if entity_type:
            rows = conn.execute(
                "SELECT * FROM audit_logs WHERE entity_type = ? ORDER BY id DESC LIMIT ?",
                (entity_type, limit),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM audit_logs ORDER BY id DESC LIMIT ?", (limit,)
            ).fetchall()
    finally:
        conn.close()
    return [dict(r) for r in rows]
