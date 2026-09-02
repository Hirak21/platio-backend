// Money formatting helpers. Paise (integer 1/100 INR) in, ₹ string out.
import type { Paise } from '@/lib/types'

export function formatINR(paise: Paise): string {
  const negative = paise < 0
  const abs = Math.abs(Math.trunc(paise))
  const rupees = Math.floor(abs / 100)
  const p = abs % 100
  const grouped = rupees.toLocaleString('en-IN')
  return `${negative ? '-' : ''}₹${grouped}.${String(p).padStart(2, '0')}`
}

// "123456.78" or "₹1,23,456.78" or "123456" -> integer paise
export function toPaise(input: string | number): Paise {
  const n = typeof input === 'number' ? input : Number(input.replace(/[^0-9.\-]/g, ''))
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100)
}

// rupees (number) -> integer paise
export function rupeesToPaise(rupees: number): Paise {
  return Math.round(rupees * 100)
}

// paise -> rupees number (for input fields)
export function paiseToRupees(paise: Paise): number {
  return Math.trunc(paise) / 100
}
