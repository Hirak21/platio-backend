"use strict";

const TOKEN_KEY = "platio_token";
// API base URL - set at build/deploy time via sed in deploy.sh
const API_BASE = 'https://platio-backend-1.onrender.com';
const state = {
  user: null,
  token: localStorage.getItem(TOKEN_KEY) || null,
  projects: [],
  categories: { expense: [], income: [] },
  txnPage: { offset: 0, limit: 50 },
};

/* Surface any runtime error visibly instead of failing silently */
window.addEventListener("error", (e) => toast("Error: " + (e.message || "script error"), true));
window.addEventListener("unhandledrejection", (e) => {
  const r = e.reason;
  toast("Error: " + ((r && r.message) || r || "unknown"), true);
});

/* ---------------- API client ---------------- */
async function api(path, opts = {}) {
  const headers = { "Content-Type": "application/json" };
  if (state.token) headers["Authorization"] = "Bearer " + state.token;
  const url = API_BASE ? API_BASE + path : path;
  console.log("[API] →", path, opts?.method || "GET", url);
  const res = await fetch(url, {
    credentials: "same-origin",
    headers,
    ...opts,
  });
  if (res.status === 401) {
    state.token = null;
    localStorage.removeItem(TOKEN_KEY);
    showLogin();
    throw new Error("unauthenticated");
  }
  let data = null;
  try { data = await res.json(); } catch (_) {}
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    if (data && data.detail) {
      if (Array.isArray(data.detail)) {
        msg = data.detail
          .map((d) => (d.loc ? d.loc[d.loc.length - 1] + ": " : "") + d.msg)
          .join("; ");
      } else if (typeof data.detail === "string") {
        msg = data.detail;
      }
    }
    throw new Error(msg);
  }
  return data;
}
async function apiForm(path, formData) {
  const url = API_BASE ? API_BASE + path : path;
  const res = await fetch(url, { credentials: "same-origin", method: "POST", body: formData });
  if (res.status === 401) { showLogin(); throw new Error("unauthenticated"); }
  let data = null; try { data = await res.json(); } catch (_) {}
  if (!res.ok) throw new Error((data && data.detail) || "Upload failed");
  return data;
}

/* ---------------- Helpers ---------------- */
function fmt(n, withSymbol = true) {
  if (n === null || n === undefined || isNaN(n)) n = 0;
  const neg = n < 0;
  n = Math.abs(n);
  const s = n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (neg ? "-" : "") + (withSymbol ? "₹" : "") + s;
}
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function el(id) { return document.getElementById(id); }
function setView(html) { el("view").innerHTML = html; }
function toast(msg, isErr) {
  const t = el("toast");
  t.textContent = msg; t.hidden = false;
  t.className = "toast" + (isErr ? " err" : "");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (t.hidden = true), 3200);
}
function $(sel, root = document) { return root.querySelector(sel); }
function $all(sel, root = document) { return [...root.querySelectorAll(sel)]; }

function showApp() {
  el("login-view").style.display = "none";
  el("app-view").style.display = "flex";
  el("user-label").textContent = state.user ? state.user.username : "";
}
function showLogin() {
  el("app-view").style.display = "none";
  el("login-view").style.display = "flex";
  el("login-error").hidden = true;
}

/* ---------------- Auth ---------------- */
async function checkAuth() {
  try {
    state.user = await api("/auth/me");
    showApp();
    await boot();
    route();
  } catch (_) { showLogin(); }
}
async function boot() {
  const [p, ce, ci] = await Promise.all([
    api("/projects"),
    api("/categories?kind=expense"),
    api("/categories?kind=income"),
  ]);
  state.projects = p;
  state.categories.expense = ce;
  state.categories.income = ci;
}

el("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const u = el("login-username").value, p = el("login-password").value;
  try {
    const loginRes = await api("/auth/login", { method: "POST", body: JSON.stringify({ username: u, password: p }) });
    if (loginRes && loginRes.access_token) {
      state.token = loginRes.access_token;
      localStorage.setItem(TOKEN_KEY, state.token);
    }
    state.user = await api("/auth/me");
    showApp(); await boot(); route();
  } catch (err) {
    el("login-error").textContent = err.message;
    el("login-error").hidden = false;
  }
});
el("logout-btn").addEventListener("click", async () => {
  try { await api("/auth/logout", { method: "POST" }); } catch (_) {}
  state.token = null; state.user = null;
  localStorage.removeItem(TOKEN_KEY);
  showLogin();
});

