# Moneta

Zero-based envelope budgeting app (YNAB/Actual-style). Local-only static SPA: SvelteKit + Svelte 5 + TypeScript, SQLite WASM on OPFS in a Web Worker. No server, no accounts.

- Design spec: `docs/superpowers/specs/2026-09-19-moneta-v1-design.md` (source of truth)
- Plans: `docs/superpowers/plans/`. Plan 1 (core) is done; Plan 2 (app UI) is written, not executed; Plan 3 (reports, backup, PWA) is to come.

## Commands

```sh
pnpm install
pnpm dev              # dev server, http://localhost:5173
pnpm build            # static build into ./build
pnpm test             # all unit tests once (Vitest, Node)
pnpm test src/lib/db  # a subset, by path
pnpm test:e2e         # builds, then runs Playwright in Chromium
pnpm lint             # Prettier check + ESLint
pnpm check            # svelte-check / TypeScript
pnpm format           # Prettier write
```

Before every commit, `pnpm lint`, `pnpm check` and `pnpm test` must pass.

## Layout

- `src/lib/domain/`: pure TS (money, months, budget engine, quick-assign). No DB, no DOM.
- `src/lib/db/`: runs only in the worker. Schema and migrations, repos, RPC surface (`api.ts`), dispatcher.
- `src/lib/client/`: main thread. Typed RPC client (`rpc.ts`), `liveQuery` (`live.ts`), worker start (`db.ts`).
- `src/routes/`: SvelteKit pages (`ssr = false`, `adapter-static` with an `index.html` fallback).

## Rules

- **Money is integer minor units** (cents), negative = outflow. Never use floats for storage or budget math.
- **Store only facts.** Balances, activity, available and Ready to Assign are always derived (SQL aggregates plus `budget-engine.ts`), never cached.
- **The database lives only in the worker.** The main thread never imports `$lib/db/repos/*`, `$lib/db/connection` (types excepted) or `@sqlite.org/sqlite-wasm`. It goes through `api.<namespace>.<method>()`.
- New RPC methods go in `src/lib/db/api.ts`. Writes declare the tables they change: that drives live-query refreshes.
- Multi-statement writes use `tx(db, fn)` (a nestable SAVEPOINT).
- Domain failures throw `DomainError` with a typed code from `src/lib/domain/errors.ts`; nothing else is thrown on purpose.
- IDs are UUIDv7 (`uuidv7`). Dates are `'YYYY-MM-DD'` and months `'YYYY-MM'`. Booleans are 0/1 in SQL and `boolean` in repo results.
- Schema changes are new numbered files in `src/lib/db/migrations/`, tracked by `PRAGMA user_version`. Never edit an applied migration.
- No COOP/COEP headers or server code: the OPFS SAH-pool VFS doesn't need them, and the build must work on any static host.
- Svelte 5 runes only (`$props`, `$state`, `$derived`, `$effect`).
- UI text is in English and Brazilian Portuguese (i18n from day one, per the spec).

## Testing

- TDD: write the failing test first. Unit tests sit next to their modules (`*.test.ts`); e2e tests are `*.e2e.ts`.
- DB tests use a real in-memory SQLite: `createBudgetDb()` / `createTestDb()` from `src/lib/db/testing.ts`.
- Vitest has `requireAssertions` on: every test must assert something.
- `sqlite3_step() rc=` lines in test output come from statements expected to fail. They are harmless.

## Style and workflow

- Prettier: tabs, single quotes, width 100. Don't reformat `docs/`: it is in `.prettierignore` on purpose.
- Match the surrounding code: short doc comments on exports, and comments only where the code isn't self-evident.
- Conventional commit prefixes (`feat:`, `fix:`, `test:`, `docs:`, `chore:`).
- Commit or push only when asked.
