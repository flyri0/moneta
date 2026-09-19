# Moneta Plan 1: Follow-ups for Plans 2 and 3

Plan 1 (headless core) is complete: 142 unit tests and 1 browser e2e test. Its reviews deferred the items below to the plans whose UI or infrastructure exposes them.

## Plan 2 (app UI): done

Plan 2 (`2026-09-19-moneta-plan-2-app-ui.md`) resolved every item:

- **Month range:** `isMonth` accepts only the years 1900–2199, like `isDate`.
- **Amount parsing:** `parseAmount` rejects mixed or misplaced separators, more decimals than the currency has, and any letters except the budget currency's own symbol or code.
- **RPC failure paths:** arguments are sent as `$state.snapshot` copies; a message that can't be sent rejects with `INTERNAL`; worker `error`/`messageerror` rejects every pending and later call with `WORKER_FAILED` and shows a full-screen "Reload".
- **Closing a credit card** also requires its payment category's available to be 0 (`CC_PAYMENT_NOT_EMPTY`).
- **Spec decisions** (now recorded in the spec):
  - Ready to Assign can't be used on credit card accounts (`CATEGORY_NOT_ALLOWED`).
  - Loan and investment accounts default to off-budget.
  - Transfers show as "Transfer to/from ‹account›" in the register, and as "Transfer: ‹account›" in the payee field.
  - The system groups keep their place (Income, then Credit Card Payments) whatever order is saved.

## Plan 3 (reports, backup, PWA): done

Plan 3 (`2026-09-19-moneta-plan-3-reports-backup-pwa.md`) resolved every item:

- **Pre-migration backup (spec §7), and SAH pool capacity:** opening a budget whose schema is older saves a `premigration-…` copy first and keeps the last 3. The pool reserves room (`reserveMinimumCapacity`) before any file is created.
- **Migrations that rebuild tables:** `migrate` turns foreign keys off around the loop and checks `PRAGMA foreign_key_check` before each commit.
- **Performance:** `pnpm bench` measures the recompute on a heavy budget (5 years, 40 categories, about 9,000 transactions): about 105 ms per `budget.month` read, of which about 85 ms is loading the rows from SQL and about 10 ms is the engine. That's acceptable for v1. If it becomes a problem, trim what `loadEngineInput` reads before touching the engine.
- ~~**Dev smoke route**~~: done in Plan 2. The route and its test were removed; the app's own e2e tests cover the worker, OPFS persistence and RPC.
- **Budget files UI:** Settings → Budget files creates, switches and deletes budgets; Budget details renames the open one. `AppState.show` replaces the session, and the shell remounts.

## Accepted as-is

- The carryover-overspending toggle isn't time-scoped. Flipping it recomputes past months.
