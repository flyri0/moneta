# Moneta v1 — Design Spec

**Date:** 2026-09-19
**Status:** Approved design, pending implementation plan

## 1. Summary

Moneta is a zero-based envelope budgeting app inspired by YNAB and Actual Budget. It is local-only: no backend, no accounts, no analytics. It ships as an installable, fully offline PWA and stores each budget in a SQLite database (SQLite WASM on OPFS) inside the browser.

### v1 scope

- Zero-based monthly budget: Ready to Assign, per-category assigned / activity / available, monthly rollover.
- Per-category overspending rollover toggle.
- Accounts: on-budget and off-budget (tracking); credit cards with automatic payment categories; split transactions; transfers; cleared/uncleared flag.
- Manual transaction entry, optimized for phones.
- Quick-assign: same as last month, average spent (3/6/12 months), cover overspending, clear.
- Basic reports: spending by category, net worth over time.
- Multiple budget files, one currency per budget.
- Backup: export/restore `.sqlite`, export CSV (transactions) and JSON (whole budget), backup reminders.
- UI in English and Brazilian Portuguese (i18n from day one).

### Out of scope (future)

File import (CSV/OFX/QIF), scheduled transactions, payee rules, category targets, undo/redo, reconciliation beyond the cleared flag, multi-currency, cloud backup (OneDrive, Google Drive — the `BackupTarget` interface is designed for it).

## 2. Architecture

### Stack

- SvelteKit + TypeScript (strict), `adapter-static`, SSR disabled (pure SPA).
- shadcn-svelte for UI components; LayerChart for reports.
- `@vite-pwa/sveltekit` for service worker and manifest.
- `@sqlite.org/sqlite-wasm` using the **OPFS SAH-pool VFS** in a dedicated Web Worker. This VFS does not require COOP/COEP headers, so any static host works.
- Paraglide-js for i18n (compiled, typed messages).
- pnpm, ESLint, Prettier, svelte-check, Vitest, Playwright.

### Project layout

```
src/
  lib/
    db/                    # runs only inside the Worker
      worker.ts            # opens SQLite (OPFS SAH-pool), dispatches RPC
      system.ts            # budget files: open + migrate, pre-migration copies, export/import
      backup.ts            # restore validation (§6)
      migrations/          # 0001_init.sql, ... ; tracked via PRAGMA user_version
      repos/               # accounts.ts, categories.ts, transactions.ts, budget.ts, reports.ts, payees.ts, dump.ts
      aggregates.sql.ts    # SQL aggregation queries feeding the budget engine
    client/                # main thread
      rpc.ts               # typed proxy: await api.transactions.create({...})
      live.ts              # liveQuery(tables, fn) -> Svelte store, re-runs on table changes
      tab-lock.ts          # Web Locks owner election; "open in another tab" screen
    domain/                # pure TS, no DB/DOM: fully unit-testable
      money.ts             # integer minor units; Intl.NumberFormat(locale, {currency})
      month.ts             # 'YYYY-MM' helpers
      budget-engine.ts     # rollover, overspending, credit card funding, Ready to Assign
      quick-assign.ts
    backup/
      target.ts            # BackupTarget { save(fileName, blob) }; cloud targets would add listing and loading
      file-target.ts       # v1: downloads (a restore reads a file the user picks)
      export-csv.ts
      actions.ts           # back up (.sqlite), export CSV and JSON (the JSON is dumped by repos/dump.ts)
      reminder.ts
    reports/               # date-range presets, spending shares
    i18n/                  # messages/en.json, messages/pt-BR.json
    components/ui/         # shadcn-svelte
  routes/
    +layout.svelte         # nav (bottom on mobile, sidebar on desktop), budget switcher
    budget/[month]/        # onboarding has no route: the root Boot component renders it
                            # in place of the app shell when no budget exists yet
    accounts/
    accounts/[id]/
    reports/
    settings/
static/                    # manifest icons (incl. maskable)
```

### Key decisions

- **One budget = one SQLite file** in OPFS (`budget-<uuid>.sqlite3`). A small registry in localStorage lists budgets and the last one opened. It is a cache: if it is lost, it is rebuilt from the worker's file list and each file's `meta` name. Switching budgets closes and reopens the DB in the worker.
- **The database lives only in the worker.** The main thread never runs SQL. All access goes through async typed RPC over `postMessage`. Multi-statement writes (e.g. a transaction plus its splits, or both legs of a transfer) run in one SQL transaction within a single RPC call.
- **Single-tab ownership.** The SAH-pool VFS allows one connection. `navigator.locks` elects one owner tab. Other tabs show "Moneta is open in another tab", with a button to take over: the waiting tab queues for the Web Lock, then asks over a `BroadcastChannel`; the owner closes the DB, pauses the SAH pool, terminates its worker, and releases the lock, letting the waiting tab's request resolve.
- **Reactivity.** Every write RPC returns the set of tables it changed. Change notifications go to the owning tab's RPC client only (one tab owns the DB); `liveQuery` stores subscribed to any of those tables re-query. Coarse, and fast enough at personal-finance scale.
- **Only facts are stored.** Balances, activity, available, and Ready to Assign are always derived: SQL computes per-category per-month aggregates and card-spending lists, and the pure TS `budget-engine` does the month-to-month rollover. No cached balances means nothing can drift.
- **Persistence.** On first run, call `navigator.storage.persist()`. Settings shows whether it was granted.

