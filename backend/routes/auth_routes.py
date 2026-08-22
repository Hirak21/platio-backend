from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

import db
import auth
import audit
from models import LoginRequest
from config import SESSION_COOKIE

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login")
def login(payload: LoginRequest):
    conn = db.get_conn()
    try:
        row = conn.execute(
            "SELECT * FROM users WHERE username = ?", (payload.username,)
        ).fetchone()
    finally:
        conn.close()
    if not row or not auth.verify_password(row["password_hash"], payload.password):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    from fastapi.responses import JSONResponse

    token = auth.create_session_token(row["username"])
    resp = JSONResponse({
        "username": row["username"],
        "role": row["role"],
        "id": row["id"],
        "access_token": token,
    })
    auth.set_session_cookie(resp, row["username"])
    return resp


@router.post("/logout")
def logout():
    from fastapi.responses import JSONResponse

    resp = JSONResponse({"ok": True})
    auth.clear_session_cookie(resp)
    return resp


@router.get("/me")
def me(user=Depends(auth.require_user)):
    return {"username": user["username"], "role": user["role"], "id": user["id"], "display_name": user["display_name"]}
