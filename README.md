<p align="center">
	<img src="static/icon.svg" width="96" height="96" alt="" />
</p>

<h1 align="center">Moneta</h1>

<p align="center">Zero-based envelope budgeting that never leaves your device.</p>

<p align="center">
	<strong>English</strong> · <a href="README.pt-BR.md">Português (BR)</a>
	<br /><br />
	<a href="https://github.com/flyri0/moneta/actions/workflows/ci.yml"><img src="https://github.com/flyri0/moneta/actions/workflows/ci.yml/badge.svg" alt="CI status" /></a>
</p>

---

## What Moneta is

Moneta is a budgeting app in the spirit of YNAB and Actual Budget. You give every unit of
income a job: money moves from **Ready to Assign** into category envelopes, and spending
draws those envelopes down. When an envelope runs dry, you decide where the money comes
from instead of finding out at the end of the month.

It is **local-only**. There is no server, no account and no tracking. Your budget is a
SQLite database that lives inside your browser (SQLite WASM on the Origin Private File
System), and it stays there. Install Moneta as a PWA and it works offline, on your phone
or your laptop.

## About the name

[Moneta](https://en.wikipedia.org/wiki/Moneta) was a Roman goddess, an epithet of Juno as
protector of the city's funds. Her name comes from the Latin verb _monere_, "to remind, to
warn, to advise", and Romans honored her as the advisor who would see they never lacked
money as long as they stayed just. Money was coined in her temple, which is how her name
became the word for coinage itself: _money_ and _mint_ in English, _moeda_ in Portuguese and
_moneda_ in Spanish all trace back to her.

A budgeting app that reminds you where your money is meant to go seemed a fitting namesake.

## Why you might like it

- **Your money is nobody else's business.** Nothing is uploaded, because there is nowhere
  to upload it to.
- **Nothing to sign up for.** Open it and start budgeting.
- **You own the file.** One budget is one `.sqlite` file. Back it up whenever you want,
  restore it on another machine, or export to CSV and JSON.
- **It works on a plane.** The whole app, database and all, runs in the browser.

## What it does

- Zero-based envelope budgeting with Ready to Assign, category groups and per-category
  overspending rollover
- Quick-assign helpers: same as last month, spent average, cover overspending, clear
- On-budget and off-budget (tracking) accounts
- Credit cards with automatic payment categories
- Split transactions and transfers between accounts
- Reports: spending by category and net worth over time
- Several budget files side by side
- Backup and restore as `.sqlite`, plus CSV and JSON exports, with a reminder when your
  last backup is more than two weeks old
- Installable, offline-capable PWA
- English and Brazilian Portuguese

## Roadmap (future)

Moneta v1 focuses on a reliable, offline-first foundation for zero-based envelope budgeting. Planned directions for future releases include:

- **Security & Data Sovereignty**:
  - **Database encryption at rest**: Client-side encryption for the local OPFS SQLite database via a master passphrase or biometrics (WebAuthn/Passkeys), plus password-protected backup exports.
  - **Cloud backup targets**: Direct, client-side encrypted backup export to user-owned storage (WebDAV/Nextcloud, Google Drive, Dropbox) and local directory sync via the File System Access API.
- **Payee & Transaction Management**:
  - **Payee management screen**: Dedicated interface to view all payees, rename payees across past transactions in one step, merge duplicate payees, assign default categories, and delete unused entries.
  - **Scheduled & recurring transactions**: Automated recurring bills and income with upcoming cash-flow forecasts in account registers.
- **Import & Reconciliation**:
  - **Bank file import**: Drag-and-drop import for OFX, QFX, QIF, and CSV with smart column mapping and duplicate detection.
  - **Account reconciliation**: Guided register reconciliation against bank statements, with locking for reconciled transactions.
- **Budgeting & Goals**:
  - **Category targets & goals**: Target balances, target balances by date, monthly spending goals, visual progress indicators, and one-click "Underfunded" quick-assign.
- **Analytics & Power Tools**:
  - **Expanded reports**: Monthly Income vs. Expense matrix, payee spending breakdowns, and cash-flow trends.
  - **Keyboard-first navigation & command palette**: Quick command palette (`Ctrl/Cmd + K`) and fast transaction entry shortcuts.

## Getting started

You need [Node.js](https://nodejs.org) 24 or newer and [pnpm](https://pnpm.io) 12 or newer.

```sh
pnpm install
pnpm dev            # start the dev server at http://localhost:5173
pnpm dev --open     # …and open it in the browser
```

To build the real thing:

```sh
pnpm build          # static build into ./build
pnpm preview        # serve that build at http://localhost:4173
```

`build/` is a plain static site. Put it on any host that serves `index.html` for unknown
paths — no server code, and no COOP/COEP headers needed. Serve it from the root of a
domain: the service worker that makes the app work offline is registered at `/`.

## Where your data lives

Each budget is a single SQLite file in your browser's private storage (OPFS). Nothing
leaves the device on its own.

**Settings → Backup** saves that file to your downloads and restores one back, and Moneta
nudges you when your last backup is more than two weeks old. Before an app update changes
a budget's schema, Moneta keeps a copy of the old file in the same storage (the last
three), so an upgrade is never a one-way door.

Because the budget lives in the browser's storage for that site, clearing site data for
Moneta deletes it. Keep a backup somewhere you control.

## Development

| Command          | What it does                                    |
| ---------------- | ----------------------------------------------- |
| `pnpm dev`       | Dev server at http://localhost:5173             |
| `pnpm build`     | Static production build into `./build`          |
| `pnpm preview`   | Serve `./build` like a static host would        |
| `pnpm test`      | All unit tests once (Vitest, Node)              |
| `pnpm test:unit` | The same tests in watch mode                    |
| `pnpm test:e2e`  | Build, then run Playwright in Chromium          |
| `pnpm lint`      | Prettier check + ESLint                         |
| `pnpm check`     | Type-check with svelte-check                    |
| `pnpm format`    | Fix formatting with Prettier                    |
| `pnpm i18n`      | Compile the Paraglide messages                  |
| `pnpm bench`     | Time the budget recompute on a large budget     |
| `pnpm icons`     | Regenerate the PWA icons from `static/icon.svg` |

Unit and integration tests run in Node with Vitest; the database tests use a real
in-memory SQLite — the same WASM build the app ships. End-to-end tests in `e2e/` run the
production build in Chromium:

```sh
pnpm exec playwright install chromium   # first time only
pnpm test:e2e
```

On a fresh Linux or WSL machine Chromium may fail to start because system libraries are
missing (for example `libnspr4.so`). Install them once from a regular terminal:

```sh
sudo pnpm exec playwright install-deps chromium
```

### Project layout

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
```

### Translations

UI text lives in `src/lib/i18n/messages/en.json` and `pt-BR.json`, and
[Paraglide](https://inlang.com/m/gerre34r/library-inlang-paraglideJs) compiles it into
`src/lib/paraglide/` (generated, not committed). `pnpm dev`, `pnpm build` and `pnpm check`
compile it for you; `pnpm i18n` does it on its own. The first compile downloads Paraglide's
message-format plugins from jsDelivr, so it needs a network connection once.

## Contributing

Bug reports, translations and pull requests are welcome. Start with
[CONTRIBUTING.md](CONTRIBUTING.md) — it covers the setup, the handful of rules that keep
the money math honest, and what CI expects before a PR can land.

## License

[MIT](LICENSE).
