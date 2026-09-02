// Verifies the SheetsClient builds raw (unencoded) A1 ranges in the URL path.
// Uses a fake token + a fetch shim that captures the request URL instead of sending it.
import { SheetsClient } from "../dist/index.js";

const captured = [];
globalThis.fetch = async (url, opts) => {
  captured.push({ url, method: opts?.method ?? "GET" });
  return new Response(JSON.stringify({ values: [] }), { status: 200 });
};

const client = new SheetsClient("SHEET_ID", async () => "FAKE_TOKEN");

// exercise the range-bearing calls
await client.getValues("Projects!1:1").catch(() => {});
await client.updateValues("Projects!1:1", [["a", "b"]]).catch(() => {});
await client.batchGet(["Projects!2:2", "Transactions!A1:B"]).catch(() => {});
await client.appendRow("Projects", ["x"]).catch(() => {});

for (const c of captured) {
  const hasEncoded = /%21|%3A/.test(c.url);
  console.log(`${c.method} ${c.url}  ${hasEncoded ? "❌ ENCODED" : "✅ raw"}`);
}
