import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import type { Category, TxnType } from '@/lib/types'
import { uid } from '@/lib/uid'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'

export function CategoriesPage() {
  const store = useStore()
  const [categories, setCategories] = useState<Category[]>([])
  const [showForm, setShowForm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState<TxnType | 'both'>('expense')

  async function load() {
    setCategories(await store.listCategories())
  }

  useEffect(() => {
    void load()
  }, [store])

  async function submit() {
    if (!name.trim()) return
    setBusy(true)
    try {
      await store.createCategory({
        id: uid('cat'),
        name: name.trim(),
        type,
        parent_id: '',
        is_active: '1',
        sort_order: String(categories.length + 1),
      })
      setName('')
      setShowForm(false)
      await load()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Categories</h1>
        <Button onClick={() => setShowForm(true)}>New category</Button>
      </div>

      <Card>
        {categories.length === 0 ? (
          <p className="text-sm text-slate-500">No categories yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {categories.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-2">
                <span className="font-medium text-slate-900">{c.name}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{c.type}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {showForm && (
        <Modal title="New category" onClose={() => setShowForm(false)}>
          <div className="space-y-3">
            <Input label="Name" value={name} onChange={setName} required />
            <Select
              label="Applies to"
              value={type}
              onChange={(v) => setType(v as TxnType | 'both')}
              options={[
                { value: 'expense', label: 'Expense' },
                { value: 'income', label: 'Income' },
                { value: 'both', label: 'Both' },
              ]}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button onClick={submit} disabled={busy}>{busy ? 'Saving…' : 'Add'}</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
