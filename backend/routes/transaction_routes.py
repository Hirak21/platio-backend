from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import datetime, timezone

import db
import auth
import audit
from models import TransactionCreate, TransactionUpdate
from finance import to_paise
from calc import fetch_transactions, project_financials

router = APIRouter(prefix="/transactions", tags=["transactions"])


def _now():
    return datetime.now(timezone.utc).isoformat()


def _valid_date(s: str) -> bool:
    try:
        datetime.strptime(s, "%Y-%m-%d")
        return True
    except Exception:
        return False


def resolve_category(conn, kind: str, name: str | None):
    if not name:
        return None
    row = conn.execute(
        "SELECT id FROM categories WHERE kind = ? AND name = ?", (kind, name)
    ).fetchone()
    if row:
        return row["id"]
    cur = conn.execute(
        "INSERT INTO categories (kind, name, is_active, created_at) VALUES (?,?,1,?)",
        (kind, name, _now()),
    )
    return cur.lastrowid


def serialize(row):
    d = dict(row)
    d["amount"] = d.pop("amount_paise") / 100
    d["has_receipt"] = bool(d.pop("receipt_present", None))
    d.pop("deleted_at", None)
    d.pop("deleted_by", None)
    return d


@router.post("")
def create_transaction(payload: TransactionCreate, user=Depends(auth.require_user)):
    if payload.type not in ("income", "expense"):
        raise HTTPException(status_code=400, detail="type must be 'income' or 'expense'")
    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="amount must be greater than 0")
    if not _valid_date(payload.date):
        raise HTTPException(status_code=400, detail="date must be YYYY-MM-DD")
    conn = db.get_conn()
    try:
        proj = conn.execute(
            "SELECT id FROM projects WHERE id = ? AND deleted_at IS NULL", (payload.project_id,)
        ).fetchone()
        if not proj:
            raise HTTPException(status_code=400, detail="project does not exist")
        cat_id = resolve_category(conn, payload.type, payload.category)
        cur = conn.execute(
            """INSERT INTO transactions
               (project_id, type, amount_paise, date, category_id, subcategory,
                description, party, payment_method, reference_number, notes,
                created_by, created_at, updated_at)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                payload.project_id,
                payload.type,
                to_paise(payload.amount),
                payload.date,
                cat_id,
                payload.subcategory,
                payload.description,
                payload.party,
                payload.payment_method,
                payload.reference_number,
                payload.notes,
                user["id"],
                _now(),
                _now(),
            ),
        )
        tid = cur.lastrowid
        conn.commit()
    finally:
        conn.close()
    audit.log(
        "transaction_created",
        "transaction",
        tid,
        new_value=payload.model_dump(),
        actor_id=user["id"],
    )
    return {"id": tid}


@router.get("")
def list_transactions(
    project_id: int | None = None,
    type: str | None = None,
    category: str | None = None,
    party: str | None = None,
    payment_method: str | None = None,
    from_date: str | None = None,
    to_date: str | None = None,
    has_receipt: bool | None = None,
    search: str | None = None,
    limit: int = Query(100, le=1000),
    offset: int = 0,
    user=Depends(auth.require_user),
):
    rows, count = fetch_transactions(
        project_id=project_id,
        type_=type,
        category=category,
        party=party,
        payment_method=payment_method,
        from_date=from_date,
        to_date=to_date,
        has_receipt=has_receipt,
        search=search,
        limit=limit,
        offset=offset,
    )
    return {"items": [serialize(r) for r in rows], "total": count}


@router.get("/{txn_id}")
def get_transaction(txn_id: int, user=Depends(auth.require_user)):
    conn = db.get_conn()
    try:
        row = conn.execute(
            """SELECT t.*, c.name AS category_name, p.name AS project_name,
                      u.display_name AS recorded_by
               FROM transactions t
               LEFT JOIN categories c ON c.id = t.category_id
               LEFT JOIN projects p ON p.id = t.project_id
               LEFT JOIN users u ON u.id = t.created_by
               WHERE t.id = ? AND t.deleted_at IS NULL""",
            (txn_id,),
        ).fetchone()
    finally:
        conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return serialize(row)


@router.patch("/{txn_id}")
def update_transaction(txn_id: int, payload: TransactionUpdate, user=Depends(auth.require_user)):
    conn = db.get_conn()
    try:
        row = conn.execute(
            "SELECT * FROM transactions WHERE id = ? AND deleted_at IS NULL", (txn_id,)
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Transaction not found")
        old = {k: row[k] for k in row.keys()}
        data = payload.model_dump(exclude_unset=True)
        updates = {}
        for k, v in data.items():
            if v is None:
                continue
            if k == "amount":
                if v <= 0:
                    raise HTTPException(status_code=400, detail="amount must be greater than 0")
                updates["amount_paise"] = to_paise(v)
            elif k == "type":
                if v not in ("income", "expense"):
                    raise HTTPException(status_code=400, detail="invalid type")
                updates["type"] = v
            elif k == "date":
                if not _valid_date(v):
                    raise HTTPException(status_code=400, detail="date must be YYYY-MM-DD")
                updates["date"] = v
            elif k == "category":
                updates["category_id"] = resolve_category(conn, data.get("type", row["type"]), v)
            else:
                updates[k] = v
        if updates:
            set_sql = ", ".join(f"{k} = ?" for k in updates) + ", updated_at = ?"
            conn.execute(
                f"UPDATE transactions SET {set_sql} WHERE id = ?",
                list(updates.values()) + [_now(), txn_id],
            )
            conn.commit()
    finally:
        conn.close()
    audit.log("transaction_edited", "transaction", txn_id, old_value=old, new_value=updates, actor_id=user["id"])
    return {"ok": True}


@router.delete("/{txn_id}")
def delete_transaction(txn_id: int, user=Depends(auth.require_user)):
    conn = db.get_conn()
    try:
        conn.execute(
            "UPDATE transactions SET deleted_at = ?, deleted_by = ? WHERE id = ?",
            (_now(), user["id"], txn_id),
        )
        conn.commit()
    finally:
        conn.close()
    audit.log("transaction_deleted", "transaction", txn_id, actor_id=user["id"])
    return {"ok": True}
