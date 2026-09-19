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

## Plan 3 (reports, backup, PWA)

- **Pre-migration backup (spec §7), and SAH pool capacity:** call `reserveMinimumCapacity` before creating backup copies, since the initial capacity is 12. This must land before any `0002_*.sql` migration.
- **Migrations that rebuild tables** need `PRAGMA foreign_keys = OFF` outside the transaction. The current `migrate` loop can't do that.
- **Performance:** measure the budget recompute. Every read reloads all history; that's fine at MVP scale.
- ~~**Dev smoke route**~~: done in Plan 2. The route and its test were removed; the app's own e2e tests cover the worker, OPFS persistence and RPC.
- **Budget files UI:** the registry (`src/lib/client/registry.ts`) and `createBudget` (`src/lib/client/session.ts`) are ready for Settings → Budget files. Switching budgets means closing the worker's database, opening the other file, and replacing `AppState.session` (the shell is keyed on the file).

## Accepted as-is

- The carryover-overspending toggle isn't time-scoped. Flipping it recomputes past months.