/* ---------------- Router ---------------- */
const routes = {
  dashboard: viewDashboard,
  projects: viewProjects,
  "add-income": () => viewAddTxn("income"),
  "add-expense": () => viewAddTxn("expense"),
  transactions: viewTransactions,
  reports: viewReports,
  settings: viewSettings,
};
function route() {
  const r = (location.hash || "#dashboard").slice(1);
  $all("#nav a").forEach((a) => a.classList.toggle("active", a.dataset.route === r));
  (routes[r] || viewDashboard)();
}
window.addEventListener("hashchange", route);

/* ---------------- Shared selects ---------------- */
function projectOptions(selected) {
  return `<option value="">— All projects —</option>` +
    state.projects.map((p) => `<option value="${p.id}" ${selected == p.id ? "selected" : ""}>${esc(p.project_code)} · ${esc(p.name)}</option>`).join("");
}
function categoryOptions(kind, selected) {
  return `<option value="">— Category —</option>` +
    state.categories[kind].filter((c) => c.is_active).map((c) => `<option ${selected === c.name ? "selected" : ""}>${esc(c.name)}</option>`).join("");
}

/* ---------------- Dashboard ---------------- */
async function viewDashboard() {
  setView(`<h1>Dashboard</h1><div class="sub">Global financial overview across all projects.</div><div id="dash">Loading…</div>`);
  const d = await api("/dashboard");
  const g = d.global;
  setView(`
    <h1>Dashboard</h1>
    <div class="sub">Global financial overview across all projects.</div>
    <div class="section">
      <div class="grid kpi-grid">
        ${kpi("Total Projects", g.total_projects, `${g.active_projects} active`)}
        ${kpi("Total Budget", fmt(g.total_budget_paise / 100), "planned", "")}
        ${kpi("Total Income", fmt(g.total_income_paise / 100), "received", "income")}
        ${kpi("Total Expense", fmt(g.total_expense_paise / 100), "spent", "expense")}
        ${kpi("Cash Balance", fmt(g.total_cash_balance_paise / 100), "income − expense", g.total_cash_balance_paise < 0 ? "expense" : "")}
        ${kpi("Remaining Budget", fmt(g.total_remaining_budget_paise / 100), `utilised ${g.utilisation_pct}%`, g.total_remaining_budget_paise < 0 ? "expense" : "")}
      </div>
    </div>
    <div class="section grid" style="grid-template-columns:1fr 1fr; align-items:start;">
      <div class="card">
        <div class="section-title">Expense by Category</div>
        ${categoryBars(d.expense_by_category)}
      </div>
      <div class="card">
        <div class="section-title">Monthly Trend (Income vs Expense)</div>
        ${trendBars(d.monthly)}
      </div>
    </div>
    <div class="section">
      <div class="section-title">Recent Transactions</div>
      ${await txnTable(d.recent, true)}
    </div>
  `);
  bindRecentClicks();
}
function kpi(label, value, meta, cls = "") {
  return `<div class="card kpi ${cls}"><span class="label">${label}</span><span class="value">${value}</span><span class="meta">${meta}</span></div>`;
}
function categoryBars(list) {
  if (!list.length) return `<div class="empty">No expenses yet.</div>`;
  const max = Math.max(...list.map((x) => x.total_paise));
  return list.map((x) => `
    <div style="margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:3px;">
        <span>${esc(x.category)}</span><span class="muted">${fmt(x.total_paise / 100)} · ${x.pct}%</span>
      </div>
      <div class="bar"><span style="width:${(x.total_paise / max * 100).toFixed(1)}%"></span></div>
    </div>`).join("");
}
function trendBars(monthly) {
  if (!monthly.length) return `<div class="empty">No activity yet.</div>`;
  const max = Math.max(...monthly.flatMap((m) => [m.income_paise, m.expense_paise]), 1);
  return monthly.map((m) => `
    <div style="margin-bottom:10px;">
      <div style="font-size:12px;color:var(--muted);margin-bottom:3px;">${esc(m.month)}</div>
      <div style="display:flex;gap:6px;align-items:center;">
        <div style="flex:1"><div class="bar"><span style="width:${(m.income_paise / max * 100).toFixed(1)}%;background:var(--income)"></span></div></div>
        <div style="flex:1"><div class="bar"><span style="width:${(m.expense_paise / max * 100).toFixed(1)}%;background:var(--expense)"></span></div></div>
      </div>
    </div>`).join("") + `<div class="legend"><span class="item"><span class="dot" style="background:var(--income)"></span>Income</span><span class="item"><span class="dot" style="background:var(--expense)"></span>Expense</span></div>`;
}

