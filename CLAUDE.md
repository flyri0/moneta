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
pnpm test src/core/db  # a subset, by path
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

- `src/core/domain/`: pure TS (money, months, budget engine, quick-assign). No DB, no DOM. Alias: `$domain`.
- `src/core/db/`: runs only in the worker. Schema and migrations, repos, RPC surface (`api.ts`), dispatcher. `system.ts` holds the budget-file calls (`api.system.*`) over a `FileStore`: the OPFS pool in `worker.ts`, in-memory databases in tests (`memoryFileStore`). `backup-file.ts` reads and writes `.moneta` backups (a ZIP via `fflate`, worker-only), and `backup.ts` checks each budget in a restore. Alias: `$db`.
- `src/core/client/`: main thread. Typed RPC client (`rpc.ts`), worker start (`db.ts`), `liveQuery` (`live.ts`) and `useLive` (`live.svelte.ts`), tab lock, budget registry and session, app state (`app-state.svelte.ts`: `useSession()`), `runAction`/`notifyError` (`notify.ts`), the accent palette (`accent.ts`; mode-watcher stores the choice and writes it as `data-theme`). Alias: `$client`.
- `src/core/i18n/`: message catalogs (`messages/en.json`, `messages/pt-BR.json`), error messages, labels for system rows, formats. Paraglide compiles them into `src/core/i18n/paraglide/` (generated, not committed). Alias: `$i18n`.
- `src/features/`: feature modules colocating screen logic and Svelte components by area (`budget/`, `accounts/`, `transactions/`, `payees/`, `schedules/`, `reports/`, `settings/`, `onboarding/`, `welcome/`, `backup/`, `demo/`). Alias: `$features`.
- `src/components/`: shared Svelte components (`app/` holds the app shell and navigation; `ui/` holds the generated shadcn-svelte primitives). Aliases: `$components`, `$ui`.
- `src/utils.ts`: utility helpers (e.g. `cn`). Alias: `$utils`.
- `src/routes/`: SvelteKit pages (`ssr = false`, `adapter-static` with an `index.html` fallback). `/` is the welcome page: it presents the project and offers to install the PWA, and it renders outside `Boot`, so it opens no database. It redirects to `/budget/[month]` once this browser has a budget (`$client/welcome.ts`), and the manifest's `start_url` is `/budget` so an installed window never sees it. Every other route goes through the root layout's `Boot`, which claims the tab lock, starts the worker, registers the service worker (`$client/sw.ts`, `@vite-pwa/sveltekit`, prompt to update) and renders onboarding, a startup screen or the app.
- `e2e/`: Playwright tests against the production build.

## Rules

- **Money is integer minor units** (cents), negative = outflow. Never use floats for storage or budget math.
- **Store only facts.** Balances, activity, available and Ready to Assign are always derived (SQL aggregates plus `budget-engine.ts`), never cached.
- **The database lives only in the worker.** The main thread never imports `$db/repos/*`, `$db/connection` or `@sqlite.org/sqlite-wasm` at runtime (`import type` is fine). It goes through `api.<namespace>.<method>()`.
- New RPC methods go in `src/core/db/api.ts`. Writes declare the tables they change: that drives live-query refreshes.
- Multi-statement writes use `tx(db, fn)` (a nestable SAVEPOINT).
- Domain failures throw `DomainError` with a typed code from `$domain/errors.ts`; nothing else is thrown on purpose.
- IDs are UUIDv7 (`uuidv7`). Dates are `'YYYY-MM-DD'` and months `'YYYY-MM'`. Booleans are 0/1 in SQL and `boolean` in repo results.
- Schema changes are new numbered files in `src/core/db/migrations/`, added to `MIGRATIONS` and tracked by `PRAGMA user_version`. Never edit an applied migration. Migrations run with foreign keys off and must not break any foreign key (`migrate` fails on new `PRAGMA foreign_key_check` rows); opening an older budget saves a copy first.
- `.moneta` backups carry `BACKUP_VERSION` (`$db/backup-file.ts`), the version of the container, not of the schema. Bump it when an app reading the current version would misread the new files (changed layout, new required field, changed meaning); not for optional fields or migrations. Every earlier version must still restore.
- No COOP/COEP headers or server code: the OPFS SAH-pool VFS doesn't need them, and the build must work on any static host.
- The Content-Security-Policy lives in `svelte.config.js` (`kit.csp`, hash mode, emitted as a `<meta>` tag). New external origins, inline scripts or `{@html}` must fit it; `e2e/csp.e2e.ts` fails on any violation.
- Svelte 5 runes only (`$props`, `$state`, `$derived`, `$effect`).
- UI text is in English and Brazilian Portuguese: every user-facing string comes from Paraglide (`m.<key>()` from `$i18n/paraglide/messages`), and both catalogs keep identical keys and placeholders (a test checks). System rows stored in English are shown through `$i18n/labels`.
- Display money with `session.format(minor)`, parse typed amounts with `session.parse(text)`, and prefill inputs with `formatAmountInput`.
- Build `Intl` formatters through `numberFormat`/`dateTimeFormat` (`$domain/intl-cache`), never `new Intl.NumberFormat` per value: lists and charts format hundreds of values per render, and on phones building a formatter costs far more than using it.
- Links and navigation use `resolve()` from `$app/paths` with a route id (ESLint enforces it outside `components/ui/`).
- Phone layout is the default; `md:` (768px) switches to desktop (sidebar, dialogs instead of bottom sheets).
- Form writes go through `runAction` (returns `null` or an `ActionError`). Call `useLive` during component initialization.
- Loading: a section with no data yet shows placeholders (`LoadingRows`, `$ui/skeleton`) inside `Delayed` (`$components/Delayed.svelte`), so quick loads never build them. `useLive` counts first loads for the loading bar (`$client/pending`, `NavProgress`) and marks data from before its arguments changed as `stale`; dim stale content with `aria-busy`.
- Feedback has three places, nothing else: (1) a form's or dialog's error shows inline in `FormMessage` (`$components/FormMessage.svelte`), just above its buttons, unexpected ones with "Copy details" and no toast; (2) a section that fails to load shows the same `FormMessage` inside it; (3) toasts only for what has no form: background work, a result the screen doesn't show (restored, copied), failed inline edits (`runActionToast`). Persistent notices that belong to the content use `Alert`.
- Destructive actions ask through `ConfirmPanel` (a dialog's own screen, with a back button) or `ConfirmDialog` (no dialog of its own). Only deleting a budget and replacing one on restore keep their countdown.
- Every app page starts with `PageHeader` (`$components/PageHeader.svelte`), before the page's column: title, back link, actions (`size="sm"`, icon plus a label from `md:`) and a toolbar for search and filters. It sticks to the top.

## Testing

- TDD: write the failing test first. Unit tests sit next to their modules (`*.test.ts`); e2e tests are `*.e2e.ts`.
- DB tests use a real in-memory SQLite: `createBudgetDb()` / `createTestDb()` from `$db/testing`.
- Vitest has `requireAssertions` on: every test must assert something.
- `sqlite3_step() rc=` lines in test output come from statements expected to fail. They are harmless.

## Style and workflow

- Prettier: tabs, single quotes, width 100. Don't reformat `docs/`: it is in `.prettierignore` on purpose.
- Match the surrounding code: short doc comments on exports, and comments only where the code isn't self-evident.
- Conventional commit prefixes (`feat:`, `fix:`, `test:`, `docs:`, `chore:`), enforced by a commitlint `commit-msg` hook (husky, `commitlint.config.js`).
- Commit or push only when asked.
