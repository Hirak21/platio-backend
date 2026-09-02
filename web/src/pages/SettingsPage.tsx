import { useRef, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useStore } from '@/hooks/useStore'
import { exportSnapshot, downloadSnapshot, parseSnapshot, importSnapshot } from '@/lib/dataIO'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

type Tab = 'profile' | 'data' | 'about'

export function SettingsPage() {
  const { user, signOut } = useAuth()
  const store = useStore()
  const [tab, setTab] = useState<Tab>('profile')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleExport() {
    setBusy(true)
    setMsg(null)
    try {
      const snap = await exportSnapshot(store)
      downloadSnapshot(snap)
      setMsg('Exported JSON downloaded.')
    } catch (e) {
      setMsg(`Export failed: ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  async function handleImportFile(file: File) {
    setBusy(true)
    setMsg(null)
    try {
      const text = await file.text()
      const snap = parseSnapshot(text)
      await importSnapshot(store, snap)
      setMsg(`Imported ${snap.projects.length} projects, ${snap.transactions.length} transactions.`)
    } catch (e) {
      setMsg(`Import failed: ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'profile', label: 'Profile' },
    { id: 'data', label: 'Data' },
    { id: 'about', label: 'About' },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Settings</h1>

      <Card className="flex flex-wrap gap-1 p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {t.label}
          </button>
        ))}
      </Card>

      <Card>
        {tab === 'profile' && (
          <div className="space-y-6 p-2">
            <h3 className="text-lg font-semibold text-slate-900">Profile</h3>
            <div className="flex items-center gap-4">
              <div className="flex size-16 items-center justify-center rounded-full bg-indigo-100 text-xl font-bold text-indigo-700">
                {(user?.displayName || user?.email || 'U').charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-lg font-semibold text-slate-900">{user?.displayName || 'User'}</p>
                <p className="text-sm text-slate-500">{user?.email}</p>
              </div>
            </div>
            <p className="text-sm text-slate-500">
              Signed in with Google. Data is stored in your connected Google Sheet — no password needed.
            </p>
            <div className="pt-2 border-t border-slate-200">
              <Button variant="secondary" onClick={signOut}>
                Sign out
              </Button>
            </div>
          </div>
        )}

        {tab === 'data' && (
          <div className="space-y-4 p-2">
            <h3 className="text-lg font-semibold text-slate-900">Data management</h3>
            <Card className="border border-slate-200 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-slate-900">Export all data</p>
                  <p className="text-sm text-slate-500">Download projects, transactions and categories as JSON.</p>
                </div>
                <Button onClick={handleExport} disabled={busy}>Export JSON</Button>
              </div>
            </Card>
            <Card className="border border-slate-200 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-slate-900">Import data</p>
                  <p className="text-sm text-slate-500">Restore from a previously exported JSON file.</p>
                </div>
                <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={busy}>Import JSON</Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) void handleImportFile(f)
                    e.target.value = ''
                  }}
                />
              </div>
            </Card>
            {msg && <p className="text-sm text-indigo-700">{msg}</p>}
          </div>
        )}

        {tab === 'about' && (
          <div className="space-y-4 p-2">
            <div className="text-center">
              <div className="mx-auto mb-3 flex size-16 items-center justify-center rounded-2xl bg-indigo-100 text-xl font-bold text-indigo-700">
                P
              </div>
              <h3 className="text-xl font-bold text-slate-900">Platio</h3>
              <p className="text-sm text-slate-500">Construction project finance & expense tracking</p>
              <p className="mt-1 text-xs text-slate-400">No-server build · data in Google Sheets</p>
            </div>
            <Card className="p-4">
              <h4 className="mb-2 font-medium text-slate-900">Features</h4>
              <ul className="space-y-1 text-sm text-slate-600">
                <li>• Multi-project management</li>
                <li>• Income & expense tracking</li>
                <li>• Category support</li>
                <li>• Receipt upload (Google Drive)</li>
                <li>• Budget tracking with alerts</li>
                <li>• Excel (.xlsx) reports</li>
                <li>• Charts & dashboard</li>
                <li>• Audit trail</li>
              </ul>
            </Card>
          </div>
        )}
      </Card>
    </div>
  )
}
