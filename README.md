# Moneta

Moneta is a zero-based envelope budgeting app, inspired by YNAB and Actual Budget. It is **local-only**: no server, no account, no tracking. Your budget lives in a SQLite database inside your browser (SQLite WASM on the Origin Private File System). Moneta is built to install as a PWA and work offline.

You give every unit of income a job: money goes from **Ready to Assign** into category envelopes, and spending draws them down. Moneta supports on-budget and off-budget (tracking) accounts, credit cards with automatic payment categories, split transactions, transfers, per-category overspending rollover, and quick-assign helpers.

> **Status:** the headless core (budget engine, database, typed RPC to the SQLite worker) is done. The app UI, reports, backup and the PWA shell come next. See `docs/superpowers/specs/` for the design and `docs/superpowers/plans/` for the implementation plans.

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

The `build/` folder can go on any static host. No special headers (COOP/COEP) are needed.

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
```

End-to-end tests run the production build in Chromium with Playwright:

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
src/lib/domain/   pure TypeScript: money, months, budget engine, quick-assign
src/lib/db/       SQLite side (runs in a Web Worker): schema, migrations, repositories, RPC dispatcher
src/lib/client/   main-thread side: typed RPC client and live-query stores
src/routes/       SvelteKit pages
docs/superpowers/ design spec and implementation plans
```
