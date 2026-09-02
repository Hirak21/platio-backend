// Data access contract. Both SheetsStore (real, no-server) and MockStore
// (in-memory for local dev / demo) implement this. UI never knows the difference.
import type {
  Project,
  Transaction,
  Category,
  AuditEntry,
  NewProject,
  NewTransaction,
} from './types'

export interface Store {
  readonly kind: 'sheets' | 'mock'
  ensureSchema(): Promise<void>
  listProjects(): Promise<Project[]>
  createProject(p: NewProject): Promise<Project>
  updateProject(id: string, patch: Partial<Project>): Promise<void>
  listTransactions(): Promise<Transaction[]>
  listTransactionsByProject(projectId: string): Promise<Transaction[]>
  createTransaction(t: NewTransaction): Promise<Transaction>
  deleteTransaction(id: string): Promise<void>
  updateTransaction(id: string, patch: Partial<NewTransaction>): Promise<void>
  listCategories(): Promise<Category[]>
  createCategory(c: Omit<Category, 'created_at'>): Promise<Category>
  updateCategory(id: string, patch: Partial<Category>): Promise<void>
  listAudit(): Promise<AuditEntry[]>
  audit(entry: Omit<AuditEntry, 'ts'>): Promise<void>
  /** Seed the default construction categories if the Categories tab is empty. */
  seedDefaultCategoriesIfEmpty(): Promise<void>
}