/* ---------------- Projects ---------------- */
async function viewProjects() {
  setView(`<h1>Projects</h1><div class="sub">Each project is financially isolated.</div>
    <div class="btn-row" style="margin-bottom:16px;"><button class="btn btn-primary" id="new-proj">+ New Project</button></div>
    <div id="proj-list"></div>`);
  el("new-proj").onclick = () => openProjectModal();
  await renderProjects();
}
async function renderProjects() {
  const projs = await api("/projects");
  state.projects = projs;
  const html = projs.map((p) => `
    <div class="card" style="margin-bottom:14px;">
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px;align-items:flex-start;">
        <div>
          <div style="font-weight:700;font-size:16px;">${esc(p.name)} <span class="pill">${esc(p.project_code)}</span></div>
          <div class="muted" style="font-size:13px;">${esc(p.client_name || "")} · ${esc(p.location || "")} · ${esc(p.status)}</div>
        </div>
        <div class="btn-row">
          <button class="btn btn-outline btn-sm" data-edit="${p.id}">Edit</button>
          <button class="btn btn-outline btn-sm" data-view="${p.id}">Dashboard</button>
          <button class="btn btn-danger btn-sm" data-del="${p.id}">Delete</button>
        </div>
      </div>
      <div class="grid kpi-grid" style="margin-top:14px;">
        ${kpi("Budget", fmt(p.budget), "")}
        ${kpi("Income", fmt(p.total_income), "", "income")}
        ${kpi("Expense", fmt(p.total_expense), "", "expense")}
        ${kpi("Cash Balance", fmt(p.cash_balance), "")}
        ${kpi("Remaining Budget", fmt(p.remaining_budget), `utilised ${p.utilisation_pct}%`, p.budget_exceeded ? "expense" : "")}
      </div>
      ${p.budget_exceeded ? `<div class="tag warn" style="margin-top:12px;">⚠ Budget exceeded by ${fmt(p.budget_exceeded_by)}</div>` : ""}
    </div>`).join("");
  el("proj-list").innerHTML = html || `<div class="empty">No projects yet.</div>`;
  $all("[data-edit]").forEach((b) => b.onclick = () => openProjectModal(+b.dataset.edit));
  $all("[data-view]").forEach((b) => b.onclick = () => { location.hash = "#dashboard"; viewProjectDashboard(+b.dataset.view); });
  $all("[data-del]").forEach((b) => b.onclick = () => deleteProject(+b.dataset.del));
}
async function viewProjectDashboard(pid) {
  const d = await api(`/projects/${pid}/dashboard`);
  const f = d.financials;
  setView(`
    <h1>${esc(d.project_name)} <span class="pill">${esc(d.project_code)}</span></h1>
    <div class="sub">Project-specific financials.</div>
    <div class="section"><div class="grid kpi-grid">
      ${kpi("Budget", fmt(f.budget_paise / 100), "")}
      ${kpi("Income", fmt(f.total_income_paise / 100), "", "income")}
      ${kpi("Expense", fmt(f.total_expense_paise / 100), "", "expense")}
      ${kpi("Cash Balance", fmt(f.cash_balance_paise / 100), "")}
      ${kpi("Remaining Budget", fmt(f.remaining_budget_paise / 100), `utilised ${f.utilisation_pct}%`, f.budget_exceeded ? "expense" : "")}
    </div></div>
    ${f.budget_exceeded ? `<div class="tag warn" style="margin-bottom:16px;">⚠ Budget exceeded by ${fmt(f.budget_exceeded_by_paise / 100)}</div>` : ""}
    <div class="section grid" style="grid-template-columns:1fr 1fr;align-items:start;">
      <div class="card"><div class="section-title">Expense by Category</div>${categoryBars(d.expense_by_category)}</div>
      <div class="card"><div class="section-title">Monthly Trend</div>${trendBars(d.monthly)}</div>
    </div>
    <div class="section"><div class="section-title">Recent Transactions</div>${await txnTable(d.recent, true)}</div>
    <div class="btn-row"><button class="btn btn-outline" id="back">← All Projects</button></div>
  `);
  el("back").onclick = viewProjects;
  bindRecentClicks();
}
function openProjectModal(id) {
  const p = id ? state.projects.find((x) => x.id === id) : null;
  modal(`
    <h2>${p ? "Edit Project" : "New Project"}</h2>
    <form id="proj-form" class="form">
      <label>Project Name<input name="name" value="${esc(p?.name || "")}" required></label>
      <label>Project Code<input name="project_code" value="${esc(p?.project_code || "")}" placeholder="auto if blank"></label>
      <div class="form-row">
        <label>Client/Owner<input name="client_name" value="${esc(p?.client_name || "")}"></label>
        <label>Location<input name="location" value="${esc(p?.location || "")}"></label>
      </div>
      <div class="form-row">
        <label>Start Date<input type="date" name="start_date" value="${esc(p?.start_date || "")}"></label>
        <label>Expected Completion<input type="date" name="expected_end_date" value="${esc(p?.expected_end_date || "")}"></label>
      </div>
      <label>Budget (₹)<input type="number" step="0.01" min="0" name="budget" value="${p ? p.budget : ""}" required></label>
      <label>Status<select name="status">
        ${["planning", "active", "completed", "archived"].map((s) => `<option ${p?.status === s ? "selected" : ""}>${s}</option>`).join("")}
      </select></label>
      <label>Description<textarea name="description">${esc(p?.description || "")}</textarea></label>
      <div class="btn-row"><button class="btn btn-primary" type="submit">${p ? "Save" : "Create"}</button><button class="btn btn-ghost" type="button" data-close>Cancel</button></div>
    </form>`);
  el("proj-form").onsubmit = async (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target));
    const cleanNum = (v) => (v === "" || v == null ? 0 : parseFloat(String(v).replace(/,/g, "")));
    fd.budget = cleanNum(fd.budget);
    if (id) await api(`/projects/${id}`, { method: "PATCH", body: JSON.stringify(fd) });
    else await api("/projects", { method: "POST", body: JSON.stringify(fd) });
    closeModal(); toast("Project saved"); await renderProjects();
  };
}
async function deleteProject(id) {
  if (!confirm("Delete this project? (soft delete, recoverable by admin)")) return;
  await api(`/projects/${id}`, { method: "DELETE" });
  toast("Project deleted"); await renderProjects();
}

