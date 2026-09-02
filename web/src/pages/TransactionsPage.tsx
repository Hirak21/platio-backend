import { useEffect, useMemo, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { formatINR } from '@/lib/money'
import type { Project, Transaction, Category } from '@/lib/types'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { TransactionForm } from '@/components/TransactionForm'

export function TransactionsPage() {
  const store = useStore()
  const [txns, setTxns] = useState<Transaction[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [filterProject, setFilterProject] = useState('')
  const [filterType, setFilterType] = useState('')

  async function load() {
    const [p, t, c] = await Promise.all([store.listProjects(), store.listTransactions(), store.listCategories()])
    setProjects(p)
    setTxns(t)
    setCategories(c)
  }

  useEffect(() => {
    void load()
  }, [store])

  async function remove(txnId: string) {
    await store.deleteTransaction(txnId)
    await load()
  }

  const visible = useMemo(() => {
    return txns.filter((t) => {
      if (filterProject && t.project_id !== filterProject) return false
      if (filterType && t.type !== filterType) return false
      return true
    })
  }, [txns, filterProject, filterType])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Transactions</h1>
        <Button onClick={() => setShowForm(true)}>New transaction</Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select label="Project" value={filterProject} onChange={setFilterProject} options={[{ value: '', label: 'All' }, ...projects.map((p) => ({ value: p.id, label: p.name }))]} />
        <Select label="Type" value={filterType} onChange={setFilterType} options={[{ value: '', label: 'All' }, { value: 'expense', label: 'Expense' }, { value: 'income', label: 'Income' }]} />
      </div>

      <Card>
        {visible.length === 0 ? (
          <p className="text-sm text-slate-500">No transactions match.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Project</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Category</th>
                  <th className="py-2 pr-4">Party</th>
                  <th className="py-2 pr-4">Description</th>
                  <th className="py-2 pr-4 text-right">Amount</th>
                  <th className="py-2 pr-4">Receipt</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visible.map((t) => (
                  <tr key={t.id} className="border-b border-slate-100">
                    <td className="py-2 pr-4 text-slate-600">{t.date}</td>
                    <td className="py-2 pr-4 text-slate-600">{projects.find((p) => p.id === t.project_id)?.name ?? t.project_id}</td>
                    <td className="py-2 pr-4"><span className={t.type === 'income' ? 'text-emerald-600' : 'text-red-600'}>{t.type}</span></td>
                    <td className="py-2 pr-4 text-slate-600">{categories.find((c) => c.id === t.category_id)?.name ?? t.category_id}</td>
                    <td className="py-2 pr-4 text-slate-600">{t.party}</td>
                    <td className="py-2 pr-4 text-slate-600">{t.description}</td>
                    <td className="py-2 pr-4 text-right font-medium">{formatINR(t.amount_paise)}</td>
                    <td className="py-2 pr-4">
                      {t.receipt_key ? (
                        <a href={t.receipt_key} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 hover:underline">view</a>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-right">
                      <button onClick={() => setEditing(t)} className="mr-2 text-xs text-indigo-600 hover:underline">edit</button>
                      <button onClick={() => remove(t.id)} className="text-xs text-red-600 hover:underline">delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showForm && (
        <Modal title="New transaction" onClose={() => setShowForm(false)}>
          <TransactionForm onDone={() => { setShowForm(false); void load() }} />
        </Modal>
      )}

      {editing && (
        <Modal title="Edit transaction" onClose={() => setEditing(null)}>
          <TransactionForm initial={editing} onDone={() => { setEditing(null); void load() }} />
        </Modal>
      )}
    </div>
  )
}
