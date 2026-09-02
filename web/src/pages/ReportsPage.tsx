import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { buildDashboard } from '@/lib/finance'
import { formatINR } from '@/lib/money'
import { downloadXlsx } from 'sheets-core'
import type { Project, Transaction, Category } from '@/lib/types'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

export function ReportsPage() {
  const store = useStore()
  const [projects, setProjects] = useState<Project[]>([])
  const [txns, setTxns] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const [p, t, c] = await Promise.all([store.listProjects(), store.listTransactions(), store.listCategories()])
    setProjects(p)
    setTxns(t)
    setCategories(c)
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [store])

  function exportXlsx() {
    const dash = buildDashboard(projects, txns, categories)
    const summary: (string | number)[][] = [
      ['Metric', 'Value'],
      ['Total Income', formatINR(dash.grandIncome)],
      ['Total Expense', formatINR(dash.grandExpense)],
      ['Net', formatINR(dash.grandNet)],
      ['', ''],
      ['Project', 'Income', 'Expense', 'Net', 'Budget', 'Utilisation %'],
    ]
    for (const p of projects) {
      const t = dash.totalsByProject[p.id]
      summary.push([
        p.name,
        formatINR(t.income),
        formatINR(t.expense),
        formatINR(t.net),
        formatINR(t.budget),
        t.utilisation === null ? 'n/a' : `${((t.utilisation ?? 0) * 100).toFixed(1)}%`,
      ])
    }

    const txnRows: (string | number)[][] = [
      ['Date', 'Project', 'Type', 'Category', 'Party', 'Description', 'Amount (₹)'],
    ]
    for (const t of txns) {
      txnRows.push([
        t.date,
        projects.find((p) => p.id === t.project_id)?.name ?? t.project_id,
        t.type,
        categories.find((c) => c.id === t.category_id)?.name ?? t.category_id,
        t.party,
        t.description,
        t.amount_paise / 100,
      ])
    }

    downloadXlsx(
      [
        { name: 'Summary', rows: summary },
        { name: 'Transactions', rows: txnRows },
      ],
      `platio-report-${new Date().toISOString().slice(0, 10)}.xlsx`,
    )
  }

  if (loading) return <p className="text-slate-500">Loading…</p>

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
      <Card>
        <p className="mb-4 text-sm text-slate-500">
          Export a structured .xlsx (Summary + Transactions sheets). Generated in the browser — no
          server, no data leaves your sheet.
        </p>
        <Button onClick={exportXlsx} disabled={txns.length === 0}>
          Download Excel ({txns.length} transactions)
        </Button>
      </Card>
    </div>
  )
}