/* ---------------- Add Transaction ---------------- */
function viewAddTxn(type) {
  setView(`
    <h1>${type === "income" ? "Add Income" : "Add Expense"}</h1>
    <div class="sub">Record money ${type === "income" ? "received" : "spent"} against a project.</div>
    <div class="card" style="max-width:680px;">
      <form id="txn-form" class="form">
        <label>Project<select name="project_id" required>${projectOptions()}</select></label>
        <div class="form-row">
          <label>Date<input type="date" name="date" value="${new Date().toISOString().slice(0,10)}" required></label>
          <label>Amount (₹)<input type="number" step="0.01" min="0.01" name="amount" required></label>
        </div>
        <div class="form-row">
          <label>Category<select name="category">${categoryOptions(type)}</select></label>
          <label>Payment Method<input name="payment_method" placeholder="Cash / UPI / Bank / Cheque"></label>
        </div>
        <label>${type === "income" ? "Source" : "Paid To / Vendor"}<input name="party"></label>
        <label>Subcategory<input name="subcategory"></label>
        <label>Description<textarea name="description"></textarea></label>
        <label>Reference Number<input name="reference_number"></label>
        <label>Notes<textarea name="notes"></textarea></label>
        <label>Receipt (optional)<input type="file" name="receipt" accept="image/*,application/pdf"></label>
        <div class="btn-row"><button class="btn btn-primary" type="submit">Save ${type === "income" ? "Income" : "Expense"}</button><span id="txn-msg" class="error" hidden></span></div>
      </form>
    </div>`);
  el("txn-form").onsubmit = (e) => submitTxn(e, type);
}
async function submitTxn(e, type) {
  e.preventDefault();
  const form = e.target;
  const fd = Object.fromEntries(new FormData(form));
  fd.type = type;
  fd.amount = parseFloat(String(fd.amount).replace(/,/g, ""));
  const _tpid = parseInt(fd.project_id, 10);
  fd.project_id = Number.isInteger(_tpid) ? _tpid : null;
  const msg = el("txn-msg"); msg.hidden = true;
  try {
    const created = await api("/transactions", { method: "POST", body: JSON.stringify(fd) });
    const fileInput = form.querySelector('input[name="receipt"]');
    if (fileInput.files.length) {
      const rf = new FormData();
      rf.append("transaction_id", created.id);
      rf.append("file", fileInput.files[0]);
      await apiForm("/receipts/upload", rf);
    }
    toast("Saved");
    form.reset();
    location.hash = "#transactions"; route();
  } catch (err) {
    msg.textContent = err.message; msg.hidden = false;
  }
}

