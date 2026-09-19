# Moneta Plan 1: Follow-ups for Plans 2 and 3

Plan 1 (headless core) is complete: 142 unit tests and 1 browser e2e test. Its reviews deferred the items below to the plans whose UI or infrastructure exposes them. Each plan should include them.

## Plan 2 (app UI)

- **Month range:** `isMonth` (`src/lib/domain/month.ts`) accepts any year. Clamp it to 1900–2199 like `isDate`, because a month such as `9999-01` makes the engine walk ~95k months.
- **Amount parsing:** `parseAmount` accepts inconsistent separators (`"1.234,567"` → 1234567) and silently strips letters (`"1e5"` → 15, `"12a3"` → 123). Reject both before wiring amount inputs.
- **RPC failure paths:**
  - If `postMessage` throws synchronously, as it does with a `DataCloneError`, the pending call hangs. Wrap it and reject.
  - Pass `$state.snapshot(...)` for Svelte 5 state proxies.
  - Add worker `error`/`messageerror` handling so pending calls reject if the worker dies (spec §6).
- **Closing a credit card:** also require its CC Payment category's available to be 0. Otherwise money can sit in a hidden category.
- **Spec decisions to make:**
  - RTA income on a card makes the CC Payment category negative, which shows up as cash overspending the next month. Money is conserved; the UX needs a ruling.
  - Default loan and investment accounts to off-budget in onboarding. On-budget starting balances count as Ready to Assign income.
  - How a transfer's payee is shown in the register (transfers store no payee).
  - Whether system groups (Income, Credit Card Payments) are pinned in drag-and-drop ordering. Today they can be reordered.

## Plan 3 (reports, backup, PWA)

- **Pre-migration backup (spec §7), and SAH pool capacity:** call `reserveMinimumCapacity` before creating backup copies, since the initial capacity is 12. This must land before any `0002_*.sql` migration.
- **Migrations that rebuild tables** need `PRAGMA foreign_keys = OFF` outside the transaction. The current `migrate` loop can't do that.
- **Dev smoke route:** gate or exclude `src/routes/dev/db-smoke/` from production builds. It creates `smoke.sqlite3` in OPFS, which `listFiles` would show as a budget.
- **Performance:** measure the budget recompute. Every read reloads all history; that's fine at MVP scale.

## Accepted as-is

- The carryover-overspending toggle isn't time-scoped. Flipping it recomputes past months.
