// Thin client around Google Sheets API v4. No gapi dependency — plain fetch + Bearer token.
// Design rules (no-server, safe against client edits):
//  - Writes are APPEND-ONLY for transactional data (movements, transactions, audit).
//  - Updates target exact ranges for master-data rows (projects, items, categories).
//  - All money is integer paise as a string column.
//
// IMPORTANT: A1 ranges (e.g. `Projects!1:1`) are placed RAW in the URL path. Do NOT
// encodeURIComponent the `!` or `:` — the API rejects the encoded form with 400
// "Unable to parse range".
//
// Transient errors (429 rate-limit, 503 unavailable) are retried with backoff so a
// brief Google outage or quota blip doesn't hard-fail the whole app.
// 401 (unauthorized) triggers token clear and re-auth requirement.

import { clearToken } from "./auth.js";

const API = "https://sheets.googleapis.com/v4/spreadsheets";

export type TokenProvider = () => Promise<string>;

export interface Row {
  [col: string]: string | number;
}

// Statuses worth retrying. 429 = quota; 503/500 = transient backend issue.
// 401 is handled separately — it means token expired/revoked, need re-auth.
const TRANSIENT = new Set([429, 500, 503]);
const MAX_RETRIES = 3;

export class SheetsClient {
  constructor(
    private spreadsheetId: string,
    private getToken: TokenProvider
  ) {}

  private async headers(): Promise<Record<string, string>> {
    return { Authorization: `Bearer ${await this.getToken()}`, "Content-Type": "application/json" };
  }

  private async request(method: string, url: string, body?: unknown): Promise<Response> {
    let lastErr: Error | null = null;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const res = await fetch(url, {
          method,
          headers: await this.headers(),
          body: body === undefined ? undefined : JSON.stringify(body),
        });
        if (res.ok || !TRANSIENT.has(res.status)) {
          // Handle 401 (token expired/revoked) - clear token so app forces re-auth
          if (res.status === 401) {
            clearToken();
          }
          return res;
        }
        lastErr = new Error(`Sheets API ${res.status}`);
      } catch (e) {
        // Network-level failure (offline, DNS) — also transient.
        lastErr = e instanceof Error ? e : new Error(String(e));
      }
      if (attempt < MAX_RETRIES) {
        const delay = Math.min(800 * 2 ** attempt, 4000) + Math.random() * 250;
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    throw lastErr ?? new Error("Sheets request failed after retries");
  }

  /** Read a range as array-of-arrays (incl. header row). Range is raw A1 (e.g. `Tab!1:1`). */
  async getValues(range: string): Promise<string[][]> {
    const res = await this.request("GET", `${API}/${this.spreadsheetId}/values/${range}`);
    if (!res.ok) throw new Error(await this.err(res, range));
    const data = (await res.json()) as { values?: string[][] };
    return data.values ?? [];
  }

  /** Append one row to a tab (after the last populated row). Returns the updated range. */
  async appendRow(tab: string, values: (string | number)[]): Promise<string> {
    const body = { values: [values.map((v) => String(v))] };
    const url = `${API}/${this.spreadsheetId}/values/${encodeURIComponent(tab)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
    const res = await this.request("POST", url, body);
    if (!res.ok) throw new Error(await this.err(res, tab));
    const data = (await res.json()) as { updates?: { updatedRange?: string } };
    return data.updates?.updatedRange ?? "";
  }

  /** Overwrite a specific range (e.g. a single master-data row). Range is raw A1. */
  async updateValues(range: string, values: (string | number)[][]): Promise<void> {
    const body = { values: values.map((row) => row.map((v) => String(v))) };
    const res = await this.request("PUT", `${API}/${this.spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`, body);
    if (!res.ok) throw new Error(await this.err(res, range));
  }

  /** Create the named tab if it does not already exist. */
  private async createTabIfMissing(tab: string): Promise<void> {
    const url = `${API}/${this.spreadsheetId}:batchUpdate`;
    const body = { requests: [{ addSheet: { properties: { title: tab } } }] };
    const res = await this.request("POST", url, body);
    if (res.ok) return;
    // 400 with "duplicate" / already exists is fine — tab is present.
    const text = await res.text().catch(() => "");
    if (!/already exists|DUPLICATE|already a sheet/i.test(text)) {
      // Re-throw only if it's a real error (e.g. 403 permissions).
      throw new Error(`Sheets API ${res.status}: ${text.slice(0, 300)}`);
    }
  }

  /** Ensure a tab exists with the given header row. Safe to call repeatedly. */
  async ensureTab(tab: string, columns: string[]): Promise<void> {
    let header: string[] = [];
    try {
      const existing = await this.getValues(`${tab}!1:1`);
      if (existing.length) header = existing[0];
    } catch {
      // Tab likely missing — create it below.
    }
    if (header.length && header.join("|") === columns.join("|")) return;

    if (!header.length) {
      await this.createTabIfMissing(tab);
    }
    await this.updateValues(`${tab}!1:1`, [columns]);
  }

  /** Batch read multiple ranges (dashboard aggregation). Ranges are raw A1. */
  async batchGet(ranges: string[]): Promise<string[][][]> {
    const q = ranges.map((r) => `ranges=${encodeURIComponent(r)}`).join("&");
    const res = await this.request("GET", `${API}/${this.spreadsheetId}/values:batchGet?${q}`);
    if (!res.ok) throw new Error(await this.err(res, ranges.join(",")));
    const data = (await res.json()) as { valueRanges?: { values?: string[][] }[] };
    return (data.valueRanges ?? []).map((v) => v.values ?? []);
  }

  private async err(res: Response, ctx: string): Promise<string> {
    const text = await res.text().catch(() => "");
    return `Sheets API ${res.status} [${ctx}]: ${text.slice(0, 300)}`;
  }
}
