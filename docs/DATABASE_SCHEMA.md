# DATABASE SCHEMA — Platio

SQLite. All monetary columns are `INTEGER` storing **paise** (1/100 of a rupee).
Timestamps stored as `TEXT` ISO-8601 UTC. Soft-delete via `deleted_at`.

## Tables

### users
| col | type | notes |
|-----|------|-------|
| id | INTEGER PK | |
| username | TEXT UNIQUE NOT NULL | |
| password_hash | TEXT NOT NULL | scrypt/argon-style hash |
| role | TEXT NOT NULL DEFAULT 'admin' | admin/manager/staff (reserved) |
| display_name | TEXT | |
| created_at | TEXT | |
| updated_at | TEXT | |

### projects
| col | type | notes |
|-----|------|-------|
| id | INTEGER PK | |
| project_code | TEXT UNIQUE | human ref |
| name | TEXT NOT NULL | |
| description | TEXT | |
| client_name | TEXT | |
| location | TEXT | |
| start_date | TEXT | |
| expected_end_date | TEXT | |
| budget_paise | INTEGER NOT NULL DEFAULT 0 | |
| status | TEXT NOT NULL DEFAULT 'active' | planning/active/completed/archived |
| created_at | TEXT | |
| updated_at | TEXT | |
| deleted_at | TEXT | soft delete |
| deleted_by | INTEGER | FK users |

### categories
| col | type | notes |
|-----|------|-------|
| id | INTEGER PK | |
| kind | TEXT NOT NULL | 'expense' or 'income' |
| name | TEXT NOT NULL | |
| is_active | INTEGER NOT NULL DEFAULT 1 | disable (don't delete) |
| created_at | TEXT | |

Unique `(kind, name)`.

### transactions
| col | type | notes |
|-----|------|-------|
| id | INTEGER PK | |
| project_id | INTEGER NOT NULL FK | isolation |
| type | TEXT NOT NULL | 'income' or 'expense' |
| amount_paise | INTEGER NOT NULL | positive |
| date | TEXT NOT NULL | transaction date |
| category_id | INTEGER FK | -> categories |
| subcategory | TEXT | |
| description | TEXT | |
| party | TEXT | vendor/source |
| payment_method | TEXT | |
| reference_number | TEXT | |
| receipt_id | INTEGER | -> receipts (nullable) |
| notes | TEXT | |
| created_by | INTEGER FK | users |
| created_at | TEXT | |
| updated_at | TEXT | |
| deleted_at | TEXT | soft delete |
| deleted_by | INTEGER | |

Indexes: `(project_id)`, `(date)`, `(type)`, `(category_id)`, and composite
`(project_id, date)`, `(project_id, type)`.

### receipts
| col | type | notes |
|-----|------|-------|
| id | INTEGER PK | |
| transaction_id | INTEGER FK | |
| project_id | INTEGER FK | for path/auth |
| storage_key | TEXT NOT NULL | relative path on disk |
| original_filename | TEXT | |
| content_type | TEXT | |
| size_bytes | INTEGER | |
| uploaded_by | INTEGER FK | |
| created_at | TEXT | |
| deleted_at | TEXT | |

### audit_logs
| col | type | notes |
|-----|------|-------|
| id | INTEGER PK | |
| actor_id | INTEGER FK | users |
| action | TEXT NOT NULL | created/edited/deleted/receipt_uploaded/... |
| entity_type | TEXT | project/transaction/receipt |
| entity_id | INTEGER | |
| old_value | TEXT | JSON |
| new_value | TEXT | JSON |
| reason | TEXT | |
| created_at | TEXT | |

## Future (not in MVP)
organizations, project_members, report_exports — created only when required.
