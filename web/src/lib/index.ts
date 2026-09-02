// Store factory. Picks SheetsStore (real, needs Google creds) or MockStore
// (in-memory, zero creds) based on env. In Vite, import.meta.env.VITE_* is
// injected at build time; in Node smoke tests, process.env is used.
import type { Store } from './store'
import { MockStore } from './mockStore'
import { SheetsStore } from './sheetsStore'

function envValue(key: string): string | undefined {
  const meta = (import.meta as any)?.env
  const fromVite = meta && meta[key]
  if (fromVite) return String(fromVite).trim() || undefined
  try {
    const proc = (globalThis as any).process
    const fromEnv = proc && proc.env && proc.env[key]
    if (fromEnv) return String(fromEnv).trim() || undefined
  } catch {
    /* no process (browser) */
  }
  return undefined
}

export function isSheetsMode(): boolean {
  if (envValue('VITE_FORCE_SHEETS') === '1') return true
  // Sheets mode requires a configured Firebase + spreadsheet id.
  return Boolean(envValue('VITE_SPREADSHEET_ID') && envValue('VITE_FIREBASE_API_KEY'))
}

let singleton: Store | null = null

export function getStore(): Store {
  if (singleton) return singleton
  if (isSheetsMode()) {
    const sid = envValue('VITE_SPREADSHEET_ID')!
    singleton = new SheetsStore(sid)
  } else {
    singleton = new MockStore()
  }
  return singleton
}

export function resetStore(): void {
  singleton = null
}

export type { Store }
