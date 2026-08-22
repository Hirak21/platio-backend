"""Audit logging helper. Every important financial action is recorded."""
from datetime import datetime, timezone

import db


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def log(
    action: str,
    entity_type: str = None,
    entity_id: int = None,
    old_value=None,
    new_value=None,
    reason: str = None,
    actor_id: int = None,
):
    import json

    def pack(v):
        if v is None:
            return None
        if isinstance(v, (dict, list)):
            return json.dumps(v, default=str)
        return str(v)

    conn = db.get_conn()
    try:
        conn.execute(
            """INSERT INTO audit_logs
               (actor_id, action, entity_type, entity_id, old_value, new_value, reason, created_at)
               VALUES (?,?,?,?,?,?,?,?)""",
            (
                actor_id,
                action,
                entity_type,
                entity_id,
                pack(old_value),
                pack(new_value),
                reason,
                _now(),
            ),
        )
        conn.commit()
    finally:
        conn.close()
