import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { uploadToDrive } from 'sheets-core'
import { paiseToRupees, rupeesToPaise } from '@/lib/money'
import type { Project, Category, TxnType, NewTransaction, Transaction } from '@/lib/types'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'

const EMPTY: NewTransaction = {
  project_id: '',
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
}

export function TransactionForm({
  initial,
  onDone,
}: {
  initial?: Transaction
  onDone?: () => void
}) {
  const store = useStore()
  const [projects, setProjects] = useState<Project[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [form, setForm] = useState<NewTransaction>(initial ? toNew(initial) : EMPTY)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [receipt, setReceipt] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void Promise.all([store.listProjects(), store.listCategories()]).then(([p, c]) => {
      setProjects(p)
      setCategories(c)
      if (p.length && !form.project_id) setForm((f) => ({ ...f, project_id: p[0].id }))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store])

  function setField<K extends keyof NewTransaction>(k: K, v: NewTransaction[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function submit() {
    if (!form.project_id) {
      setError('Select a project first.')
      return
    }
    setError(null)
    setBusy(true)
    try {
      let receipt_key = form.receipt_key
      if (receipt) {
        setUploading(true)
        try {
          const up = await uploadToDrive(receipt, 'Platio Receipts')
          receipt_key = up.webViewLink
        } finally {
          setUploading(false)
        }
      }
      if (initial) {
        await store.updateTransaction(initial.id, { ...form, receipt_key })
      } else {
        await store.createTransaction({ ...form, receipt_key })
      }
      setForm(EMPTY)
      setReceipt(null)
      onDone?.()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const expenseCats = categories.filter((c) => c.type === 'expense' || c.type === 'both')
  const incomeCats = categories.filter((c) => c.type === 'income' || c.type === 'both')

  return (
    <div className="space-y-3">
      <Select
        label="Project"
        value={form.project_id}
        onChange={(v) => setField('project_id', v)}
        options={projects.map((p) => ({ value: p.id, label: p.name }))}
        required
      />
      <Select
        label="Type"
        value={form.type}
        onChange={(v) => setField('type', v as TxnType)}
        options={[{ value: 'expense', label: 'Expense' }, { value: 'income', label: 'Income' }]}
      />
      <Input
        label="Amount (₹)"
        type="number"
        step="0.01"
        min="0"
        value={String(paiseToRupees(form.amount_paise))}
        onChange={(v) => setField('amount_paise', rupeesToPaise(Number(v) || 0))}
        required
      />
      <Input label="Date" type="date" value={form.date} onChange={(v) => setField('date', v)} required />
      <Select
        label="Category"
        value={form.category_id}
        onChange={(v) => setField('category_id', v)}
        options={[{ value: '', label: '—' }, ...(form.type === 'income' ? incomeCats : expenseCats).map((c) => ({ value: c.id, label: c.name }))]}
      />
      <Input label="Party" value={form.party} onChange={(v) => setField('party', v)} />
      <Input label="Payment method" value={form.payment_method} onChange={(v) => setField('payment_method', v)} />
      <Input label="Description" value={form.description} onChange={(v) => setField('description', v)} />
      <Input label="Reference #" value={form.reference_number} onChange={(v) => setField('reference_number', v)} />
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Receipt (optional)</label>
        <input
          type="file"
          accept="image/*,application/pdf"
          onChange={(e) => setReceipt(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-700/10"
        />
        {form.receipt_key && !receipt && (
          <a href={form.receipt_key} target="_blank" rel="noreferrer" className="mt-1 block text-xs text-indigo-600 hover:underline">Current receipt</a>
        )}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={() => onDone?.()}>Cancel</Button>
        <Button onClick={submit} disabled={busy || uploading}>{busy || uploading ? 'Saving…' : (initial ? 'Save changes' : 'Add transaction')}</Button>
      </div>
    </div>
  )
}

function toNew(t: Transaction): NewTransaction {
  return {
    project_id: t.project_id,
    type: t.type,
    amount_paise: t.amount_paise,
    date: t.date,
    category_id: t.category_id,
    subcategory_id: t.subcategory_id,
    party: t.party,
    payment_method: t.payment_method,
    description: t.description,
    reference_number: t.reference_number,
    receipt_key: t.receipt_key,
  }
}
