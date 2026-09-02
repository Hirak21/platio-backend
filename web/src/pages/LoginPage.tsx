import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { isSheetsMode } from '@/lib'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

export function LoginPage() {
  const { signIn, needsReauth } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSignIn() {
    setBusy(true)
    setError(null)
    try {
      await signIn()
    } catch (e) {
      setError(String((e as any)?.message ?? e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <h1 className="mb-1 text-2xl font-bold text-indigo-700">Platio</h1>
        <p className="mb-6 text-sm text-slate-500">Construction finance &amp; expense tracker</p>
        <Button onClick={handleSignIn} disabled={busy} className="w-full">
          {busy ? 'Signing in…' : isSheetsMode() ? 'Sign in with Google' : 'Enter demo mode'}
        </Button>
        {needsReauth && (
          <p className="mt-3 text-sm text-amber-600">
            Session expired — sign in again to grant access to your Google Sheet.
          </p>
        )}
        {error && <p className="mt-3 text-sm text-red-600">Sign-in failed: {error}</p>}
        {!isSheetsMode() && (
          <p className="mt-4 text-xs text-slate-400">
            Running in demo mode (in-memory). Set Vite env keys + a Google Sheet to use the live
            no-server backend.
          </p>
        )}
      </Card>
    </div>
  )
}