/* ---------------- Transactions ---------------- */
const txnFilters = {};
async function viewTransactions() {
  txnFilters.from_date = txnFilters.from_date || "";
  setView(`
    <h1>Transactions</h1>
    <div class="sub">Search, filter and inspect every recorded transaction.</div>
    <div class="toolbar">
      <div class="field"><label>Project</label><select id="f-project">${projectOptions(txnFilters.project_id)}</select></div>
      <div class="field"><label>Type</label><select id="f-type"><option value="">All</option><option value="income">Income</option><option value="expense">Expense</option></select></div>
      <div class="field"><label>Category</label><input id="f-category" value="${esc(txnFilters.category || "")}" placeholder="category"></div>
      <div class="field"><label>Party</label><input id="f-party" value="${esc(txnFilters.party || "")}" placeholder="vendor/source"></div>
      <div class="field"><label>From</label><input type="date" id="f-from" value="${esc(txnFilters.from_date || "")}"></div>
      <div class="field"><label>To</label><input type="date" id="f-to" value="${esc(txnFilters.to_date || "")}"></div>
      <div class="field"><label>Receipt</label><select id="f-receipt"><option value="">Any</option><option value="yes">With receipt</option><option value="no">Without</option></select></div>
      <div class="field"><label>Search</label><input id="f-search" value="${esc(txnFilters.search || "")}" placeholder="desc/ref"></div>
      <button class="btn btn-primary" id="f-apply">Apply</button>
      <button class="btn btn-outline" id="f-reset">Reset</button>
    </div>
    <div id="txn-result"></div>
  `);
  el("f-apply").onclick = () => {
    const _fpid = parseInt(el("f-project").value, 10);
    txnFilters.project_id = Number.isInteger(_fpid) ? _fpid : undefined;
    txnFilters.type = el("f-type").value || undefined;
    txnFilters.category = el("f-category").value || undefined;
    txnFilters.party = el("f-party").value || undefined;
    txnFilters.from_date = el("f-from").value || undefined;
    txnFilters.to_date = el("f-to").value || undefined;
    txnFilters.has_receipt = el("f-receipt").value === "yes" ? true : el("f-receipt").value === "no" ? false : undefined;
    txnFilters.search = el("f-search").value || undefined;
    state.txnPage.offset = 0;
    loadTransactions();
  };
  el("f-reset").onclick = () => { Object.keys(txnFilters).forEach((k) => delete txnFilters[k]); viewTransactions(); };
  await loadTransactions();
}
async function loadTransactions() {
  const q = new URLSearchParams();
  Object.entries(txnFilters).forEach(([k, v]) => { if (v !== undefined && v !== "") q.set(k, v); });
  q.set("limit", state.txnPage.limit); q.set("offset", state.txnPage.offset);
  const d = await api("/transactions?" + q.toString());
  const total = d.total, items = d.items;
  el("txn-result").innerHTML = await txnTable(items, false) +
    `<div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;" class="muted">
       <span>${total} transaction(s)</span>
       <div class="btn-row">
         <button class="btn btn-outline btn-sm" id="prev" ${state.txnPage.offset === 0 ? "disabled" : ""}>← Prev</button>
         <button class="btn btn-outline btn-sm" id="next" ${(state.txnPage.offset + state.txnPage.limit) >= total ? "disabled" : ""}>Next →</button>
       </div>
     </div>`;
  bindTxnClicks();
  if (el("prev")) el("prev").onclick = () => { if (state.txnPage.offset >= state.txnPage.limit) { state.txnPage.offset -= state.txnPage.limit; loadTransactions(); } };
  if (el("next")) el("next").onclick = () => { state.txnPage.offset += state.txnPage.limit; loadTransactions(); };
}
async function txnTable(items, compact) {
  if (!items.length) return `<div class="table-wrap"><div class="empty">No transactions found.</div></div>`;
  const rows = items.map((t) => `
    <tr data-id="${t.id}">
      <td data-label="Date">${esc(t.date)}</td>
      <td data-label="Type"><span class="tag ${t.type}">${t.type}</span></td>
      <td data-label="Project">${esc(t.project_name)}</td>
      <td data-label="Description">${esc(t.description || t.party || "—")}</td>
      <td data-label="Category">${esc(t.category_name || "—")}</td>
      <td data-label="Party">${esc(t.party || "—")}</td>
      <td data-label="Amount" class="num">${fmt(t.amount_paise / 100)}</td>
      <td data-label="Method">${esc(t.payment_method || "—")}</td>
      <td data-label="Receipt">${t.has_receipt ? "📎" : "—"}</td>
    </tr>`).join("");
  return `<div class="table-wrap"><table class="mobile-cards">
    <thead><tr><th>Date</th><th>Type</th><th>Project</th><th>Description</th><th>Category</th><th>Party</th><th class="num">Amount</th><th>Method</th><th>Receipt</th></tr></thead>
    <tbody>${rows}</tbody></table></div>`;
}
function bindTxnClicks() {
  $all("tr[data-id]").forEach((r) => r.onclick = () => openTxnModal(+r.dataset.id));
}
function bindRecentClicks() {
  $all("tr[data-id]").forEach((r) => r.onclick = () => openTxnModal(+r.dataset.id));
}
async function openTxnModal(id) {
  const t = await api(`/transactions/${id}`);
  const receiptHtml = t.has_receipt
    ? `<a class="link" href="${API_BASE ? API_BASE : ''}/receipts/${t.receipt_id}" target="_blank">View receipt</a>`
    : `<span class="muted">None</span>`;
  modal(`
    <h2>Transaction #${t.id}</h2>
    <div class="detail-grid">
      <div class="k">Project</div><div>${esc(t.project_name)}</div>
      <div class="k">Type</div><div><span class="tag ${t.type}">${t.type}</span></div>
      <div class="k">Amount</div><div>${fmt(t.amount_paise / 100)}</div>
      <div class="k">Date</div><div>${esc(t.date)}</div>
      <div class="k">Category</div><div>${esc(t.category_name || "—")}</div>
      <div class="k">${t.type === "income" ? "Source" : "Vendor"}</div><div>${esc(t.party || "—")}</div>
      <div class="k">Payment</div><div>${esc(t.payment_method || "—")}</div>
      <div class="k">Reference</div><div>${esc(t.reference_number || "—")}</div>
      <div class="k">Description</div><div>${esc(t.description || "—")}</div>
      <div class="k">Notes</div><div>${esc(t.notes || "—")}</div>
      <div class="k">Receipt</div><div>${receiptHtml}</div>
      <div class="k">Recorded by</div><div>${esc(t.recorded_by || "—")}</div>
      <div class="k">Created</div><div>${esc(t.created_at)}</div>
      <div class="k">Updated</div><div>${esc(t.updated_at)}</div>
    </div>
    <div class="btn-row" style="margin-top:18px;">
      <button class="btn btn-outline" id="edit-txn">Edit</button>
      <button class="btn btn-danger" id="del-txn">Delete</button>
      <button class="btn btn-ghost" data-close>Close</button>
    </div>
  `);
  el("edit-txn").onclick = () => openTxnEdit(t);
  el("del-txn").onclick = async () => {
    if (!confirm("Delete this transaction? (soft delete)")) return;
    await api(`/transactions/${id}`, { method: "DELETE" });
    closeModal(); toast("Deleted"); route();
  };
}
function openTxnEdit(t) {
  const kind = t.type;
  modal(`
    <h2>Edit Transaction #${t.id}</h2>
    <form id="edit-form" class="form">
      <div class="form-row">
        <label>Type<select name="type"><option ${t.type==="income"?"selected":""}>income</option><option ${t.type==="expense"?"selected":""}>expense</option></select></label>
        <label>Date<input type="date" name="date" value="${esc(t.date)}" required></label>
      </div>
      <label>Amount (₹)<input type="number" step="0.01" min="0.01" name="amount" value="${t.amount_paise/100}" required></label>
      <div class="form-row">
        <label>Category<select name="category">${categoryOptions(kind, t.category_name)}</select></label>
        <label>Payment Method<input name="payment_method" value="${esc(t.payment_method||"")}"></label>
      </div>
      <label>Party<input name="party" value="${esc(t.party||"")}"></label>
      <label>Description<textarea name="description">${esc(t.description||"")}</textarea></label>
      <label>Reference<input name="reference_number" value="${esc(t.reference_number||"")}"></label>
      <div class="btn-row"><button class="btn btn-primary" type="submit">Save</button><button class="btn btn-ghost" type="button" data-close>Cancel</button></div>
    </form>`);
  el("edit-form").onsubmit = async (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target));
    fd.amount = parseFloat(String(fd.amount).replace(/,/g, ""));
    await api(`/transactions/${t.id}`, { method: "PATCH", body: JSON.stringify(fd) });
    closeModal(); toast("Updated"); route();
  };
}