## 3. Data model

Conventions: amounts are `INTEGER` minor units (negative = outflow). IDs are `TEXT` UUIDv7. Dates are `TEXT 'YYYY-MM-DD'`; months are `TEXT 'YYYY-MM'`. Booleans are `INTEGER 0/1`. Foreign keys enabled.

```sql
meta(key TEXT PRIMARY KEY, value TEXT)
  -- name, currency (ISO 4217, e.g. 'BRL'), locale (e.g. 'pt-BR'), created_at, last_backup_at

accounts(
  id, name,
  type TEXT,            -- checking | savings | cash | credit_card | investment | loan | other
  on_budget INTEGER, closed INTEGER, sort_order INTEGER, created_at)

category_groups(
  id, name, sort_order, hidden INTEGER,
  system TEXT NULL)     -- 'income' | 'credit_card_payments' | NULL

categories(
  id, group_id REFERENCES category_groups, name, sort_order, hidden INTEGER,
  carryover_overspending INTEGER DEFAULT 0,
  cc_account_id TEXT NULL REFERENCES accounts,   -- set for a card's payment category, named after the card
  system TEXT NULL)                              -- 'ready_to_assign' | NULL

payees(id, name UNIQUE)

transactions(
  id, account_id REFERENCES accounts, date, amount,
  payee_id NULL REFERENCES payees,
  category_id NULL REFERENCES categories,
  memo TEXT, cleared INTEGER,
  transfer_id NULL,     -- id of the paired transaction in the other account
  is_split INTEGER)

transaction_splits(
  id, transaction_id REFERENCES transactions ON DELETE CASCADE,
  category_id REFERENCES categories, amount, memo)

budget_assignments(
  category_id REFERENCES categories, month, assigned,
  PRIMARY KEY (category_id, month))
```

Indexes: `transactions(account_id, date)`, `transactions(category_id, date)`, `transactions(date)`, `transaction_splits(category_id)`, `transaction_splits(transaction_id)`.

### Invariants (enforced in repos; triggers where cheap)

1. **Income** is a transaction categorized to the system `Ready to Assign` category. Ready to Assign can't be used on credit card accounts (`CATEGORY_NOT_ALLOWED`): income on a card would pay down debt without adding cash, so record it in a cash account and pay the card.
2. **Starting balances** are transactions: for on-budget non-credit accounts, categorized to Ready to Assign; for credit cards, uncategorized (existing debt); for off-budget accounts, uncategorized.
3. **Splits:** if `is_split = 1`, `category_id` is NULL and the split amounts sum exactly to `amount`. Checked in the same SQL transaction; otherwise `SPLIT_SUM_MISMATCH`.
4. **Transfers** are always two linked transactions (`transfer_id` pointing at each other, opposite amounts, same date), created, edited, and deleted together.
   - on-budget ↔ on-budget, or off-budget ↔ off-budget: no category (budget-neutral).
   - on-budget → off-budget: the on-budget leg requires a category.
   - off-budget → on-budget: the on-budget leg is categorized (Ready to Assign or another category).
