// JSON export / import for the whole Platio dataset.
// In no-server mode the "database" is the Google Sheet; this lets a user take a
// portable snapshot (or restore one) without touching Sheets directly.
import type { Store } from './store'
import type { Project, Transaction, Category } from './types'

export interface PlatioSnapshot {
  version: 1
  exportedAt: string
  projects: Project[]
  transactions: Transaction[]
  categories: Category[]
}

export async function exportSnapshot(store: Store): Promise<PlatioSnapshot> {
  const [projects, transactions, categories] = await Promise.all([
    store.listProjects(),
    store.listTransactions(),
    store.listCategories(),
  ])
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    projects,
    transactions,
    categories,
  }
}

export function downloadSnapshot(snap: PlatioSnapshot, filename = `platio-backup-${new Date().toISOString().slice(0, 10)}.json`) {
  const blob = new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function parseSnapshot(text: string): PlatioSnapshot {
  const data = JSON.parse(text)
  if (data.version !== 1) throw new Error('Unsupported snapshot version')
  if (!Array.isArray(data.projects) || !Array.isArray(data.transactions) || !Array.isArray(data.categories)) {
    throw new Error('Snapshot missing required collections')
  }
  return data as PlatioSnapshot
}

// Restore overwrites existing data by re-creating rows. Because the store is
// append-only/safe, we clear is NOT done here — import is additive by id; the
// store's create methods generate fresh ids, so to avoid duplicates we upsert
// via update when the id already exists.
export async function importSnapshot(store: Store, snap: PlatioSnapshot): Promise<void> {
  for (const p of snap.projects) {
    const existing = (await store.listProjects()).find((x) => x.id === p.id)
    if (existing) await store.updateProject(p.id, p)
    else await store.createProject(p)
  }
  for (const c of snap.categories) {
    const existing = (await store.listCategories()).find((x) => x.id === c.id)
    if (existing) await store.updateCategory(c.id, c)
    else await store.createCategory(c)
  }
  for (const t of snap.transactions) {
    // Re-create by removing reliance on id; find by id is not supported in store,
    // so we append fresh. To keep it simple and safe, we create new rows.
    const { id: _id, created_at: _c, ...rest } = t as any
    await store.createTransaction(rest)
  }
}
