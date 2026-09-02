// Short unique id generator. Browser + Node 26 both have crypto.randomUUID.
export function uid(prefix = ''): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      : Math.random().toString(36).slice(2, 14)
  return prefix ? `${prefix}_${rand}` : rand
}

export function nowIso(): string {
  return new Date().toISOString()
}
