// React access to the active Store. Throws if used outside <StoreProvider>.
//
// Sheets mode: the store needs a Google OAuth token (spreadsheets scope) that
// only exists AFTER the user signs in. So we do NOT bootstrap the schema until
// a user is present. Bootstrapping before sign-in throws "No Sheets token
// cached" and would blank the whole page. In Mock mode we bootstrap instantly.
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Store } from '@/lib/store'
import { getStore } from '@/lib'
import { useAuth } from './useAuth'

const StoreContext = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading, signIn } = useAuth()
  const [store] = useState<Store>(() => getStore())
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [retrying, setRetrying] = useState(false)

  // Mock mode: no auth, bootstrap immediately.
  // Sheets mode: wait for a signed-in user (which implies a cached token).
  const shouldBootstrap = store.kind === 'mock' ? !authLoading : Boolean(user)

  const bootstrap = useCallback(() => {
    let cancelled = false
    setReady(false)
    setError(null)
    setRetrying(true)
    store
      .ensureSchema()
      .then(() => store.seedDefaultCategoriesIfEmpty())
      .then(() => !cancelled && setReady(true))
      .catch((e) => !cancelled && setError(String(e?.message ?? e)))
      .finally(() => !cancelled && setRetrying(false))
    return () => {
      cancelled = true
    }
  }, [store])

  useEffect(() => {
    if (!shouldBootstrap) return
    return bootstrap()
  }, [shouldBootstrap, bootstrap])

  if (!ready) {
    // In Sheets mode with no user, render children anyway so the Login page shows.
    if (store.kind === 'sheets' && !user) {
      return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
    }
    if (error) {
      const isPermission = /403|PERMISSION_DENIED|does not have permission/i.test(error)
      const isAuthError = /401|UNAUTHENTICATED|invalid authentication credentials/i.test(error)
      return (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-4 text-center text-slate-600">
          <p className="max-w-md px-6 text-sm">Store error: {error}</p>
          {isAuthError ? (
            <>
              <p className="max-w-md px-6 text-xs text-slate-400">
                Your session has expired. Please sign in again to get a fresh access token.
              </p>
              <button
                type="button"
                onClick={signIn}
                disabled={retrying}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {retrying ? 'Signing in…' : 'Sign in again'}
              </button>
            </>
          ) : isPermission ? (
            <p className="max-w-md px-6 text-xs text-slate-400">
              This account lacks access. The no-server app uses the signed-in user's own Google token, so this
              account must be (1) added as a Test User in the OAuth consent screen, and (2) granted Editor access
              to the Platio spreadsheet. Sign in with the sheet owner's account, or fix both, then Retry.
            </p>
          ) : (
            <p className="max-w-md px-6 text-xs text-slate-400">
              If this says Sheets API 503/500, Google is temporarily down — wait a moment and retry.
            </p>
          )}
          {!isAuthError && (
            <button
              type="button"
              onClick={bootstrap}
              disabled={retrying}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {retrying ? 'Retrying…' : 'Retry'}
            </button>
          )}
        </div>
      )
    }
    return (
      <div className="flex min-h-dvh items-center justify-center text-slate-500">Loading Platio…</div>
    )
  }

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
}

export function useStore(): Store {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>')
  return ctx
}

export function useStoreKind(): 'sheets' | 'mock' {
  return useStore().kind
}
