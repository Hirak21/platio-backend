"""Seed data: default admin, default categories, and optional demo projects.

Called automatically on app startup (ensure_basics + ensure_demo).
Can also be run directly: `python seed.py`.
"""
from datetime import datetime, timezone

import db
import auth
import audit
from finance import to_paise
from config import RECEIPTS_DIR

ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "platio1234"
ADMIN_DISPLAY = "Administrator"

PLATIO_USERNAME = "Platio"
PLATIO_PASSWORD = "Platio0908"
PLATIO_DISPLAY = "Platio"

EXPENSE_CATEGORIES = [
    "Materials", "Labour", "Transport", "Equipment", "Machinery", "Fuel",
    "Electricity", "Water", "Contractor", "Subcontractor", "Site Expenses",
    "Professional Fees", "Permits", "Miscellaneous",
]
INCOME_CATEGORIES = [
    "Project Funding", "Client Payment", "Advance", "Investment", "Loan", "Other",
]


def _now():
    return datetime.now(timezone.utc).isoformat()


def ensure_basics():
    conn = db.get_conn()
    try:
        admin = conn.execute(
            "SELECT id FROM users WHERE username = ?", (ADMIN_USERNAME,)
        ).fetchone()
        if not admin:
            conn.execute(
                "INSERT INTO users (username, password_hash, role, display_name, created_at, updated_at) "
                "VALUES (?,?,?,?,?,?)",
                (ADMIN_USERNAME, auth.hash_password(ADMIN_PASSWORD), "admin",
                 ADMIN_DISPLAY, _now(), _now()),
            )
        platio = conn.execute(
            "SELECT id FROM users WHERE username = ?", (PLATIO_USERNAME,)
        ).fetchone()
        if not platio:
            conn.execute(
                "INSERT INTO users (username, password_hash, role, display_name, created_at, updated_at) "
                "VALUES (?,?,?,?,?,?)",
                (PLATIO_USERNAME, auth.hash_password(PLATIO_PASSWORD), "admin",
                 PLATIO_DISPLAY, _now(), _now()),
            )
        for kind, names in (("expense", EXPENSE_CATEGORIES), ("income", INCOME_CATEGORIES)):
            for name in names:
                if not conn.execute(
                    "SELECT id FROM categories WHERE kind = ? AND name = ?", (kind, name)
                ).fetchone():
                    conn.execute(
                        "INSERT INTO categories (kind, name, is_active, created_at) VALUES (?,?,1,?)",
                        (kind, name, _now()),
                    )
        conn.commit()
    finally:
        conn.close()