/* ---------------- Reports ---------------- */
const reportFilters = {};
async function viewReports() {
  setView(`
    <h1>Reports</h1>
    <div class="sub">Generate filtered reports and export to Excel (.xlsx).</div>
    <div class="card" style="margin-bottom:18px;">
      <div class="toolbar">
        <div class="field"><label>Project</label><select id="r-project">${projectOptions()}</select></div>
        <div class="field"><label>Type</label><select id="r-type"><option value="">All</option><option value="income">Income</option><option value="expense">Expense</option></select></div>
        <div class="field"><label>Category</label><input id="r-category" placeholder="category"></div>
        <div class="field"><label>Party</label><input id="r-party" placeholder="vendor/source"></div>
        <div class="field"><label>From</label><input type="date" id="r-from"></div>
        <div class="field"><label>To</label><input type="date" id="r-to"></div>
        <button class="btn btn-primary" id="r-gen">Generate</button>
        <button class="btn btn-outline" id="r-xlsx">Export Excel</button>
      </div>
    </div>
    <div id="r-result"></div>
  `);
  el("r-gen").onclick = generateReport;
  el("r-xlsx").onclick = exportExcel;
  await generateReport();
}
async function buildReportQuery() {
  const q = {};
  const _rpid = parseInt(el("r-project").value, 10);
  q.project_id = Number.isInteger(_rpid) ? _rpid : undefined;
  q.type = el("r-type").value || undefined;
  q.category = el("r-category").value || undefined;
  q.party = el("r-party").value || undefined;
  q.from_date = el("r-from").value || undefined;
  q.to_date = el("r-to").value || undefined;
  return q;
}
async function generateReport() {
  const q = await buildReportQuery();
  const d = await api("/reports?" + new URLSearchParams(Object.entries(q).filter(([,v])=>v!==undefined&&v!=="").map(([k,v])=>[k,v])).toString());
  const s = d.summary;
  el("r-result").innerHTML = `
    <div class="grid kpi-grid" style="margin-bottom:16px;">
      ${kpi("Budget", fmt(s.budget_paise/100), s.scope)}
      ${kpi("Income", fmt(s.income_paise/100), "", "income")}
      ${kpi("Expense", fmt(s.expense_paise/100), "", "expense")}
      ${kpi("Cash Balance", fmt(s.cash_balance_paise/100), "")}
      ${kpi("Remaining Budget", fmt(s.remaining_budget_paise/100), "")}
    </div>
    <div class="section grid" style="grid-template-columns:1fr 1fr;align-items:start;">
      <div class="card"><div class="section-title">Expense Summary</div>${catTable(d.expense_by_category)}</div>
      <div class="card"><div class="section-title">Income Summary</div>${catTable(d.income_by_category)}</div>
    </div>
    <div class="section"><div class="section-title">Transactions (${d.total})</div>${await txnTable(d.transactions, true)}</div>`;
  bindRecentClicks();
}
function catTable(list) {
  if (!list.length) return `<div class="empty">No data.</div>`;
  return `<div class="table-wrap"><table><thead><tr><th>Category</th><th class="num">Total</th><th class="num">%</th></tr></thead><tbody>
    ${list.map((x)=>`<tr><td>${esc(x.category)}</td><td class="num">${fmt(x.total_paise/100)}</td><td class="num">${x.pct}%</td></tr>`).join("")}
  </tbody></table></div>`;
}
async function exportExcel() {
  const q = await buildReportQuery();
  const params = new URLSearchParams(Object.entries(q).filter(([,v])=>v!==undefined&&v!=="").map(([k,v])=>[k,v])).toString();
  const res = await fetch(API_BASE + "/reports/export?" + params, { credentials: "same-origin", method: "POST", headers: {"Content-Type":"application/json", "Authorization": "Bearer " + state.token}, body: JSON.stringify(q) });
  if (!res.ok) { toast("Export failed", true); return; }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "platio_report.xlsx"; a.click();
  URL.revokeObjectURL(url);
  toast("Excel exported");
}

