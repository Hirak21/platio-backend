// Money is handled as integer PAISA (1/100 of INR) everywhere on the client.
// Never use floating point for authoritative totals. Parse strings defensively
// (Indian formatting "₹1,23,456.78" and plain "123456.78" both accepted).

export type Paise = number;

const AMOUNT_RE = /[^0-9.\-]/g;

export function parseAmount(input: number | string): number {
  if (typeof input === "number") return input;
  const cleaned = input.replace(AMOUNT_RE, "");
  const n = Number(cleaned);
  if (!Number.isFinite(n)) throw new Error(`Invalid amount: "${input}"`);
  return n;
}

/** Rupees (number or formatted string) -> integer paise. Rounds to nearest paisa. */
export function toPaise(rupees: number | string): Paise {
  return Math.round(parseAmount(rupees) * 100);
}

/** Integer paise -> rupees as a number (for display only). */
export function fromPaise(paise: Paise): number {
  return paise / 100;
}

/** Integer paise -> "₹1,23,456.78" (en-IN grouping). */
export function formatINR(paise: Paise): string {
  const negative = paise < 0;
  const abs = Math.abs(Math.trunc(paise));
  const rupees = Math.floor(abs / 100);
  const paisa = abs % 100;
  const grouped = rupees.toLocaleString("en-IN");
  return `${negative ? "-" : ""}₹${grouped}.${String(paisa).padStart(2, "0")}`;
}

/** Safe sum of paise values. */
export function sumPaise(items: Paise[]): Paise {
  return items.reduce((acc, v) => acc + (v || 0), 0);
}

/** Split a signed total by sign for income/expense math. */
export function signedTotal(items: Paise[]): Paise {
  return sumPaise(items);
}
