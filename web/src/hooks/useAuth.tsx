// Auth layer. In Sheets mode, wraps sheets-core signInWithGoogle (Firebase Google
// + spreadsheets scope). In Mock mode, "signs in" with a fake user so the app is
// usable with zero credentials.
//
// Critical: in Sheets mode a "signed in" user REQUIRES a cached Sheets token.
// Firebase may restore a session on reload WITHOUT a token (tokens aren't
// persisted by sheets-core), so we must re-run signInWithGoogle to capture it.
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { initAuth, signInWithGoogle, signOutGoogle, observeAuth, hasToken } from 'sheets-core'
import { isSheetsMode } from '@/lib'

export interface AppUser {
  uid: string
  displayName: string
  email: string
}

interface AuthValue {
  user: AppUser | null
  loading: boolean
  needsReauth: boolean
  signIn: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

const MOCK_USER: AppUser = { uid: 'mock-owner', displayName: 'Demo Owner', email: 'demo@platio.local' }

function toAppUser(u: { uid: string; displayName?: string | null; email?: string | null }): AppUser {
  return { uid: u.uid, displayName: u.displayName ?? 'User', email: u.email ?? '' }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [needsReauth, setNeedsReauth] = useState(false)

  useEffect(() => {
    if (!isSheetsMode()) {
      setUser(MOCK_USER)
      setLoading(false)
      return
    }
    initAuth()
    const unsub = observeAuth((u) => {
      // A restored Firebase session is only "signed in" if we also hold a Sheets token.
      if (u && hasToken()) {
        setUser(toAppUser(u))
        setNeedsReauth(false)
      } else if (u && !hasToken()) {
        // Firebase session exists but no Sheets token (e.g. page reload). Force re-auth.
        setUser(null)
        setNeedsReauth(true)
      } else {
        setUser(null)
        setNeedsReauth(false)
      }
      setLoading(false)
    })
    return unsub
  }, [])

  const signIn = useCallback(async () => {
    if (!isSheetsMode()) {
      setUser(MOCK_USER)
      return
    }
    const { user: u } = await signInWithGoogle()
    setUser(toAppUser(u))
    setNeedsReauth(false)
  }, [])

  const signOut = useCallback(async () => {
    if (!isSheetsMode()) {
      setUser(null)
      return
    }
    await signOutGoogle()
    setUser(null)
    setNeedsReauth(false)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, needsReauth, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
