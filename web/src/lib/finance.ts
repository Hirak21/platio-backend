// Pure finance math. No DOM, no IO — fully unit-testable.
import type { Project, Transaction, Category } from './types'
import type { Paise } from './types'

export interface ProjectTotals {
  project_id: string
  income: Paise
  expense: Paise
  net: Paise
  budget: Paise
  utilisation: number | null // expense / budget (0..>1), null if no budget
  budget_exceeded: boolean
}

export function sumPaise(items: Paise[]): Paise {
  return items.reduce((acc, v) => acc + (v || 0), 0)
}

export function projectTotals(project: Project, txns: Transaction[]): ProjectTotals {
  const mine = txns.filter((t) => t.project_id === project.id)
  const income = sumPaise(mine.filter((t) => t.type === 'income').map((t) => t.amount_paise))
  const expense = sumPaise(mine.filter((t) => t.type === 'expense').map((t) => t.amount_paise))
  const budget = project.budget_paise || 0
  const utilisation = budget > 0 ? expense / budget : null
  return {
    project_id: project.id,
    income,
    expense,
    net: income - expense,
    budget,
    utilisation,
    budget_exceeded: budget > 0 && expense > budget,
  }
}

export interface CategoryBreakdownRow {
  category_id: string
  name: string
  total: Paise
  count: number
}

export function categoryBreakdown(
  txns: Transaction[],
  categories: Category[],
): CategoryBreakdownRow[] {
  const byCat = new Map<string, CategoryBreakdownRow>()
  for (const t of txns) {
    if (t.type !== 'expense') continue
    const existing = byCat.get(t.category_id)
    const name =
      categories.find((c) => c.id === t.category_id)?.name ?? t.category_id ?? 'Uncategorised'
    if (existing) {
      existing.total += t.amount_paise
      existing.count += 1
    } else {
      byCat.set(t.category_id, { category_id: t.category_id, name, total: t.amount_paise, count: 1 })
    }
  }
  return [...byCat.values()].sort((a, b) => b.total - a.total)
}

export interface DashboardData {
  totalsByProject: Record<string, ProjectTotals>
  grandIncome: Paise
  grandExpense: Paise
  grandNet: Paise
  breakdown: CategoryBreakdownRow[]
}

// Monthly income/expense trend (last 6 months as YYYY-MM), for charts.
export interface MonthlyTrendRow {
  month: string // YYYY-MM
  income: Paise
  expense: Paise
}

export function monthlyTrend(txns: Transaction[]): MonthlyTrendRow[] {
  const byMonth = new Map<string, MonthlyTrendRow>()
  // Seed last 6 months so the chart has a stable axis.
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    byMonth.set(key, { month: key, income: 0, expense: 0 })
  }
  for (const t of txns) {
    const d = new Date(t.date)
    if (isNaN(d.getTime())) continue
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const row = byMonth.get(key) ?? { month: key, income: 0, expense: 0 }
    if (t.type === 'income') row.income += t.amount_paise
    else row.expense += t.amount_paise
    byMonth.set(key, row)
  }
  return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month))
}

export function buildDashboard(
  projects: Project[],
  txns: Transaction[],
  categories: Category[],
): DashboardData {
  const totalsByProject: Record<string, ProjectTotals> = {}
  for (const p of projects) totalsByProject[p.id] = projectTotals(p, txns)
  const grandIncome = sumPaise(Object.values(totalsByProject).map((t) => t.income))
  const grandExpense = sumPaise(Object.values(totalsByProject).map((t) => t.expense))
  return {
    totalsByProject,
    grandIncome,
    grandExpense,
    grandNet: grandIncome - grandExpense,
    breakdown: categoryBreakdown(txns, categories),
  }
}