/* ---------------- Settings ---------------- */
async function viewSettings() {
  setView(`<h1>Settings</h1><div class="sub">Manage configurable categories.</div>
    <div class="grid" style="grid-template-columns:1fr 1fr;align-items:start;">
      <div class="card">
        <div class="section-title">Expense Categories</div>
        <div class="btn-row" style="margin-bottom:12px;"><input id="new-exp" placeholder="New expense category"><button class="btn btn-primary btn-sm" id="add-exp">Add</button></div>
        <div id="exp-list"></div>
      </div>
      <div class="card">
        <div class="section-title">Income Categories</div>
        <div class="btn-row" style="margin-bottom:12px;"><input id="new-inc" placeholder="New income category"><button class="btn btn-primary btn-sm" id="add-inc">Add</button></div>
        <div id="inc-list"></div>
      </div>
    </div>`);
  el("add-exp").onclick = () => addCategory("expense", el("new-exp").value);
  el("add-inc").onclick = () => addCategory("income", el("new-inc").value);
  await renderCategories();
}
async function renderCategories() {
  const [ce, ci] = await Promise.all([api("/categories?kind=expense"), api("/categories?kind=income")]);
  state.categories.expense = ce; state.categories.income = ci;
  const render = (list, kind) => list.map((c) => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--line);">
      <span>${esc(c.name)} ${c.is_active ? "" : '<span class="pill">disabled</span>'}</span>
      <button class="btn btn-outline btn-sm" data-toggle="${c.id}" data-active="${c.is_active}" data-kind="${kind}">${c.is_active ? "Disable" : "Enable"}</button>
    </div>`).join("");
  el("exp-list").innerHTML = render(ce, "expense") || `<div class="empty">None</div>`;
  el("inc-list").innerHTML = render(ci, "income") || `<div class="empty">None</div>`;
  $all("[data-toggle]").forEach((b) => b.onclick = async () => {
    await api(`/categories/${b.dataset.toggle}`, { method: "PATCH", body: JSON.stringify({ active: b.dataset.active !== "1" }) });
    await renderCategories();
  });
}
async function addCategory(kind, name) {
  name = (name || "").trim();
  if (!name) return;
  await api(`/categories?kind=${kind}&name=${encodeURIComponent(name)}`, { method: "POST" });
  toast("Category added"); await renderCategories();
}

/* ---------------- Modal ---------------- */
function modal(html) {
  closeModal();
  const back = document.createElement("div");
  back.className = "modal-backdrop";
  back.id = "modal-back";
  back.innerHTML = `<div class="modal">${html}</div>`;
  back.onclick = (e) => { if (e.target === back || e.target.dataset.close !== undefined) closeModal(); };
  document.body.appendChild(back);
}
function closeModal() { const m = el("modal-back"); if (m) m.remove(); }

/* ---------------- Boot ---------------- */
checkAuth();
