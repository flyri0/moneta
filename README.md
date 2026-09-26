<p align="center">
	<img src="static/icon.svg" width="96" height="96" alt="" />
</p>

<h1 align="center">Moneta</h1>

<p align="center">Zero-based envelope budgeting that never leaves your device.</p>

<p align="center">
	<strong>English</strong> · <a href="README.pt-BR.md">Português (BR)</a>
	<br /><br />
	<a href="https://github.com/flyri0/moneta/actions/workflows/ci.yml"><img src="https://github.com/flyri0/moneta/actions/workflows/ci.yml/badge.svg" alt="CI status" /></a>
	<a href="https://app.netlify.com/projects/usemoneta/deploys"><img src="https://api.netlify.com/api/v1/badges/058ac25a-38ff-40b3-a04e-d586850df680/deploy-status" alt="Netlify Status" /></a>
</p>

---

> [!WARNING]
> **Moneta is an experimental personal project.** It was written 100% by LLMs, as a way for
> me to learn. It is usable, but it comes with no guarantees: I take no responsibility for
> lost or stolen data. Use it at your own risk and keep backups somewhere you control.

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

## Main features

1. **Zero-based envelope budget.** Income lands in Ready to Assign and you move it into
   categories organized in groups. Overspending rolls over per category, and quick-assign
   fills a month for you: same as last month, the average spent over 3, 6 or 12 months,
   cover overspending, or clear.
2. **Accounts and transactions.** On-budget and off-budget (tracking) accounts, credit cards
   as on-budget accounts with budget-neutral payment transfers, split transactions,
   transfers between accounts, and payees you can rename everywhere, merge and give a
   default category.
3. **Scheduled transactions.** One-off, daily, weekly, monthly or yearly schedules, with a
   rule for dates that fall on a weekend. They are entered by themselves or with a tap, and
   each account shows the next 30 days.
4. **Reports.** Spending by category and by payee, net worth, cash flow, spending trends,
   assets and debts by account, and Age of Money, on an overview whose cards you can reorder
   and hide.
5. **Your data, on your device.** An installable PWA that works offline, several budget files
   side by side, backups of every budget in one `.moneta` file (optionally encrypted with a
   password and a recovery key), CSV and JSON exports, and automatic encrypted backups to
   your own Google Drive.

The whole app is in English and Brazilian Portuguese.

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
domain: the service worker that makes the app work offline is registered at `/`. Give
Moneta an origin of its own: any other app on the same origin can read its storage (OPFS,
IndexedDB, localStorage), budgets included.

The Content-Security-Policy ships inside `index.html` as a `<meta>` tag, so the page is
restricted on any host. A meta tag doesn't reach everything, though: workers follow the
headers of their own scripts, and framing can only be forbidden by a header. If your host
lets you set headers, send a Content-Security-Policy for the workers
(`/_app/immutable/workers/*` and `/sw.js`), `Content-Security-Policy: frame-ancestors 'none'`
for the rest, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer` and
`Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`. None of these is
required. `netlify.toml` has them all, along with the `index.html` fallback rule; the page's
own policy can't be repeated there, since its script hashes change with every build.

### Backups to Google Drive (optional)

Automatic backups to Google Drive need one small serverless function,
`netlify/functions/oauth-token.mts`. Google hands a browser app only one-hour tokens unless
the token request carries the OAuth client secret, and that secret must not ship in the app.
The function adds it to the two token requests Moneta makes (signing in, and renewing the
hour-long token) and stores nothing: the long-lived token stays on the device, and backups go
from the browser straight to Drive. Without `VITE_GOOGLE_CLIENT_ID` in the build the option
doesn't appear, so any static host still works.

1. In the Google Cloud console, create a project, enable the **Google Drive API** and set up
   the OAuth consent screen with the `https://www.googleapis.com/auth/drive.file` scope.
   Publish it (**In production**): while it is in Testing, sign-ins expire after seven days.
   `drive.file` is a non-sensitive scope, so Google doesn't need to review the app.
