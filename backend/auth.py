"""Authentication: password hashing + signed session cookie.

Stateless signed cookie (HMAC) over JSON payload {u, exp}. Backend-enforced.
"""
import hashlib
import hmac
import json
import base64
import os
import time
from datetime import datetime, timezone

from fastapi import Request, HTTPException, Depends
from fastapi.responses import JSONResponse

import db
from config import SECRET, SESSION_COOKIE, SESSION_MAX_AGE


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 100_000)
    return "pbkdf2_sha256$100000$" + salt.hex() + "$" + dk.hex()


def verify_password(stored: str, password: str) -> bool:
    try:
        _, iter_s, salt_s, hash_s = stored.split("$")
        salt = bytes.fromhex(salt_s)
        expected = bytes.fromhex(hash_s)
    except Exception:
        return False
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, int(iter_s))
    return hmac.compare_digest(dk, expected)


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode().rstrip("=")


def _b64d(s: str) -> bytes:
    pad = "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s + pad)


def create_session_token(username: str) -> str:
    payload = {"u": username, "exp": int(time.time()) + SESSION_MAX_AGE}
    body = _b64(json.dumps(payload).encode())
    sig = _b64(hmac.new(SECRET.encode(), body.encode(), hashlib.sha256).digest())
    return f"{body}.{sig}"


def verify_session_token(token: str):
    try:
        body, sig = token.split(".")
    except ValueError:
        return None
    expected = _b64(hmac.new(SECRET.encode(), body.encode(), hashlib.sha256).digest())
    if not hmac.compare_digest(sig, expected):
        return None
    try:
        payload = json.loads(_b64d(body))
    except Exception:
        return None
    if payload.get("exp", 0) < int(time.time()):
        return None
    return payload.get("u")


def set_session_cookie(response: JSONResponse, username: str):
    response.set_cookie(
        SESSION_COOKIE,
        create_session_token(username),
        max_age=SESSION_MAX_AGE,
        httponly=True,
        samesite="lax",
        path="/",
    )


def clear_session_cookie(response: JSONResponse):
    response.delete_cookie(SESSION_COOKIE, path="/")


def get_token_from_request(request: Request):
    authz = request.headers.get("Authorization")
    if authz and authz.lower().startswith("bearer "):
        return verify_session_token(authz.split(" ", 1)[1])
    # Fallback to cookie (still supported)
    token = request.cookies.get(SESSION_COOKIE)
    if token:
        return verify_session_token(token)
    return None


def get_current_user(request: Request):
    username = get_token_from_request(request)
    if not username:
        raise HTTPException(status_code=401, detail="Not authenticated")
    conn = db.get_conn()
    try:
        row = conn.execute(
            "SELECT * FROM users WHERE username = ?", (username,)
        ).fetchone()
    finally:
        conn.close()
    if not row:
        raise HTTPException(status_code=401, detail="User not found")
    return dict(row)


def require_user(request: Request):
    return get_current_user(request)
