// Real no-server backend: reads/writes the live Google Sheet via sheets-core.
// Transactional writes are APPEND-ONLY (sheets-core appendRow) so concurrent
// edits from the owner + client viewer never clobber each other.
import { SheetsClient, getAccessToken } from 'sheets-core'
import { PLATIO_SCHEMAS, toRow, fromRows, type TableSchema } from 'sheets-core'
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

const PROJECTS = schema('Projects')
const TRANSACTIONS = schema('Transactions')
const CATEGORIES = schema('Categories')
const AUDIT = schema('Audit')

function schema(tab: string): TableSchema {
  const s = PLATIO_SCHEMAS.find((x) => x.tab === tab)
  if (!s) throw new Error(`Missing schema for tab ${tab}`)
  return s
}

// sheets-core stores categories.is_active / sort_order / budget as strings.
function boolToStr(b: boolean): string {
  return b ? '1' : '0'
}

export class SheetsStore implements Store {
  readonly kind = 'sheets' as const
  private client: SheetsClient

  constructor(spreadsheetId: string) {
    this.client = new SheetsClient(spreadsheetId, async () => getAccessToken())
  }

  async ensureSchema(): Promise<void> {
    for (const s of PLATIO_SCHEMAS) {
      await this.client.ensureTab(s.tab, s.columns)
    }
  }

  async listProjects(): Promise<Project[]> {
    const rows = await this.client.getValues(`${PROJECTS.tab}`)
    return fromRows(PROJECTS, rows).map(coerceProject)
  }

  async createProject(p: NewProject): Promise<Project> {
    const project: Project = { ...p, id: uid('proj'), created_at: nowIso() }
    await this.client.appendRow(PROJECTS.tab, toRow(PROJECTS, project as unknown as Record<string, string | number>))
    await this.audit({ entity: 'project', entity_id: project.id, action: 'create', detail: project.name })
    return project
  }

  async updateProject(id: string, patch: Partial<Project>): Promise<void> {
    // Master data: find the row by id and update it in place.
    const rows = await this.client.getValues(`${PROJECTS.tab}`)
    const idx = rows.findIndex((r) => r[0] === id)
    if (idx < 0) throw new Error(`Project ${id} not found`)
    const merged = { ...fromRows(PROJECTS, rows)[idx], ...patch, id }
    await this.client.updateValues(`${PROJECTS.tab}!A${idx + 1}`, [toRow(PROJECTS, merged as unknown as Record<string, string | number>)])
    await this.audit({ entity: 'project', entity_id: id, action: 'update', detail: patch.name ?? '' })
  }

  async listTransactions(): Promise<Transaction[]> {
    const rows = await this.client.getValues(`${TRANSACTIONS.tab}`)
    return fromRows(TRANSACTIONS, rows).map(coerceTransaction)
  }

  async listTransactionsByProject(projectId: string): Promise<Transaction[]> {
    return (await this.listTransactions()).filter((t) => t.project_id === projectId)
  }

  async createTransaction(t: NewTransaction): Promise<Transaction> {
    const txn: Transaction = { ...t, id: uid('txn'), created_at: nowIso() }
    await this.client.appendRow(TRANSACTIONS.tab, toRow(TRANSACTIONS, txn as unknown as Record<string, string | number>))
    await this.audit({
      entity: 'transaction',
      entity_id: txn.id,
      action: 'create',
      detail: `${t.type} ${t.amount_paise} proj=${t.project_id}`,
    })
    return txn
  }

  async deleteTransaction(id: string): Promise<void> {
    // No hard delete (integrity rule): blank the row's values instead.
    const rows = await this.client.getValues(`${TRANSACTIONS.tab}`)
    const idx = rows.findIndex((r) => r[0] === id)
    if (idx < 0) throw new Error(`Transaction ${id} not found`)
    const blank = TRANSACTIONS.columns.map(() => '')
    blank[0] = id
    blank[1] = (rows[idx]?.[1] ?? '') + ' (deleted)'
    await this.client.updateValues(`${TRANSACTIONS.tab}!A${idx + 1}`, [blank])
    await this.audit({ entity: 'transaction', entity_id: id, action: 'delete', detail: '' })
  }

  async updateTransaction(id: string, patch: Partial<NewTransaction>): Promise<void> {
    const rows = await this.client.getValues(`${TRANSACTIONS.tab}`)
    const idx = rows.findIndex((r) => r[0] === id)
    if (idx < 0) throw new Error(`Transaction ${id} not found`)
    const merged = { ...fromRows(TRANSACTIONS, rows)[idx], ...patch, id }
    await this.client.updateValues(`${TRANSACTIONS.tab}!A${idx + 1}`, [toRow(TRANSACTIONS, merged as unknown as Record<string, string | number>)])
    await this.audit({ entity: 'transaction', entity_id: id, action: 'update', detail: patch.description ?? '' })
  }

  async listCategories(): Promise<Category[]> {
    const rows = await this.client.getValues(`${CATEGORIES.tab}`)
    return fromRows(CATEGORIES, rows) as unknown as Category[]
  }

  async createCategory(c: Omit<Category, 'created_at'>): Promise<Category> {
    const cat: Category = { ...c, id: c.id || uid('cat'), created_at: nowIso() }
    await this.client.appendRow(CATEGORIES.tab, toRow(CATEGORIES, cat as unknown as Record<string, string | number>))
    return cat
  }

  async updateCategory(id: string, patch: Partial<Category>): Promise<void> {
    const rows = await this.client.getValues(`${CATEGORIES.tab}`)
    const idx = rows.findIndex((r) => r[0] === id)
    if (idx < 0) throw new Error(`Category ${id} not found`)
    const merged = { ...fromRows(CATEGORIES, rows)[idx], ...patch, id }
    await this.client.updateValues(`${CATEGORIES.tab}!A${idx + 1}`, [toRow(CATEGORIES, merged as unknown as Record<string, string | number>)])
  }

  async listAudit(): Promise<AuditEntry[]> {
    const rows = await this.client.getValues(`${AUDIT.tab}`)
    return fromRows(AUDIT, rows) as unknown as AuditEntry[]
  }

  async seedDefaultCategoriesIfEmpty(): Promise<void> {
    const existing = await this.listCategories()
    if (existing.length > 0) return
    for (const c of defaultCategories()) {
      await this.client.appendRow(CATEGORIES.tab, toRow(CATEGORIES, c as unknown as Record<string, string | number>))
    }
  }

  async audit(entry: Omit<AuditEntry, 'ts'>): Promise<void> {
    await this.client.appendRow(AUDIT.tab, [nowIso(), entry.entity, entry.entity_id, entry.action, entry.detail])
  }
}

// Sheets stores everything as strings; coerce the numeric paise fields.
function coerceProject(r: Record<string, string>): Project {
  return { ...(r as unknown as Project), budget_paise: Number(r.budget_paise) || 0 }
}

function coerceTransaction(r: Record<string, string>): Transaction {
  return { ...(r as unknown as Transaction), amount_paise: Number(r.amount_paise) || 0 }
}

export { boolToStr }