5. **Off-budget account transactions** never carry categories (except as the counterpart of rule 4, where only the on-budget leg is categorized). They are excluded from budget math and count only toward net worth.
6. **Credit card accounts:** creating one automatically creates a payment category, named after the card, in the system `Credit Card Payments` group (shown in the UI as "Credit Card Payments"). Closing the card hides the category, so closing also requires the category's available to be 0 (`CC_PAYMENT_NOT_EMPTY`). An account (any type) can be deleted only when it has no transactions; otherwise it can be closed, and closing requires a zero balance.
7. **System categories and groups** cannot be deleted or renamed by the user (CC Payment categories follow their card's name).
8. **Deletes are hard deletes.** Backups are the safety net.

## 4. Budget math

SQL aggregates, per category and month: assigned, activity split into cash activity (non-credit on-budget accounts) and credit activity (credit card accounts), plus the ordered list of card transactions per category and month. The pure TS `budget-engine` then walks months in order.

### Per category C, month M

```
carryover(C, M) = available(C, M-1)   if available(C, M-1) > 0
                = available(C, M-1)   if < 0 and C.carryover_overspending = 1
                = 0                   otherwise
available(C, M) = carryover(C, M) + assigned(C, M) + activity(C, M)
activity(C, M)  = Σ transactions and splits categorized to C dated in M (on-budget accounts only)
```

### Overspending at the end of month M (available < 0, toggle off)

- **Cash overspending**, meaning the part caused by spending from non-credit accounts: subtracted from Ready to Assign in M+1. The category resets to 0.
- **Credit overspending**, meaning card spending not covered by budgeted money: becomes card debt. It is not subtracted from Ready to Assign, and not moved into the CC Payment category, so the card appears underfunded. The category resets to 0.
- Attribution when both kinds exist: go through the month's transactions in date order (ties broken by creation order) with a running available balance. Uncovered cash outflows count as cash overspending, and uncovered card outflows as credit overspending.
- **Toggle on:** the negative available carries into M+1 unchanged. No Ready to Assign deduction, and no card funding for the uncovered part.

### Credit card funding

Within month M, for each non-CC category C, go through C's transactions in date order with a running available balance, starting from `carryover + assigned`. Each card outflow moves `min(outflow, max(0, running_available))` into that card's `CC Payment` category, which is the portion covered by budgeted money. Card inflows categorized to C (returns, refunds) move the same amount back out of the CC Payment category. Uncategorized card spending is debt with no budget effect. Payments to the card are transfers from on-budget accounts. The card leg is budget-neutral; the payment shows as negative activity on the card's CC Payment category.

### Ready to Assign (Actual-style, per month)

```
RTA(M) = Σ inflows to Ready to Assign dated in months ≤ M
       − Σ assigned in months ≤ M
       − Σ cash overspending from months < M
```

Assigning in a future month does not reduce the current month's RTA. If any month after M would have a negative RTA, the budget screen shows a warning banner naming the month. The budget header shows the breakdown: funds available, overspent last month, assigned this month, RTA.

### Quick-assign

Per category or per group: *same as last month*, *average spent over the last 3/6/12 months*, *cover overspending* (set assigned so available = 0), *clear*. Each action writes `budget_assignments` in one SQL transaction.

## 5. Screens & UX

Mobile-first. Below 768px: bottom nav (Budget · Accounts · Reports · Settings) and a floating **+ Transaction** button. Desktop: sidebar with accounts and their balances. Light/dark theme, following the system by default.

### Budget — `/budget/[month]`

- Header: month picker (‹ Sep 2026 ›), Ready to Assign card that expands to the breakdown, future-month warning banner.
- Grid of groups and categories with columns **Assigned** (inline edit; accepts arithmetic like `120+35`), **Activity**, **Available**.
- Available pill: green when positive, yellow when covered by credit (card underfunded), red when overspent.
- Mobile: the Assigned column is hidden. Tapping a category opens a sheet to assign, move money to or from another category, or open quick-assign.
- Group rows show subtotals. Reorder by drag on desktop and via an "edit order" mode on mobile. The Credit Card Payments group always comes first and can't be moved. Hidden categories go in a collapsible section.
- Category settings (sheet): rename, move group, hide, overspending rollover toggle.

### Accounts — `/accounts` and register `/accounts/[id]`

- Accounts listed in On-budget, Off-budget and Closed sections, each with its balance.
- The register shows date, payee, category, memo, amount and a cleared toggle, plus cleared, uncleared and total balances.
- Text search and date-range filter. The register loads 100 rows at a time ("Load more"), and rows use CSS `content-visibility: auto` instead of a virtualization library.
- Split rows expand to show their parts. Transfers store no payee: a transfer row shows "Transfer to/from ‹account›" and links to that account.

### Transaction form (sheet on mobile, dialog on desktop)

- Fields: account, date (defaults to today), payee, category, amount with an outflow/inflow toggle (numeric keypad on mobile), memo, cleared.
- Payee field: a native `<input list>` with a `<datalist>` of existing payees and transfer targets (create-on-type). Selecting an existing payee suggests the category from that payee's most recent transaction.
- Payee can be set to "Transfer to/from ‹account›", which makes the transaction a transfer. The category field is shown only when rule 4 requires one.
- "Split" button adds split lines and shows a live "remaining" amount. Save is disabled until the splits balance.

### Reports — `/reports`

- **Spending by category** for a date range: bar chart plus table, drilling down into the transactions. Spending is net outflow per category on on-budget accounts (refunds count against it); Ready to Assign is left out, and so are categories whose refunds outweigh their spending. The range picker offers this month, last month, the last 3 or 12 months, this year, or custom dates.
- **Net worth over time:** month-end totals across all accounts (on- and off-budget, closed included), split into assets and debts: each account counts as an asset or a debt by the sign of its balance. The last 12 months or all time.

### Settings — `/settings`

- **Budget files:** create, switch, delete (with a confirm step). Deleting the open budget opens the next one, or onboarding when none is left.
- **Budget details:** name, currency and locale for the open budget (renaming happens here). Once the budget has transactions or assignments, the currency can only change to one with the same number of decimal places (`CURRENCY_LOCKED`).
- **App:** UI language (en / pt-BR), theme.
- **Backup:**
  - Export `.sqlite`.
  - Restore `.sqlite`: replace the current budget (with a confirm step) or import it as a new budget. Either way the backup becomes a new budget file; replacing deletes the old file only once the restored budget is open.
  - Export transactions as CSV and the full budget as JSON. These are exports, not backups: they can't be restored, and they don't count as a backup.
    - CSV: English headers `Date,Account,Payee,Transfer,Category,Memo,Amount,Cleared`, ISO dates, plain decimal amounts with a dot, one row per split line, UTF-8 with a byte-order mark, and text cells that start like a formula prefixed with `'`.
    - JSON: `{ format: 'moneta-budget', schemaVersion, exportedAt, meta, tables }`, with every table's rows under their SQL column names.
  - Shows the last backup date. When the app opens 14 days or more after the last `.sqlite` backup (or after the budget was created, if there was none), a reminder toast offers to back up.
- **Storage:** whether persistence was granted, and space used.

### Onboarding — first run

Name the budget, pick the currency and locale, create the first account with its starting balance, and seed a default, translated category set that can be edited. Loan and investment accounts default to off-budget, here and when adding accounts later.

## 6. Error handling

- RPC results are `{ ok: true, data, changed: string[] }` or `{ ok: false, error: { code, message, details? } }`.
- **Domain errors** have typed codes (`SPLIT_SUM_MISMATCH`, `ACCOUNT_HAS_TRANSACTIONS`, `ACCOUNT_BALANCE_NOT_ZERO`, `CC_PAYMENT_NOT_EMPTY`, `CATEGORY_REQUIRED`, `SYSTEM_ENTITY_READONLY`, ...), are mapped to i18n messages, and appear inline on forms.
- **Unexpected errors:** a toast with "copy details". A worker-level global handler reports errors to the client, which offers "Reload".
- **Startup failures** each get a clear full-screen message: OPFS unavailable (e.g. Firefox private mode, old Safari), storage quota exceeded, DB locked by another tab, DB schema newer than the app.
- **Restore validation**, in order:
  1. SQLite file header.
  2. `PRAGMA integrity_check` passes.
  3. The `meta` table exists.
  4. `user_version` ≤ app schema version; older files are migrated.
  Only after all checks pass is the current file replaced. The checks run on an in-memory copy, and fail with `BACKUP_NOT_SQLITE`, `BACKUP_DAMAGED`, `BACKUP_NOT_MONETA` or `SCHEMA_TOO_NEW`.

## 7. Migrations

- Ordered SQL files, applied when a DB is opened, inside a transaction, with `PRAGMA user_version` tracking the version. Foreign keys are off while migrating, so a migration can rebuild a table without cascading deletes; each migration must leave `PRAGMA foreign_key_check` clean.
- Before migrating, a timestamped `.sqlite` copy is saved in OPFS (`premigration-<budget file>-<timestamp>.sqlite3`); the last 3 per budget are kept, and they are deleted with their budget. The OPFS pool grows as needed before any file is created.

## 8. PWA lifecycle

- Everything is precached; the app works fully offline after the first load.
- Prompt-to-update: a "New version available · Reload" toast. Reloading waits for in-flight RPCs, closes the DB cleanly, then activates the new service worker.
- Manifest with standard and maskable icons (generated from `static/icon.svg`). Install works on Android, desktop Chrome/Edge, and iOS (Add to Home Screen).
- The service worker lives at the site root, so the app must be served from a domain root. `pnpm preview` and the e2e tests serve `build/` with a plain static server, as a host would.

## 9. Testing

Built test-first (TDD).

- **Unit (Vitest):** `domain/` (money, months, budget engine, quick-assign) gets thorough, table-driven coverage:
  - rollover, with the toggle on and off
  - cash vs. credit overspending, and mixed attribution
  - partial card funding, refunds, card payments
  - future-month assignments and the negative-RTA warning
- **Integration (Vitest, Node):** repos plus migrations against real in-memory SQLite WASM:
  - split and transfer invariants
  - CC category lifecycle
  - quick-assign writes
  - export/restore round-trip and restore validation
- **E2E (Playwright, Chromium):**
  - onboarding → add income → assign → spend → card purchase → card payment → budget numbers correct
  - export then restore
  - offline after reload
  - second tab blocked
