// End-to-end smoke test of the no-server data layer in MOCK mode.
// Verifies: project creation, transaction math, dashboard aggregation,
// category breakdown, audit, and delete. Runs in Node (no browser, no Google).
// Expects to be run with: node --experimental-strip-types scripts/smoke.ts
import { MockStore } from '../src/lib/mockStore.ts'
import { buildDashboard } from '../src/lib/finance.ts'
import { toPaise } from '../src/lib/money.ts'

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error('FAIL:', msg)
    process.exit(1)
  }
  console.log('  ok:', msg)
}

async function main() {
  const store = new MockStore()
  await store.ensureSchema()

  // 1) Project with budget 10,00,000 INR
  const proj = await store.createProject({
    name: 'Riverside Tower',
    client_name: 'Acme',
    location: 'Guwahati',
    description: '',
    start_date: '2026-09-01',
    expected_completion_date: '2027-03-01',
    budget_paise: toPaise('1000000'),
    status: 'active',
  })
  assert(!!proj.id && proj.id.startsWith('proj_'), 'project created with id')

  // 2) Income + expenses
  await store.createTransaction({
    project_id: proj.id, type: 'income', amount_paise: toPaise('400000'),
    date: '2026-09-05', category_id: 'cat_income_2', subcategory_id: '',
    party: 'Acme', payment_method: 'bank', description: 'Milestone 1', reference_number: '', receipt_key: '',
  })
  await store.createTransaction({
    project_id: proj.id, type: 'expense', amount_paise: toPaise('150000'),
    date: '2026-09-10', category_id: 'cat_expense_1', subcategory_id: '',
    party: 'Supplier X', payment_method: 'cash', description: 'Cement', reference_number: '', receipt_key: '',
  })
  await store.createTransaction({
    project_id: proj.id, type: 'expense', amount_paise: toPaise('50000'),
    date: '2026-09-12', category_id: 'cat_expense_2', subcategory_id: '',
    party: 'Crew', payment_method: 'cash', description: 'Labour', reference_number: '', receipt_key: '',
  })

  // 3) Dashboard math
  const projects = await store.listProjects()
  const txns = await store.listTransactions()
  const cats = await store.listCategories()
  const dash = buildDashboard(projects, txns, cats)
  const t = dash.totalsByProject[proj.id]
  assert(t.income === toPaise('400000'), `income sums to ₹4,00,000 (got ${t.income})`)
  assert(t.expense === toPaise('200000'), `expense sums to ₹2,00,000 (got ${t.expense})`)
  assert(t.net === toPaise('200000'), `net = income - expense (got ${t.net})`)
  assert(t.utilisation === 0.2, `utilisation = 2,00,000 / 10,00,000 = 0.2 (got ${t.utilisation})`)
  assert(t.budget_exceeded === false, 'budget not exceeded at 20%')

  // 4) Category breakdown
  assert(dash.breakdown[0].name === 'Materials' && dash.breakdown[0].total === toPaise('150000'),
    'top expense category is Materials @ ₹1,50,000')

  // 5) Audit trail
  const audit = await store.listAudit()
  assert(audit.length >= 4, `audit recorded create project + 3 txns (got ${audit.length})`)

  // 6) Delete (soft) — keeps the row, marks deleted, so the list count is preserved.
  const before = (await store.listTransactions()).length
  await store.deleteTransaction(txns[0].id)
  const after = await store.listTransactions()
  assert(after.length === before, 'delete is soft (row count preserved)')
  const deleted = after.find((t) => t.id === txns[0].id)
  assert(deleted?.amount_paise === 0, 'soft-deleted txn amount zeroed')

  console.log('\nALL SMOKE TESTS PASSED ✓')
}

main().catch((e) => {
  console.error('SMOKE TEST ERROR:', e)
  process.exit(1)
})
