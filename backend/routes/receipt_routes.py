import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from datetime import datetime, timezone

import db
import auth
import audit
from config import RECEIPTS_DIR, ALLOWED_RECEIPT_TYPES, MAX_RECEIPT_BYTES

router = APIRouter(prefix="/receipts", tags=["receipts"])


def _now():
    return datetime.now(timezone.utc).isoformat()


@router.post("/upload")
async def upload_receipt(
    transaction_id: int = Form(...),
    file: UploadFile = File(...),
    user=Depends(auth.require_user),
):
    content_type = file.content_type
    if content_type not in ALLOWED_RECEIPT_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported file type")
    data = await file.read()
    if len(data) > MAX_RECEIPT_BYTES:
        raise HTTPException(status_code=400, detail="File too large (max 10MB)")

    conn = db.get_conn()
    try:
        txn = conn.execute(
            "SELECT id, project_id, receipt_id FROM transactions WHERE id = ? AND deleted_at IS NULL",
            (transaction_id,),
        ).fetchone()
        if not txn:
            raise HTTPException(status_code=404, detail="Transaction not found")

        # Replace existing receipt if present
        if txn["receipt_id"]:
            old = conn.execute("SELECT * FROM receipts WHERE id = ?", (txn["receipt_id"],)).fetchone()
            if old:
                try:
                    os.remove(os.path.join(RECEIPTS_DIR, old["storage_key"]))
                except OSError:
                    pass
                conn.execute("UPDATE receipts SET deleted_at = ? WHERE id = ?", (_now(), old["id"]))

        ext = ALLOWED_RECEIPT_TYPES[content_type]
        fname = f"{uuid.uuid4().hex}{ext}"
        folder = os.path.join(RECEIPTS_DIR, str(txn["project_id"]), str(transaction_id))
        os.makedirs(folder, exist_ok=True)
        rel = os.path.relpath(os.path.join(folder, fname), RECEIPTS_DIR)
        with open(os.path.join(RECEIPTS_DIR, rel), "wb") as f:
            f.write(data)

        cur = conn.execute(
            """INSERT INTO receipts
               (transaction_id, project_id, storage_key, original_filename,
                content_type, size_bytes, uploaded_by, created_at)
               VALUES (?,?,?,?,?,?,?,?)""",
            (transaction_id, txn["project_id"], rel, file.filename,
             content_type, len(data), user["id"], _now()),
        )
        rid = cur.lastrowid
        conn.execute("UPDATE transactions SET receipt_id = ? WHERE id = ?", (rid, transaction_id))
        conn.commit()
    finally:
        conn.close()
    audit.log("receipt_uploaded", "transaction", transaction_id, new_value={"receipt_id": rid}, actor_id=user["id"])
    return {"id": rid, "filename": file.filename}


@router.get("/{receipt_id}")
def get_receipt(receipt_id: int, user=Depends(auth.require_user)):
    conn = db.get_conn()
    try:
        row = conn.execute(
            "SELECT * FROM receipts WHERE id = ? AND deleted_at IS NULL", (receipt_id,)
        ).fetchone()
    finally:
        conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Receipt not found")
    path = os.path.join(RECEIPTS_DIR, row["storage_key"])
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Receipt file missing")
    from fastapi.responses import FileResponse

    return FileResponse(path, media_type=row["content_type"], filename=row["original_filename"] or "receipt")