def _add_project(conn, code, name, budget, **kw):
    cur = conn.execute(
        """INSERT INTO projects
           (project_code, name, description, client_name, location, start_date,
            expected_end_date, budget_paise, status, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
        (code, name, kw.get("description"), kw.get("client_name"), kw.get("location"),
         kw.get("start_date", "2026-08-01"), kw.get("expected_end_date", "2026-12-31"),
         to_paise(budget), kw.get("status", "active"), _now(), _now()),
    )
    return cur.lastrowid


def _add_txn(conn, pid, ttype, amount, date, category, **kw):
    cat = conn.execute(
        "SELECT id FROM categories WHERE kind = ? AND name = ?", (ttype, category)
    ).fetchone()
    cat_id = cat["id"] if cat else None
    cur = conn.execute(
        """INSERT INTO transactions
           (project_id, type, amount_paise, date, category_id, subcategory,
            description, party, payment_method, reference_number, notes,
            created_by, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (pid, ttype, to_paise(amount), date, cat_id, kw.get("subcategory"),
         kw.get("description"), kw.get("party"), kw.get("payment_method"),
         kw.get("reference_number"), kw.get("notes"), 1, _now(), _now()),
    )
    return cur.lastrowid


def ensure_demo():
    conn = db.get_conn()
    try:
        # Guard on the demo codes themselves (soft-deleted rows still hold the
        # UNIQUE project_code, so a plain count would let us collide).
        existing = conn.execute(
            "SELECT COUNT(*) n FROM projects WHERE project_code IN ('PRJ-A','PRJ-B')"
        ).fetchone()["n"]
        if existing > 0:
            return
        pa = _add_project(
            conn, "PRJ-A", "Riverside Apartments", 1000000,
            description="Residential building, 4 floors", client_name="Acme Builders",
            location="Pune", status="active",
        )
        pb = _add_project(
            conn, "PRJ-B", "Metro Station Shed", 2000000,
            description="Steel shed structure", client_name="City Metro Ltd",
            location="Mumbai", status="active",
        )
        # Project A
        _add_txn(conn, pa, "income", 500000, "2026-08-05", "Project Funding", party="Acme Builders", payment_method="Bank Transfer", reference_number="FT001")
        _add_txn(conn, pa, "income", 300000, "2026-08-20", "Client Payment", party="Acme Builders", payment_method="Cheque", reference_number="CH001")
        _add_txn(conn, pa, "expense", 200000, "2026-08-08", "Materials", party="Steel Mart", payment_method="UPI", reference_number="UPI01", description="TMT bars")
        _add_txn(conn, pa, "expense", 150000, "2026-08-12", "Labour", party="Site Labour Contract", payment_method="Cash", description="Monthly wages")
        _add_txn(conn, pa, "expense", 25000, "2026-08-15", "Transport", party="Sand Supplier", payment_method="UPI", description="Sand transport")
        # Project B
        _add_txn(conn, pb, "income", 800000, "2026-08-03", "Project Funding", party="City Metro Ltd", payment_method="Bank Transfer", reference_number="FT010")
        _add_txn(conn, pb, "income", 700000, "2026-08-25", "Client Payment", party="City Metro Ltd", payment_method="Cheque", reference_number="CH010")
        _add_txn(conn, pb, "expense", 300000, "2026-08-09", "Materials", party="Cement Co", payment_method="UPI", reference_number="UPI10", description="Cement bags")
        _add_txn(conn, pb, "expense", 120000, "2026-08-14", "Equipment", party="Equip Rentals", payment_method="Bank Transfer", description="Crane rental")
        _add_txn(conn, pb, "expense", 80000, "2026-08-18", "Labour", party="Site Labour Contract", payment_method="Cash")
        conn.commit()

        # Attach a dummy receipt PDF to one expense (Project A Materials)
        txn = conn.execute(
            "SELECT id, project_id FROM transactions WHERE project_id = ? AND type='expense' AND category_id = (SELECT id FROM categories WHERE name='Materials' LIMIT 1) LIMIT 1",
            (pa,),
        ).fetchone()
        if txn:
            folder = RECEIPTS_DIR / str(txn["project_id"]) / str(txn["id"])
            folder.mkdir(parents=True, exist_ok=True)
            pdf_path = folder / "receipt.pdf"
            pdf_path.write_text(
                "%PDF-1.1\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
                "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"
                "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n"
                "trailer<</Root 1 0 R>>\n%%EOF"
            )
            rel = pdf_path.relative_to(RECEIPTS_DIR).as_posix()
            cur = conn.execute(
                """INSERT INTO receipts (transaction_id, project_id, storage_key,
                   original_filename, content_type, size_bytes, uploaded_by, created_at)
                   VALUES (?,?,?,?,?,?,?,?)""",
                (txn["id"], txn["project_id"], rel, "receipt.pdf",
                 "application/pdf", pdf_path.stat().st_size, 1, _now()),
            )
            conn.execute("UPDATE transactions SET receipt_id = ? WHERE id = ?", (cur.lastrowid, txn["id"]))
            conn.commit()
    finally:
        conn.close()


if __name__ == "__main__":
    db.init_db()
    ensure_basics()
    ensure_demo()
    print("Seed complete.")
