# Contributing to Moneta

Thanks for wanting to help. Bug reports, translation fixes and pull requests are all
welcome, and you don't need to know the whole codebase to send a good one.

This guide is in English, which is also the language for issues and pull requests. The
README is available in [English](README.md) and [Português (BR)](README.pt-BR.md).

## Getting set up

You need Node.js 24+ and pnpm 12+.

```sh
git clone https://github.com/flyri0/moneta.git
cd moneta
pnpm install
pnpm dev
```

For the browser tests, install Chromium once:

```sh
pnpm exec playwright install chromium
```

On a fresh Linux or WSL machine you may also need the system libraries:
`sudo pnpm exec playwright install-deps chromium`.

## Before you open a pull request

```sh
pnpm lint      # Prettier check + ESLint
pnpm check     # svelte-check / TypeScript
pnpm test      # unit and integration tests
```

All three must pass. CI runs the same three plus a production build on every push, and
runs the Playwright suite (`pnpm test:e2e`) on pull requests.

Keep a pull request to one topic, link the issue it closes, and use conventional commit
prefixes: `feat:`, `fix:`, `test:`, `docs:`, `chore:`. A `commit-msg` hook (husky and
[commitlint](https://commitlint.js.org), installed by `pnpm install`) rejects commit
messages that don't follow the [Conventional Commits](https://www.conventionalcommits.org)
format.

## How the code is organised

`src/core/domain/` is pure TypeScript — money, months, the budget engine, quick-assign — with
no DB and no DOM. `src/core/db/` runs **only** inside the Web Worker. `src/core/client/` is
the main thread. The feature modules under `src/features/` (`budget/`, `accounts/`, `transactions/`,
`reports/`, `settings/`, `onboarding/`, `welcome/`, `backup/`, `demo/`) colocate pure screen logic
with their Svelte components. Shared components live in `src/components/` (`ui/` holds shadcn-svelte
primitives and `app/` holds the application shell).

The rule that catches newcomers: **the database lives only in the worker.** The main thread
never imports `$db/repos/*`, `$db/connection` or `@sqlite.org/sqlite-wasm` at
runtime (`import type` is fine). It goes through `api.<namespace>.<method>()`. New RPC
methods are declared in `src/core/db/api.ts`, and a write declares the tables it changes —
that is what drives live-query refreshes.

## House rules

- **Money is integer minor units** (cents), negative means outflow. Never use floats for
  storage or budget math.
- **Store only facts.** Balances, activity, available and Ready to Assign are always
  derived (SQL aggregates plus `src/core/domain/budget-engine.ts`), never cached.
- Multi-statement writes go through `tx(db, fn)`, a nestable SAVEPOINT.
- Domain failures throw `DomainError` with a typed code from `src/core/domain/errors.ts`.
  Nothing else is thrown on purpose.
- IDs are UUIDv7. Dates are `'YYYY-MM-DD'`, months `'YYYY-MM'`. Booleans are 0/1 in SQL and
  `boolean` in repo results.
- Svelte 5 runes only (`$props`, `$state`, `$derived`, `$effect`). Links and navigation use
  `resolve()` from `$app/paths`; ESLint enforces it.
- Phone layout is the default; `md:` (768px) switches to the desktop layout.
- Form writes go through `runAction`, and `useLive` is called during component
  initialization.

### Changing the schema

Add a **new** numbered file in `src/core/db/migrations/` and register it in `MIGRATIONS`.
Never edit a migration that has already shipped — someone's budget has already run it.
Migrations run with foreign keys off and must not break any foreign key: `migrate` fails when
`PRAGMA foreign_key_check` shows rows that weren't there before.

## Tests

Write the failing test first. Unit tests sit next to their module as `*.test.ts`; the
end-to-end tests are `e2e/*.e2e.ts`. Vitest runs with `requireAssertions`, so every test
must assert something.

Database tests use a real in-memory SQLite through `createBudgetDb()` and `createTestDb()`
from `src/core/db/testing.ts`. Lines like `sqlite3_step() rc=` in the test output come from
statements that are expected to fail — they are harmless.

## Translations

Every user-facing string comes from Paraglide: `m.<key>()`, imported from
`$i18n/paraglide/messages`. Add the key to **both** `src/core/i18n/messages/en.json` and
`pt-BR.json`; the catalogs must keep identical keys and placeholders, and
`src/core/i18n/catalog.test.ts` fails if they drift. System rows are stored in English and
displayed through `$i18n/labels`.

Display money with `session.format(minor)`, parse typed amounts with `session.parse(text)`,
and prefill inputs with `formatAmountInput`.

Translation-only pull requests are very welcome — fixing awkward Portuguese is a real
contribution.

## Style

Prettier with tabs, single quotes and a width of 100 (`pnpm format`). Match the surrounding
code: short doc comments on exports, and comments only where the code isn't self-evident.

## Releasing

Maintainers only. Netlify builds and deploys every push to `main`; other branches and pull
requests get deploy previews. Work on a branch and merge it into `main` to ship it. An open app
finds the new service worker on its own and offers to reload.

## Reporting bugs

Use the [issue templates](https://github.com/flyri0/moneta/issues/new/choose). Moneta holds
financial data, and issues are public: please reproduce the problem with a throwaway budget
and never attach a `.moneta` or `.sqlite` backup of your real one or screenshots of your real balances.

If you believe you have found a security or privacy problem, report it privately through
GitHub's security advisories rather than in a public issue.
