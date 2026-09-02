// Core domain types for Platio. Money is ALWAYS integer paise (1/100 INR).
// Column order here mirrors sheets-core PLATIO_SCHEMAS (src/schema.ts).

export type Paise = number

export type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled'

export interface Project {
  id: string
  name: string
  client_name: string
  location: string
  description: string
  start_date: string
  expected_completion_date: string
  budget_paise: Paise
  status: ProjectStatus
  created_at: string
}

export type TxnType = 'income' | 'expense'

export interface Transaction {
  id: string
  project_id: string
  type: TxnType
  amount_paise: Paise
  date: string
  category_id: string
  subcategory_id: string
  party: string
  payment_method: string
  description: string
  reference_number: string
  receipt_key: string
  created_at: string
}

export interface Category {
  id: string
  name: string
  type: TxnType | 'both'
  parent_id: string
  is_active: string // '1' | '0' — strings in sheets
  sort_order: string
  created_at: string
}

export interface AuditEntry {
  ts: string
  entity: string
  entity_id: string
  action: string
  detail: string
}

export interface NewProject {
  name: string
  client_name: string
  location: string
  description: string
  start_date: string
  expected_completion_date: string
  budget_paise: Paise
  status: ProjectStatus
}

export interface NewTransaction {
  project_id: string
  type: TxnType
  amount_paise: Paise
  date: string
  category_id: string
  subcategory_id: string
  party: string
  payment_method: string
  description: string
  reference_number: string
  receipt_key: string
}
