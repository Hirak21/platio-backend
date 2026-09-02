// In-memory store. Runs with zero credentials so the app is demoable locally
// and testable in Node. Same shape as SheetsStore.
import type { Store } from './store'
import type {
  Project,
  Transaction,
  Category,
  AuditEntry,
  NewProject,
  NewTransaction,
} from './types'
import { uid, nowIso } from './uid'
import { defaultCategories } from './defaultCategories'

const SEED_CATEGORIES: Category[] = defaultCategories().map((c) => ({ ...c, created_at: nowIso() }))

export class MockStore implements Store {
  readonly kind = 'mock' as const
  private projects: Project[] = []
  private transactions: Transaction[] = []
  private categories: Category[] = [...SEED_CATEGORIES]
  private auditLog: AuditEntry[] = []

  async ensureSchema(): Promise<void> {
    /* nothing to set up in memory */
  }

  async listProjects(): Promise<Project[]> {
    return [...this.projects]
  }

  async createProject(p: NewProject): Promise<Project> {
    const project: Project = {
      ...p,
      id: uid('proj'),
      created_at: nowIso(),
    }
    this.projects.push(project)
    await this.audit({ entity: 'project', entity_id: project.id, action: 'create', detail: project.name })
    return project
  }

  async updateProject(id: string, patch: Partial<Project>): Promise<void> {
    const idx = this.projects.findIndex((p) => p.id === id)
    if (idx < 0) throw new Error(`Project ${id} not found`)
    this.projects[idx] = { ...this.projects[idx], ...patch, id }
    await this.audit({ entity: 'project', entity_id: id, action: 'update', detail: patch.name ?? '' })
  }

  async listTransactions(): Promise<Transaction[]> {
    return [...this.transactions]
  }

  async listTransactionsByProject(projectId: string): Promise<Transaction[]> {
    return this.transactions.filter((t) => t.project_id === projectId)
  }

  async createTransaction(t: NewTransaction): Promise<Transaction> {
    const txn: Transaction = {
      ...t,
      id: uid('txn'),
      created_at: nowIso(),
    }
    this.transactions.push(txn)
    await this.audit({
      entity: 'transaction',
      entity_id: txn.id,
      action: 'create',
      detail: `${t.type} ${t.amount_paise} proj=${t.project_id}`,
    })
    return txn
  }

  async deleteTransaction(id: string): Promise<void> {
    const idx = this.transactions.findIndex((t) => t.id === id)
    if (idx < 0) throw new Error(`Transaction ${id} not found`)
    // No hard delete (integrity rule): mark the row as deleted, keep it.
    this.transactions[idx] = {
      ...this.transactions[idx],
      type: 'expense',
      amount_paise: 0,
      description: (this.transactions[idx].description || '') + ' (deleted)',
    }
    await this.audit({ entity: 'transaction', entity_id: id, action: 'delete', detail: '' })
  }

  async updateTransaction(id: string, patch: Partial<NewTransaction>): Promise<void> {
    const idx = this.transactions.findIndex((t) => t.id === id)
    if (idx < 0) throw new Error(`Transaction ${id} not found`)
    this.transactions[idx] = { ...this.transactions[idx], ...patch, id }
    await this.audit({ entity: 'transaction', entity_id: id, action: 'update', detail: patch.description ?? '' })
  }

  async listCategories(): Promise<Category[]> {
    return [...this.categories]
  }

  async createCategory(c: Omit<Category, 'created_at'>): Promise<Category> {
    const cat: Category = { ...c, id: c.id || uid('cat'), created_at: nowIso() }
    this.categories.push(cat)
    return cat
  }

  async updateCategory(id: string, patch: Partial<Category>): Promise<void> {
    const idx = this.categories.findIndex((c) => c.id === id)
    if (idx < 0) throw new Error(`Category ${id} not found`)
    this.categories[idx] = { ...this.categories[idx], ...patch, id }
  }

  async listAudit(): Promise<AuditEntry[]> {
    return [...this.auditLog]
  }

  async seedDefaultCategoriesIfEmpty(): Promise<void> {
    if (this.categories.length > 0) return
    this.categories = defaultCategories().map((c) => ({ ...c, created_at: nowIso() }))
  }

  async audit(entry: Omit<AuditEntry, 'ts'>): Promise<void> {
    this.auditLog.push({ ...entry, ts: nowIso() })
  }
}
