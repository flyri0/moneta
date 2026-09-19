# Moneta

Moneta is a zero-based envelope budgeting app, inspired by YNAB and Actual Budget. It is **local-only**: no server, no account, no tracking. Your budget lives in a SQLite database inside your browser (SQLite WASM on the Origin Private File System). Moneta is built to install as a PWA and work offline.

You give every unit of income a job: money goes from **Ready to Assign** into category envelopes, and spending draws them down. Moneta supports on-budget and off-budget (tracking) accounts, credit cards with automatic payment categories, split transactions, transfers, per-category overspending rollover, and quick-assign helpers.

> **Status:** v1 is feature-complete: the budget, accounts and transactions, reports (spending by category, net worth), multiple budget files, backup and restore (`.sqlite`), CSV and JSON exports, and an installable PWA that works offline, in English and Brazilian Portuguese. See `docs/superpowers/specs/` for the design and `docs/superpowers/plans/` for the implementation plans.

## Requirements

- Node.js 24+
- pnpm 12+
- For browser (e2e) tests: Chromium from Playwright (see [Testing](#testing))

## Getting started

```sh
pnpm install
pnpm dev            # start the dev server at http://localhost:5173
pnpm dev --open     # …and open it in the browser
```

Moneta builds to a static site with no server code:

```sh
pnpm build          # production build into ./build
pnpm preview        # serve the build at http://localhost:4173
```

The `build/` folder can go on any static host that serves `index.html` for unknown paths. No special headers (COOP/COEP) are needed. Serve it from the root of a domain: the service worker, which makes the app work offline, is registered at `/`.

## Your data

Each budget is one SQLite file in the browser's private storage (OPFS). Settings → Backup saves it as a `.sqlite` file and restores one, and Moneta reminds you when your last backup is more than two weeks old. Before an app update changes a budget's schema, Moneta keeps a copy of the old file in the same storage (the last three).

The app icons in `static/` are generated from `static/icon.svg` with `pnpm icons`.

## Translations

UI text lives in `src/lib/i18n/messages/en.json` and `pt-BR.json` and is compiled by [Paraglide](https://inlang.com/m/gerre34r/library-inlang-paraglideJs) into `src/lib/paraglide/` (generated, not committed). `pnpm dev`, `pnpm build` and `pnpm check` compile it; `pnpm i18n` does it on its own. Compiling downloads Paraglide's message-format plugins from jsDelivr the first time, so the first build needs a network connection.

## Linting and formatting

```sh
pnpm lint           # Prettier check + ESLint
pnpm format         # fix formatting with Prettier
pnpm check          # type-check with svelte-check / TypeScript
```

## Testing

Unit and integration tests run in Node with Vitest. The database tests use a real in-memory SQLite (the same WASM build the app uses):

```sh
pnpm test           # run all unit tests once
pnpm test:unit      # watch mode
pnpm bench          # time the budget recompute on a large budget
```

End-to-end tests (in `e2e/`) run the production build in Chromium with Playwright:

```sh
pnpm exec playwright install chromium   # first time only
pnpm test:e2e
```

On a fresh Linux/WSL machine, Chromium may fail to start because system libraries are missing (e.g. `libnspr4.so`). Install them once from a regular terminal:

```sh
sudo pnpm exec playwright install-deps chromium
```

## Project layout

```
src/lib/domain/        pure TypeScript: money, months, budget engine, quick-assign
src/lib/db/            SQLite side (runs in a Web Worker): schema, migrations, repositories, RPC dispatcher
src/lib/client/        main-thread side: RPC client, live queries, tab lock, budget registry and session
src/lib/budget/        budget screen logic (grid model, category order)
src/lib/accounts/      account and register logic
src/lib/transactions/  transaction form logic
src/lib/reports/       report logic (date ranges, spending shares)
src/lib/backup/        backups, CSV and JSON exports, the backup reminder
src/lib/i18n/          message catalogs (en, pt-BR), error messages, labels and formats
src/lib/components/    Svelte components (ui/ holds the shadcn-svelte primitives)
src/routes/            SvelteKit pages
e2e/                   Playwright tests
docs/superpowers/      design spec and implementation plans
```
