import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useStore } from '@/hooks/useStore'
import { buildDashboard, monthlyTrend, type MonthlyTrendRow } from '@/lib/finance'
import { formatINR, paiseToRupees } from '@/lib/money'
import type { Project, Transaction, Category } from '@/lib/types'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { TransactionForm } from '@/components/TransactionForm'

const PIE_COLORS = ['#0ea5e9', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']

function monthLabel(m: string): string {
  const [y, mo] = m.split('-')
  return `${mo}/${y.slice(2)}`
}

export function DashboardPage() {
  const store = useStore()
  const [projects, setProjects] = useState<Project[]>([])
  const [txns, setTxns] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

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

  if (loading) return <p className="text-slate-500">Loading dashboard…</p>

  const dash = buildDashboard(projects, txns, categories)
  const trend: MonthlyTrendRow[] = monthlyTrend(txns)
  const pieData = dash.breakdown.map((b) => ({ name: b.name, value: b.total }))
  const hasData = dash.grandIncome > 0 || dash.grandExpense > 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <Button onClick={() => setShowForm(true)} className="hidden md:inline-flex">
          <span className="mr-1 text-lg leading-none">+</span> Record transaction
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <div className="text-sm text-slate-500">Total Income</div>
          <div className="mt-1 text-2xl font-bold text-emerald-600">{formatINR(dash.grandIncome)}</div>
        </Card>
        <Card>
          <div className="text-sm text-slate-500">Total Expense</div>
          <div className="mt-1 text-2xl font-bold text-red-600">{formatINR(dash.grandExpense)}</div>
        </Card>
        <Card>
          <div className="text-sm text-slate-500">Net</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{formatINR(dash.grandNet)}</div>
        </Card>
      </div>

      {hasData && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <h2 className="mb-3 text-lg font-semibold text-slate-900">Income vs Expenses (6 months)</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend.map((r) => ({ ...r, income: paiseToRupees(r.income), expense: paiseToRupees(r.expense) }))} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="inc" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="exp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" tickFormatter={monthLabel} stroke="#94a3b8" fontSize={12} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(v) => `₹${Number(v).toLocaleString('en-IN')}`} width={70} />
                  <Tooltip formatter={(v: number) => formatINR(Math.round(v * 100))} labelFormatter={(m) => monthLabel(String(m))} contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }} />
                  <Area type="monotone" dataKey="income" stroke="#22c55e" fillOpacity={1} fill="url(#inc)" name="Income" />
                  <Area type="monotone" dataKey="expense" stroke="#ef4444" fillOpacity={1} fill="url(#exp)" name="Expense" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card>
            <h2 className="mb-3 text-lg font-semibold text-slate-900">Expense by category</h2>
            <div className="h-64">
              {pieData.length === 0 ? (
                <p className="flex h-full items-center justify-center text-sm text-slate-400">No expense data</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData.map((d) => ({ ...d, value: paiseToRupees(d.value) }))} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={2} label={(e: any) => e.name}>
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatINR(Math.round(v * 100))} contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>
        </div>
      )}

      <Card>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Projects</h2>
        {projects.length === 0 ? (
          <p className="text-sm text-slate-500">
            No projects yet. <Link to="/projects" className="text-indigo-600 underline">Create one</Link>.
          </p>
        ) : (
          <div className="space-y-3">
            {projects.map((p) => {
              const tot = dash.totalsByProject[p.id]
              return (
                <Link
                  key={p.id}
                  to={`/projects/${p.id}`}
                  className="block rounded-lg border border-slate-200 p-4 hover:bg-slate-50"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-slate-900">{p.name}</div>
                      <div className="text-xs text-slate-500">{p.client_name} · {p.location}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-emerald-600">{formatINR(tot.income)}</div>
                      <div className="text-sm font-semibold text-red-600">{formatINR(tot.expense)}</div>
                    </div>
                  </div>
                  {tot.budget_exceeded && (
                    <div className="mt-2 rounded bg-red-50 px-2 py-1 text-xs font-medium text-red-700">
                      Budget exceeded ({formatINR(tot.budget)})
                    </div>
                  )}
                </Link>
              )
            })}
          </div>
        )}
      </Card>

      {dash.breakdown.length > 0 && (
        <Card>
          <h2 className="mb-3 text-lg font-semibold text-slate-900">Expense by category (all projects)</h2>
          <div className="space-y-2">
            {dash.breakdown.map((row) => (
              <div key={row.category_id} className="flex items-center justify-between text-sm">
                <span className="text-slate-700">{row.name}</span>
                <span className="font-medium text-slate-900">{formatINR(row.total)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Mobile quick-add floating action button */}
      <button
        type="button"
        aria-label="Record transaction"
        onClick={() => setShowForm(true)}
        className="fixed bottom-6 right-6 z-40 flex size-14 items-center justify-center rounded-full bg-indigo-600 text-3xl leading-none text-white shadow-lg hover:bg-indigo-700 md:hidden"
      >
        +
      </button>

      {showForm && (
        <Modal title="Record transaction" onClose={() => setShowForm(false)}>
          <TransactionForm onDone={() => { setShowForm(false); void load() }} />
        </Modal>
      )}
    </div>
  )
}
