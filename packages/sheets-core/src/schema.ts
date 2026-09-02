// Table schemas. Each tab is a table. The FIRST ROW is always the header (column names).
// Apps declare their own schemas; sheets-core just knows how to set them up and map rows.

export interface TableSchema {
  tab: string;
  columns: string[];
}

/** Map a row object -> ordered array matching columns. Missing keys become "". */
export function toRow(schema: TableSchema, row: Record<string, string | number>): (string | number)[] {
  return schema.columns.map((c) => (row[c] === undefined ? "" : row[c]));
}

/** Map an array-of-arrays (excluding header) -> row objects. */
export function fromRows(schema: TableSchema, values: string[][]): Record<string, string>[] {
  const [header, ...rest] = values;
  if (!header) return [];
  return rest.map((r) => {
    const obj: Record<string, string> = {};
    schema.columns.forEach((col) => {
      const idx = header.indexOf(col);
      obj[col] = idx >= 0 ? (r[idx] ?? "") : "";
    });
    return obj;
  });
}

// ---- Platio (construction finance) ----
// Column order matters: rows are written positionally via toRow() and read
// positionally via fromRows(). Keep these in sync with what the app reads/writes.
export const PLATIO_SCHEMAS: TableSchema[] = [
  { tab: "Projects", columns: ["id", "name", "client_name", "location", "description", "start_date", "expected_completion_date", "budget_paise", "status", "created_at"] },
  {
    tab: "Transactions",
    columns: ["id", "project_id", "type", "amount_paise", "date", "category_id", "subcategory_id", "party", "payment_method", "description", "reference_number", "receipt_key", "created_at"],
  },
  { tab: "Categories", columns: ["id", "name", "type", "parent_id", "is_active", "sort_order", "created_at"] },
  { tab: "Audit", columns: ["ts", "entity", "entity_id", "action", "detail"] },
];

// ---- Invento (inventory / sales) ----
export const INVENTO_SCHEMAS: TableSchema[] = [
  { tab: "BusinessUnits", columns: ["id", "name", "type"] },
  { tab: "Items", columns: ["id", "business_unit_id", "name", "unit", "low_stock", "current_stock", "unit_cost_paise"] },
  { tab: "Suppliers", columns: ["id", "name", "contact"] },
  { tab: "Purchases", columns: ["id", "business_unit_id", "supplier_id", "date", "total_paise", "created_at"] },
  { tab: "Sales", columns: ["id", "business_unit_id", "date", "total_paise", "idempotency_key", "created_at"] },
  { tab: "Movements", columns: ["id", "item_id", "type", "qty", "unit", "reference_type", "reference_id", "created_at"] },
  { tab: "Expenses", columns: ["id", "business_unit_id", "category", "amount_paise", "date", "note"] },
  { tab: "Audit", columns: ["ts", "entity", "entity_id", "action", "detail"] },
];

export function schemasFor(app: "platio" | "invento"): TableSchema[] {
  return app === "platio" ? PLATIO_SCHEMAS : INVENTO_SCHEMAS;
}
