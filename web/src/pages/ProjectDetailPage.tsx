import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useStore } from '@/hooks/useStore'
import { formatINR } from '@/lib/money'
import { projectTotals } from '@/lib/finance'
import type { Project, Transaction, Category, TxnType, NewTransaction } from '@/lib/types'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { TransactionForm } from '@/components/TransactionForm'

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const store = useStore()
  const [project, setProject] = useState<Project | null>(null)
  const [txns, setTxns] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState<NewTransaction>({
    project_id: id ?? '',
    type: 'expense',
    amount_paise: 0,
    date: new Date().toISOString().slice(0, 10),
    category_id: '',
    subcategory_id: '',
    party: '',
    payment_method: '',
    description: '',
    reference_number: '',
    receipt_key: '',
  })

  async function load() {
    if (!id) return
    const [p, t, c] = await Promise.all([
      store.listProjects(),
      store.listTransactionsByProject(id),
      store.listCategories(),
    ])
    setProject(p.find((x) => x.id === id) ?? null)
    setTxns(t)
    setCategories(c)
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, id])

  function setField<K extends keyof NewTransaction>(k: K, v: NewTransaction[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function submit() {
    setBusy(true)
    try {
      await store.createTransaction({ ...form })
      setShowForm(false)
      setForm((f) => ({ ...f, type: 'expense', amount_paise: 0, category_id: '', description: '' }))
      await load()
    } finally {
      setBusy(false)
    }
  }

  async function remove(txnId: string) {
    await store.deleteTransaction(txnId)
    await load()
  }

  if (!project) return <p className="text-slate-500">Loading…</p>

  const tot = projectTotals(project, txns)
  const expenseCats = categories.filter((c) => c.type === 'expense' || c.type === 'both')
  const incomeCats = categories.filter((c) => c.type === 'income' || c.type === 'both')

  return (
    <div className="space-y-6">
      <div>
        <Link to="/projects" className="text-sm text-indigo-600 hover:underline">← Projects</Link>
        <div className="mt-1 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">{project.name}</h1>
          <Button onClick={() => setShowForm(true)}>Add transaction</Button>
        </div>
        <p className="text-sm text-slate-500">{project.client_name} · {project.location} · {project.status}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card><div className="text-xs text-slate-500">Budget</div><div className="font-semibold">{formatINR(tot.budget)}</div></Card>
        <Card><div className="text-xs text-slate-500">Income</div><div className="font-semibold text-emerald-600">{formatINR(tot.income)}</div></Card>
        <Card><div className="text-xs text-slate-500">Expense</div><div className="font-semibold text-red-600">{formatINR(tot.expense)}</div></Card>
        <Card><div className="text-xs text-slate-500">Net</div><div className="font-semibold">{formatINR(tot.net)}</div></Card>
      </div>
      {tot.budget_exceeded && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">Budget exceeded</div>
      )}

      <Card>
        <h2 className="mb-3 text-lg font-semibold">Transactions ({txns.length})</h2>
        {txns.length === 0 ? (
          <p className="text-sm text-slate-500">No transactions yet. Add the first one.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Category</th>
                  <th className="py-2 pr-4">Party</th>
                  <th className="py-2 pr-4">Description</th>
                  <th className="py-2 pr-4 text-right">Amount</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {txns.map((t) => (
                  <tr key={t.id} className="border-b border-slate-100">
                    <td className="py-2 pr-4 text-slate-600">{t.date}</td>
                    <td className="py-2 pr-4">
                      <span className={t.type === 'income' ? 'text-emerald-600' : 'text-red-600'}>{t.type}</span>
                    </td>
                    <td className="py-2 pr-4 text-slate-600">{categories.find((c) => c.id === t.category_id)?.name ?? t.category_id}</td>
                    <td className="py-2 pr-4 text-slate-600">{t.party}</td>
                    <td className="py-2 pr-4 text-slate-600">{t.description}</td>
                    <td className="py-2 pr-4 text-right font-medium">{formatINR(t.amount_paise)}</td>
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
        <Modal title="Add transaction" onClose={() => setShowForm(false)}>
          <div className="space-y-3">
            <Select
              label="Type"
              value={form.type}
              onChange={(v) => setField('type', v as TxnType)}
              options={[
                { value: 'expense', label: 'Expense' },
                { value: 'income', label: 'Income' },
              ]}
            />
            <Input label="Amount (₹)" type="number" step="0.01" min="0" value={String(form.amount_paise / 100)} onChange={(v) => setField('amount_paise', Math.round((Number(v) || 0) * 100))} required />
            <Input label="Date" type="date" value={form.date} onChange={(v) => setField('date', v)} required />
            <Select
              label="Category"
              value={form.category_id}
              onChange={(v) => setField('category_id', v)}
              options={[
                { value: '', label: '—' },
                ...(form.type === 'income' ? incomeCats : expenseCats).map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
            <Input label="Party" value={form.party} onChange={(v) => setField('party', v)} />
            <Input label="Payment method" value={form.payment_method} onChange={(v) => setField('payment_method', v)} />
            <Input label="Description" value={form.description} onChange={(v) => setField('description', v)} />
            <Input label="Reference #" value={form.reference_number} onChange={(v) => setField('reference_number', v)} />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button onClick={submit} disabled={busy}>{busy ? 'Saving…' : 'Add'}</Button>
            </div>
          </div>
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
