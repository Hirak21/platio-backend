import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '@/hooks/useStore'
import { formatINR } from '@/lib/money'
import { buildDashboard } from '@/lib/finance'
import type { Project, Transaction, Category, ProjectStatus, NewProject } from '@/lib/types'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: 'planning', label: 'Planning' },
  { value: 'active', label: 'Active' },
  { value: 'on_hold', label: 'On hold' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

export function ProjectsPage() {
  const store = useStore()
  const [projects, setProjects] = useState<Project[]>([])
  const [txns, setTxns] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Project | null>(null)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState<NewProject>({
    name: '',
    client_name: '',
    location: '',
    description: '',
    start_date: '',
    expected_completion_date: '',
    budget_paise: 0,
    status: 'active',
  })

  async function load() {
    const [p, t, c] = await Promise.all([store.listProjects(), store.listTransactions(), store.listCategories()])
    setProjects(p)
    setTxns(t)
    setCategories(c)
  }

  useEffect(() => {
    void load()
  }, [store])

  function setField<K extends keyof NewProject>(k: K, v: NewProject[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  function openEdit(p: Project) {
    setEditing(p)
    setForm({
      name: p.name,
      client_name: p.client_name,
      location: p.location,
      description: p.description,
      start_date: p.start_date,
      expected_completion_date: p.expected_completion_date,
      budget_paise: p.budget_paise,
      status: p.status,
    })
  }

  async function submit() {
    if (!form.name.trim()) return
    setBusy(true)
    try {
      if (editing) {
        await store.updateProject(editing.id, { ...form })
        setEditing(null)
      } else {
        await store.createProject({ ...form })
        setForm({ name: '', client_name: '', location: '', description: '', start_date: '', expected_completion_date: '', budget_paise: 0, status: 'active' })
      }
      setShowForm(false)
      await load()
    } finally {
      setBusy(false)
    }
  }

  const dash = buildDashboard(projects, txns, categories)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Projects</h1>
        <Button onClick={() => setShowForm(true)}>New project</Button>
      </div>

      {projects.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-500">No projects yet. Create your first one.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {projects.map((p) => {
            const tot = dash.totalsByProject[p.id]
            return (
              <Link key={p.id} to={`/projects/${p.id}`} className="block">
                <Card className="h-full transition-shadow hover:shadow-md">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold text-slate-900">{p.name}</div>
                      <div className="text-xs text-slate-500">{p.client_name} · {p.location}</div>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{p.status}</span>
                    <button onClick={(e) => { e.preventDefault(); openEdit(p) }} className="text-xs text-indigo-600 hover:underline">edit</button>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <div className="text-slate-500">Budget</div>
                      <div className="font-medium">{formatINR(tot.budget)}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Spent</div>
                      <div className="font-medium text-red-600">{formatINR(tot.expense)}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Income</div>
                      <div className="font-medium text-emerald-600">{formatINR(tot.income)}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Net</div>
                      <div className="font-medium">{formatINR(tot.net)}</div>
                    </div>
                  </div>
                  {tot.budget_exceeded && (
                    <div className="mt-2 rounded bg-red-50 px-2 py-1 text-xs font-medium text-red-700">
                      Budget exceeded
                    </div>
                  )}
                </Card>
              </Link>
            )
          })}
        </div>
      )}

      {showForm && (
        <Modal title={editing ? 'Edit project' : 'New project'} onClose={() => { setShowForm(false); setEditing(null) }}>
          <div className="space-y-3">
            <Input label="Name" value={form.name} onChange={(v) => setField('name', v)} required />
            <Input label="Client name" value={form.client_name} onChange={(v) => setField('client_name', v)} />
            <Input label="Location" value={form.location} onChange={(v) => setField('location', v)} />
            <Input label="Description" value={form.description} onChange={(v) => setField('description', v)} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Start date" type="date" value={form.start_date} onChange={(v) => setField('start_date', v)} />
              <Input label="Expected completion" type="date" value={form.expected_completion_date} onChange={(v) => setField('expected_completion_date', v)} />
            </div>
            <Input label="Budget (₹)" type="number" step="0.01" min="0" value={String(form.budget_paise / 100)} onChange={(v) => setField('budget_paise', Math.round((Number(v) || 0) * 100))} />
            <Select label="Status" value={form.status} onChange={(v) => setField('status', v as ProjectStatus)} options={STATUS_OPTIONS} />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button onClick={submit} disabled={busy}>{busy ? 'Saving…' : (editing ? 'Save' : 'Create')}</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
