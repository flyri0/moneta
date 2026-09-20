# Moneta

Zero-based envelope budgeting app (YNAB/Actual-style). Local-only static SPA: SvelteKit + Svelte 5 + TypeScript, SQLite WASM on OPFS in a Web Worker. No server, no accounts.

v1 is feature-complete: budget, accounts and transactions, reports, multiple budget files, backup and restore, and an installable offline PWA. The v1 design spec and implementation plans under `docs/` were removed once they were done; the code and its tests are the source of truth now.

- Contributor-facing docs: `README.md` (and `README.pt-BR.md`), `CONTRIBUTING.md`.

## Commands

```sh
pnpm install
pnpm dev              # dev server, http://localhost:5173
pnpm build            # static build into ./build
pnpm test             # all unit tests once (Vitest, Node)
pnpm test src/lib/db  # a subset, by path
pnpm test:e2e         # builds, then runs Playwright in Chromium against `pnpm preview`
pnpm preview          # serves ./build with a static server (sirv), like a host would
pnpm bench            # times the budget recompute on a large budget
pnpm icons            # regenerates the PWA icons in static/ from static/icon.svg
pnpm lint             # Prettier check + ESLint
pnpm check            # svelte-check / TypeScript
pnpm format           # Prettier write
pnpm i18n             # compile the Paraglide messages (dev, build and check do it too)
```

Before every commit, `pnpm lint`, `pnpm check` and `pnpm test` must pass.

## Layout

- `src/lib/domain/`: pure TS (money, months, budget engine, quick-assign). No DB, no DOM.
- `src/lib/db/`: runs only in the worker. Schema and migrations, repos, RPC surface (`api.ts`), dispatcher. `system.ts` holds the budget-file calls (`api.system.*`) over a `FileStore`: the OPFS pool in `worker.ts`, in-memory databases in tests (`memoryFileStore`). `backup.ts` checks restores.
- `src/lib/client/`: main thread. Typed RPC client (`rpc.ts`), worker start (`db.ts`), `liveQuery` (`live.ts`) and `useLive` (`live.svelte.ts`), tab lock, budget registry and session, app state (`app-state.svelte.ts`: `useSession()`), `runAction`/`notifyError` (`notify.ts`), the accent palette (`accent.ts`; mode-watcher stores the choice and writes it as `data-theme`).
- `src/lib/budget/`, `src/lib/accounts/`, `src/lib/transactions/`, `src/lib/reports/`: pure, unit-tested screen logic (grid model, category order, account defaults, register display, transaction form rules, report ranges).
- `src/lib/backup/`: backups (`.sqlite`), CSV and JSON exports, the backup reminder. Files go out through a `BackupTarget` (downloads in v1).
- `src/lib/i18n/`: message catalogs (`messages/en.json`, `messages/pt-BR.json`), error messages, labels for system rows, formats. Paraglide compiles them into `src/lib/paraglide/` (generated, not committed).
- `src/lib/components/`: Svelte components by area (`app/`, `welcome/`, `budget/`, `accounts/`, `transactions/`, `reports/`, `settings/`); `ui/` holds the generated shadcn-svelte primitives (`chart/` wraps LayerChart).
- `src/routes/`: SvelteKit pages (`ssr = false`, `adapter-static` with an `index.html` fallback). `/` is the welcome page: it presents the project and offers to install the PWA, and it renders outside `Boot`, so it opens no database. It redirects to `/budget/[month]` once this browser has a budget (`$lib/client/welcome.ts`), and the manifest's `start_url` is `/budget` so an installed window never sees it. Every other route goes through the root layout's `Boot`, which claims the tab lock, starts the worker, registers the service worker (`$lib/client/sw.ts`, `@vite-pwa/sveltekit`, prompt to update) and renders onboarding, a startup screen or the app.
- `e2e/`: Playwright tests against the production build.

## Rules

- **Money is integer minor units** (cents), negative = outflow. Never use floats for storage or budget math.
- **Store only facts.** Balances, activity, available and Ready to Assign are always derived (SQL aggregates plus `budget-engine.ts`), never cached.
- **The database lives only in the worker.** The main thread never imports `$lib/db/repos/*`, `$lib/db/connection` or `@sqlite.org/sqlite-wasm` at runtime (`import type` is fine). It goes through `api.<namespace>.<method>()`.
- New RPC methods go in `src/lib/db/api.ts`. Writes declare the tables they change: that drives live-query refreshes.
- Multi-statement writes use `tx(db, fn)` (a nestable SAVEPOINT).
- Domain failures throw `DomainError` with a typed code from `src/lib/domain/errors.ts`; nothing else is thrown on purpose.
- IDs are UUIDv7 (`uuidv7`). Dates are `'YYYY-MM-DD'` and months `'YYYY-MM'`. Booleans are 0/1 in SQL and `boolean` in repo results.
- Schema changes are new numbered files in `src/lib/db/migrations/`, added to `MIGRATIONS` and tracked by `PRAGMA user_version`. Never edit an applied migration. Migrations run with foreign keys off and must leave `PRAGMA foreign_key_check` clean; opening an older budget saves a copy first.
- No COOP/COEP headers or server code: the OPFS SAH-pool VFS doesn't need them, and the build must work on any static host.
- Svelte 5 runes only (`$props`, `$state`, `$derived`, `$effect`).
- UI text is in English and Brazilian Portuguese: every user-facing string comes from Paraglide (`m.<key>()` from `$lib/paraglide/messages`), and both catalogs keep identical keys and placeholders (a test checks). System rows stored in English are shown through `$lib/i18n/labels`.
- Display money with `session.format(minor)`, parse typed amounts with `session.parse(text)`, and prefill inputs with `formatAmountInput`.
- Links and navigation use `resolve()` from `$app/paths` with a route id (ESLint enforces it outside `components/ui/`).
- Phone layout is the default; `md:` (768px) switches to desktop (sidebar, dialogs instead of bottom sheets).
- Form writes go through `runAction` (returns `null` or an inline message; unexpected errors toast). Call `useLive` during component initialization.

## Testing

- TDD: write the failing test first. Unit tests sit next to their modules (`*.test.ts`); e2e tests are `*.e2e.ts`.
- DB tests use a real in-memory SQLite: `createBudgetDb()` / `createTestDb()` from `src/lib/db/testing.ts`.
- Vitest has `requireAssertions` on: every test must assert something.
- `sqlite3_step() rc=` lines in test output come from statements expected to fail. They are harmless.

## Style and workflow

- Prettier: tabs, single quotes, width 100. Don't reformat `docs/`: it is in `.prettierignore` on purpose.
- Match the surrounding code: short doc comments on exports, and comments only where the code isn't self-evident.
- Conventional commit prefixes (`feat:`, `fix:`, `test:`, `docs:`, `chore:`), enforced by a commitlint `commit-msg` hook (husky, `commitlint.config.js`).
- Commit or push only when asked.
