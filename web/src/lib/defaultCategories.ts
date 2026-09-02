// Default construction-finance categories, ported from the old Platio seed.
// Restored so the new no-server app matches the original category set.
import type { Category } from './types'

interface SeedCat {
  name: string
  type: 'income' | 'expense'
}

const DEFAULT_CATEGORIES: SeedCat[] = [
  { name: 'Materials', type: 'expense' },
  { name: 'Labour', type: 'expense' },
  { name: 'Transport', type: 'expense' },
  { name: 'Equipment', type: 'expense' },
  { name: 'Machinery', type: 'expense' },
  { name: 'Fuel', type: 'expense' },
  { name: 'Electricity', type: 'expense' },
  { name: 'Water', type: 'expense' },
  { name: 'Contractor', type: 'expense' },
  { name: 'Subcontractor', type: 'expense' },
  { name: 'Site Expenses', type: 'expense' },
  { name: 'Professional Fees', type: 'expense' },
  { name: 'Permits', type: 'expense' },
  { name: 'Miscellaneous', type: 'expense' },
  { name: 'Project Funding', type: 'income' },
  { name: 'Client Payment', type: 'income' },
  { name: 'Advance', type: 'income' },
  { name: 'Investment', type: 'income' },
  { name: 'Loan', type: 'income' },
  { name: 'Other', type: 'income' },
]

export function defaultCategories(): Omit<Category, 'created_at'>[] {
  return DEFAULT_CATEGORIES.map((c, i) => ({
    id: `cat_${c.type}_${i + 1}`,
    name: c.name,
    type: c.type,
    parent_id: '',
    is_active: '1',
    sort_order: String(i + 1),
  }))
}