2. Create an OAuth client of type **Web application**, with your site as an authorized
   JavaScript origin and `https://<your site>/oauth/callback` as a redirect URI.
3. In the Netlify site's environment variables, set `VITE_GOOGLE_CLIENT_ID` (the client id:
   public, read by the build and the function) and `GOOGLE_CLIENT_SECRET` (read only by the
   function), then deploy again.

To try it locally, put both in `.env` (see `.env.example`), run `npx netlify dev`, and add its
address (`http://localhost:8888`) to the client's origins and redirect URIs.

## Where your data lives

Each budget is a single SQLite file in your browser's private storage (OPFS). Nothing
leaves the device unless you turn on automatic backups, and then only encrypted.

**Settings → Backup** saves every budget to your downloads as one `.moneta` file and
restores the ones you pick from it, and Moneta nudges you when your last backup is more than
two weeks old. A `.moneta` file is a ZIP: `moneta.json` describes it, and `budgets/` holds
each budget's SQLite file. Restoring a budget that is already on the device replaces it and
keeps what it held as a saved copy. Older `.sqlite` backups still restore.

Turn on **Encrypt backups** to protect the backup files themselves. You pick a password and
get a recovery key to keep apart from your backups. Moneta keeps the encryption key on the
device, so backing up never asks for anything, and restoring asks for the password or the
recovery key. An encrypted `.moneta` holds only the encryption settings in `moneta.json` and
the whole backup, encrypted with AES-256-GCM, in `payload.bin`. The key is derived with
PBKDF2-SHA256 from the password, or with HKDF from the recovery key. Lose both and nobody can
open those backups, Moneta included.

**Automatic backup** connects your Google Drive once, then saves an encrypted backup of
every budget to a Moneta folder there by itself: two minutes after changes stop, when you
switch away with a change waiting, and at start when the last one is a day old. It runs only
while Moneta is open. Each device keeps one file per day, its newest and the five days before
it, and deletes the older ones. Backups to the cloud are always encrypted, so it asks you to
turn encryption on first, and restoring from Drive on another device asks for the password or
the recovery key. Moneta sees only the files it created in your Drive.

Before an app update changes
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
src/core/domain/       pure TypeScript: money, months, budget engine, quick-assign
src/core/db/           SQLite side (runs in a Web Worker): schema, migrations, repositories, RPC dispatcher
src/core/client/       main-thread side: RPC client, live queries, tab lock, budget registry and session
src/core/i18n/         message catalogs (en, pt-BR), error messages, labels and formats
src/features/          feature modules (colocated screen logic + Svelte components):
  budget/              budget grid, category & group sheets, order, progress, view
  accounts/            account list, register, account creation dialogs
  transactions/        transaction entry dialog, form validation
  schedules/           schedules screen, schedule form, rule summaries
  reports/             report cards and pages, overview layout, date ranges
  settings/            backup & restore, storage, theme, budget files
  onboarding/          first-run steps, starter categories
  welcome/             landing page, PWA install dialog
  backup/              backups, CSV and JSON exports, backup reminder, cloud backups (cloud/)
  demo/                demo dataset, seed data
src/components/        shared Svelte components (ui/ holds shadcn-svelte primitives, app/ holds shell)
src/routes/            SvelteKit pages
e2e/                   Playwright tests
netlify/               the optional token function for backups to Google Drive
```

### Translations

UI text lives in `src/core/i18n/messages/en.json` and `pt-BR.json`, and
[Paraglide](https://inlang.com/m/gerre34r/library-inlang-paraglideJs) compiles it into
`src/core/i18n/paraglide/` (generated, not committed). `pnpm dev`, `pnpm build` and `pnpm check`
compile it for you; `pnpm i18n` does it on its own. The first compile downloads Paraglide's
message-format plugins from jsDelivr, so it needs a network connection once.

## Contributing

Bug reports, translations and pull requests are welcome. Start with
[CONTRIBUTING.md](CONTRIBUTING.md) — it covers the setup, the handful of rules that keep
the money math honest, and what CI expects before a PR can land.

## License

[MIT](LICENSE).
