# Moneta Plan 3: Reports, Backup and PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish Moneta v1: pre-migration copies and safe migrations, budget files in Settings, `.sqlite` backup and validated restore, CSV and JSON exports, a backup reminder, the Reports screen (spending by category, net worth), and an installable PWA that works offline and asks before updating. It also resolves the Plan 1 follow-ups for Plan 3.

**Architecture:** The worker's file handling moves out of `worker.ts` into `system.ts`, which runs over a small `FileStore` interface: the OPFS SAH pool in the worker and in-memory databases in Node tests. That makes pre-migration copies, export and restore validation unit-testable against real SQLite. The main thread gets session functions for switching, updating, deleting and restoring budgets, and pure modules for exports (`backup/`) and reports (`reports/`, `domain/net-worth.ts`). Settings and Reports are thin Svelte components over those, covered by Playwright. `@vite-pwa/sveltekit` precaches the whole build (including SQLite's WebAssembly), and `Boot` shows a "Reload" toast when a new version is waiting.

**Tech Stack:** SvelteKit 2, Svelte 5 (runes), TypeScript (strict), Tailwind CSS 4, shadcn-svelte 1.7 (its `chart` component on LayerChart 2.5), Paraglide JS 2, svelte-sonner, `@sqlite.org/sqlite-wasm` 3.53 (OPFS SAH pool), `@vite-pwa/sveltekit` 1.1 with `vite-plugin-pwa` 1.3 and `workbox-window` 7, `sirv-cli` 3, Vitest 4 (tests and `bench`), Playwright.

**Spec:** `docs/superpowers/specs/2026-09-19-moneta-v1-design.md`. Read it together with the Plan 1 follow-ups (`docs/superpowers/plans/2026-09-19-moneta-plan-1-followups.md`), whose Plan 3 section this plan resolves. Plans 1 and 2 (`2026-09-19-moneta-plan-1-core.md`, `2026-09-19-moneta-plan-2-app-ui.md`) built everything this plan calls.

**Plan series:** This is Plan 3 of 3. After it, every v1 requirement in the spec is implemented.

**How this plan was checked:** every task was applied in order to a clean checkout of `main` (commit `60f8cd1`). After each task, `pnpm lint`, `pnpm check` and `pnpm test` ran clean, and so did `pnpm test:e2e` where the task runs it. Each "verify it fails" step failed as described. The code blocks below were generated from those commits, so copy them exactly, and apply each "replace … with …" edit to the file as it stands at that task (every `replace` text occurs exactly once in it). Files made by a command (the shadcn chart component, the icons, `pnpm-lock.yaml`) come from running that command.

## Decisions made for this plan

The spec left these open or said less than the code needs. Task 11 records them in the spec.

1. **Pre-migration copies** are named `premigration-<budget file without .sqlite3>-<UTC timestamp>.sqlite3`, sit in the same OPFS pool, and are invisible to the budget registry (it only lists `budget-*.sqlite3`). The last 3 per budget are kept, and deleting a budget deletes its copies. There is no UI for them in v1; they are a safety net for support. Brand-new files (schema version 0) and current ones get no copy.
2. **The pool grows before any file is created** (`reserveMinimumCapacity(fileCount + 3)`: the new file, its journal, and the open database's journal). This covers new budgets, copies and restores.
3. **Migrations run with foreign keys off** and must leave `PRAGMA foreign_key_check` clean, or they roll back. With foreign keys on, rebuilding a table (the only way to change a column in SQLite) runs an implicit `DELETE` that cascades: Task 1's test shows it wiping `budget_assignments`.
4. **A restore always becomes a new budget file.** The worker checks the backup on an in-memory copy (header, integrity, `meta`, schema version; spec §6), migrates it, and writes it under a new name. "Replace" then deletes the old file, but only after the restored one opened. A bad backup changes nothing. Each failed check has its own error code and message: `BACKUP_NOT_SQLITE`, `BACKUP_DAMAGED`, `BACKUP_NOT_MONETA`, or the existing `SCHEMA_TOO_NEW`.
5. **Only the `.sqlite` backup counts as a backup.** It sets `meta.last_backup_at`; the CSV and JSON exports don't, because they can't be restored. The reminder toast appears when the app opens 14 days or more after the last backup, or after the budget was created if there was none.
6. **`BackupTarget` has only `save(fileName, blob)` in v1.** The spec sketched `save`, `list` and `load`, but the only v1 target is a download, which can't list or load; a restore reads a file the user picks. Cloud targets can add the other two.
7. **CSV format:** fixed English headers `Date,Account,Payee,Transfer,Category,Memo,Amount,Cleared`, ISO dates, plain decimals with a dot (negative = outflow), one row per split line (the line's memo, or the transaction's), a UTF-8 byte-order mark so spreadsheets read accents, CRLF line ends, and a `'` before text cells that start like a formula (`= + - @`). Names are stored names (e.g. "Ready to Assign"), not translations.
8. **JSON format:** `{ format: 'moneta-budget', schemaVersion, exportedAt, meta, tables }`, each table's rows under their SQL column names (a faithful dump, not an import format). The worker builds it (`api.backup.dump()`).
9. **Budget details** edit the open budget's name, currency and locale; that is where renaming happens. The currency can only change to one with the same decimal places once there are amounts: the repo's existing check now throws a dedicated `CURRENCY_LOCKED` so the form can explain it.
10. **Budget files:** creating one from Settings reuses the onboarding form with a Cancel button, which reopens the budget that was open. Deleting the open budget opens the next one, or onboarding when none is left (then without Cancel).
11. **Reports:** spending is net outflow per category on on-budget accounts over a date range (refunds count against it); Ready to Assign is left out, and so are categories with more refunds than spending. Ties sort by name. Net worth is month-end totals over every account (on- and off-budget, closed included); each account counts as an asset or a debt by the sign of its balance. The range picker offers this month, last month, the last 3 or 12 months, this year, or custom dates; net worth shows the last 12 months or all time. Chart tooltips are left out: the table under each chart has the exact numbers.
12. **Serving the build:** `vite preview` doesn't serve `/index.html`, which the service worker precaches, so its install fails there. `pnpm preview` becomes `sirv build --single` (a plain static server, like a host), and the e2e tests use it. The service worker is registered at `/` (SvelteKit's relative asset paths would otherwise register it under the current route), so the app must be served from a domain root.
13. **The manifest is English only** (a static file), and the icons are generated from one SVG with `@vite-pwa/assets-generator` through `pnpm dlx`, so it isn't a dependency.
14. **Performance (follow-up):** `pnpm bench` measures `budget.month` on a heavy budget (5 years, 40 categories, about 9,000 transactions): about 105 ms, of which about 85 ms is loading rows from SQL and about 10 ms the engine. That's fine for v1 and is recorded in the follow-ups rather than optimized now.

## Global Constraints

- Amounts are integer minor units everywhere. Display them with `session.format(minor)` (and `session.formatCompact(minor)` for chart axes, Task 9). Exports write plain decimals computed from minor units, never from floats.
- The main thread never imports `$lib/db/repos/*`, `$lib/db/connection` (types excepted) or `@sqlite.org/sqlite-wasm`. Everything goes through `session.api` / `api.system`. Tests may import anything.
- New RPC methods go in `src/lib/db/api.ts`; writes declare the tables they change. System calls (`api.system.*`) declare their changed tables in `SYSTEM_CHANGES` in `src/lib/db/dispatcher.ts`.
- Domain failures throw `DomainError` with a code from `ERROR_CODES` in `src/lib/domain/errors.ts`, and every code needs a message in `src/lib/i18n/errors.ts` (a test checks).
- Every user-facing string comes from Paraglide (`m.<key>()`), and `en.json` and `pt-BR.json` keep identical keys and placeholders (a test checks). Exports use fixed English column names (Decision 7) and the manifest is English (Decision 13).
- Links and navigation use `resolve()` from `$app/paths` with a route id.
- Phone layout is the default; `md:` (768px) is desktop. Dialogs are `ResponsiveDialog` (a bottom sheet on phones).
- Svelte 5 runes only. Call `useLive` during component initialization. Form writes go through `runAction` (inline message) or `runActionToast` (toast only).
- Never edit an applied migration. This plan adds no migration; its tests use extra migrations passed in explicitly.
- Formatting is Prettier (tabs, single quotes, width 100). `pnpm lint`, `pnpm check` and `pnpm test` stay clean at every commit. Run `pnpm test:e2e` whenever a task says to (it builds first, about 15 s, then runs Chromium).
- `docs/` is in `.prettierignore` on purpose: never run Prettier on it.
- Each commit message ends with a blank line followed by `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`. The commit commands below pass it as a second `-m`.
- sqlite-wasm prints `sqlite3_step() rc= …` lines when a statement fails on purpose in tests. That output is harmless.

## File Structure

```
src/lib/db/migrate.ts                  # Task 1: foreign keys off while migrating; injectable migrations
src/lib/db/image.ts                    # Task 2: database <-> .sqlite bytes (serialize / deserialize)
src/lib/db/system.ts                   # Task 2: FileStore, createSystem (open+migrate, copies, delete); Task 3: export/import
src/lib/db/worker.ts                   # Task 2: OPFS FileStore, wires createSystem
src/lib/db/testing.ts                  # Task 2: loadSqlite, memoryFileStore (tests only)
src/lib/db/backup.ts                   # Task 3: checkBackup (restore validation, spec §6)
src/lib/db/repos/dump.ts               # Task 6: the JSON export's data
src/lib/db/repos/reports.ts            # Task 8: spendingByCategory, netWorth
src/lib/db/repos/budget.bench.ts       # Task 11: recompute benchmark
src/lib/domain/net-worth.ts            # Task 8: month-end series
src/lib/domain/money.ts                # Task 9: formatMoneyCompact
src/lib/client/session.ts, registry.ts # Task 4: switch, update, delete, restore budgets
src/lib/client/app-state.svelte.ts     # Task 5: AppState.show; Task 9: formatCompact
src/lib/client/rpc.ts                  # Task 10: idle()
src/lib/backup/                        # Task 6: target (names), file-target, export-csv, reminder
                                       # Task 7: actions (backUp, CSV and JSON exports)
src/lib/reports/                       # Task 8: range presets, spending shares
src/lib/i18n/formats.ts                # Task 7: formatDateTime, formatBytes
src/lib/components/settings/           # Task 5: BudgetDetails, BudgetFiles; Task 7: BackupCard, RestoreDialog, StorageCard
src/lib/components/reports/            # Task 9: SpendingReport, NetWorthReport
src/lib/components/ui/chart/           # Task 9: shadcn-svelte chart (generated)
src/lib/components/app/                # Task 5: Boot, Onboarding (cancel); Task 7, 9: AppShell; Task 10: Boot (updates)
src/routes/reports/+page.svelte        # Task 9
src/routes/settings/+page.svelte       # Tasks 5, 7
static/icon.svg, static/*.png, pwa-assets.config.js   # Task 10
vite.config.ts, src/app.html, src/app.d.ts            # Task 10
e2e/settings, backup, reports, pwa .e2e.ts            # Tasks 5, 7, 9, 10
```

Unit tests sit next to their modules (`*.test.ts`). Playwright tests live in `e2e/`.

---

### Task 1: Run migrations with foreign keys off

Plan 1 follow-up: a migration that rebuilds a table (create the new table, copy, drop the old one, rename) must run with `PRAGMA foreign_keys = OFF`, which SQLite only lets you change outside a transaction. `migrate` now switches foreign keys off around the whole loop, checks `PRAGMA foreign_key_check` inside each migration's transaction (so a migration that leaves dangling references rolls back), and turns them back on. It also takes the migration list as a parameter, so tests (and Task 2) can pass extra migrations.

**Files:**
- Modify: `src/lib/db/migrate.ts`
- Test: `src/lib/db/migrate.test.ts`

**Interfaces:**
- Consumes: `MIGRATIONS`, `SCHEMA_VERSION`, `schemaVersion` (Plan 1).
- Produces:
  - `migrate(db: Db, migrations: readonly string[] = MIGRATIONS): void`: throws `SCHEMA_TOO_NEW` when the file is newer than `migrations.length`, and `INTERNAL` (rolled back) when a migration breaks foreign keys. Foreign keys are on again afterwards.

- [ ] **Step 1: Write the failing tests**

In `src/lib/db/migrate.test.ts`, replace:

```ts
import { describe, it, expect } from 'vitest';
import { createTestDb } from './testing';
import { migrate, schemaVersion, SCHEMA_VERSION } from './migrate';
import { all } from './connection';

```

with:

```ts
import { describe, it, expect } from 'vitest';
import { categoryId, createBudgetDb, createTestDb } from './testing';
import { MIGRATIONS, migrate, schemaVersion, SCHEMA_VERSION } from './migrate';
import { all, run } from './connection';

/** Rebuilds `categories` (the SQLite way to change a column), which other tables reference. */
const REBUILD_CATEGORIES = `
CREATE TABLE categories_new (
	id TEXT PRIMARY KEY,
	group_id TEXT NOT NULL REFERENCES category_groups (id),
	name TEXT NOT NULL,
	sort_order INTEGER NOT NULL DEFAULT 0,
	hidden INTEGER NOT NULL DEFAULT 0 CHECK (hidden IN (0, 1)),
	carryover_overspending INTEGER NOT NULL DEFAULT 0 CHECK (carryover_overspending IN (0, 1)),
	cc_account_id TEXT UNIQUE REFERENCES accounts (id),
	system TEXT UNIQUE CHECK (system IN ('ready_to_assign')),
	note TEXT NOT NULL DEFAULT ''
);
INSERT INTO categories_new (id, group_id, name, sort_order, hidden, carryover_overspending, cc_account_id, system)
	SELECT id, group_id, name, sort_order, hidden, carryover_overspending, cc_account_id, system FROM categories;
DROP TABLE categories;
ALTER TABLE categories_new RENAME TO categories;
`;

```

Then replace:

```ts

	it('enforces foreign keys', async () => {
```

with:

```ts

	it('rebuilds a referenced table without cascading deletes', async () => {
		const db = await createBudgetDb();
		run(
			db,
			"INSERT INTO budget_assignments (category_id, month, assigned) VALUES (?, '2026-09', 500)",
			[categoryId(db, 'Food')]
		);
		migrate(db, [...MIGRATIONS, REBUILD_CATEGORIES]);
		expect(schemaVersion(db)).toBe(SCHEMA_VERSION + 1);
		expect(all(db, 'SELECT assigned FROM budget_assignments')).toEqual([{ assigned: 500 }]);
		expect(db.selectValue('PRAGMA foreign_keys')).toBe(1);
	});

	it('rolls back a migration that breaks foreign keys', async () => {
		const db = await createBudgetDb();
		expect(() => migrate(db, [...MIGRATIONS, 'DELETE FROM category_groups'])).toThrow(
			expect.objectContaining({ code: 'INTERNAL' })
		);
		expect(schemaVersion(db)).toBe(SCHEMA_VERSION);
		expect(db.selectValue('SELECT count(*) FROM category_groups')).toBeGreaterThan(0);
		expect(db.selectValue('PRAGMA foreign_keys')).toBe(1);
	});

	it('enforces foreign keys', async () => {
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm test src/lib/db/migrate.test.ts`

Expected: 2 failures. "rebuilds a referenced table…" fails with `expected 1 to be 2` and "rolls back a migration…" with `expected function to throw an error`, because `migrate` ignores its second argument.

- [ ] **Step 3: Implement**

Replace the contents of `src/lib/db/migrate.ts` with:

```ts
import { DomainError } from '$lib/domain/errors';
import type { Db } from './connection';
import init from './migrations/0001_init.sql?raw';

export const MIGRATIONS: readonly string[] = [init];
export const SCHEMA_VERSION = MIGRATIONS.length;

export function schemaVersion(db: Db): number {
	return Number(db.selectValue('PRAGMA user_version'));
}

/**
 * Applies pending migrations in order, each in its own transaction. Foreign keys are off while
 * migrating (SQLite only lets that change outside a transaction), so a migration can rebuild a
 * table without cascading deletes. Each migration must leave `PRAGMA foreign_key_check` clean.
 */
export function migrate(db: Db, migrations: readonly string[] = MIGRATIONS): void {
	const current = schemaVersion(db);
	const target = migrations.length;
	if (current > target) {
		throw new DomainError(
			'SCHEMA_TOO_NEW',
			`Database schema ${current} is newer than this app (${target})`
		);
	}
	if (current === target) return;
	db.exec('PRAGMA foreign_keys = OFF');
	try {
		for (let v = current; v < target; v++) {
			db.transaction(() => {
				db.exec(migrations[v]);
				if (db.selectArrays('PRAGMA foreign_key_check').length > 0)
					throw new DomainError('INTERNAL', `Migration ${v + 1} left broken foreign keys`);
				db.exec(`PRAGMA user_version = ${v + 1}`);
			});
		}
	} finally {
		db.exec('PRAGMA foreign_keys = ON');
	}
}
```

- [ ] **Step 4: Run the tests**

Run: `pnpm test src/lib/db`

Expected: all pass. To see why foreign keys must be off, you can comment out the `PRAGMA foreign_keys = OFF` line: the rebuild test then fails with `expected [] to deeply equal [ { assigned: 500 } ]`, because dropping `categories` cascaded into `budget_assignments`. Put the line back.

- [ ] **Step 5: Verify and commit**

Run: `pnpm lint && pnpm check && pnpm test`

Expected: clean, 267 unit tests pass.

```bash
git add src/lib/db/migrate.ts src/lib/db/migrate.test.ts
git commit -m "fix: run migrations with foreign keys off so they can rebuild tables" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Budget file system over a FileStore, with pre-migration copies

Plan 1 follow-up (spec §7): before migrating an existing budget, save a timestamped copy and keep the last 3; and grow the SAH pool before creating files (it starts with room for 12). To test that in Node, the worker's file calls move into `createSystem` (`src/lib/db/system.ts`), which works over a `FileStore`: the worker passes one backed by the OPFS pool, and tests pass `memoryFileStore`, whose "files" are in-memory databases. `image.ts` converts between an open database and the bytes of a `.sqlite` file (`sqlite3_js_db_export` / `sqlite3_deserialize`); copies use it now, and export and restore use it in Task 3.

Databases only work with the SQLite module instance that created them, so `src/lib/db/testing.ts` gets one shared loader, `loadSqlite()`, that every test helper uses. The client test helper `createTestClient` now runs the real `createSystem` over `memoryFileStore` and becomes async.

**Files:**
- Create: `src/lib/db/image.ts`, `src/lib/db/system.ts`
- Modify: `src/lib/db/api.ts`, `src/lib/db/worker.ts`, `src/lib/db/testing.ts`, `src/lib/client/testing.ts`
- Test: `src/lib/db/system.test.ts` (new); `src/lib/db/dispatcher.test.ts`, `src/lib/client/rpc.test.ts`, `src/lib/client/session.test.ts` (adapted)

**Interfaces:**
- Consumes: `migrate(db, migrations)` (Task 1), `configure`, `createDispatcher`, `DispatcherDeps` (Plan 1).
- Produces:
  - `toImage(sqlite3: Sqlite3Static, db: Db): Uint8Array<ArrayBuffer>`; `openImage(sqlite3, bytes: Uint8Array): Db` (in-memory copy; the caller closes it).
  - `interface FileStore { list(): string[]; open(name): Db; close(db): void; write(name, bytes): Promise<void>; remove(name): void; reserve(count): Promise<void>; release(): void }`
  - `createSystem({ sqlite3, store, migrations?, now? }): { system: SystemApi; getDb(): Db | null }` (the shape `createDispatcher` takes).
  - `SystemApi.open(fileName): Promise<void>` (was `void`).
  - Test helpers: `loadSqlite(): Promise<Sqlite3Static>`, `memoryFileStore(sqlite3): FileStore & { files: Map<string, Db> }`, and `createTestClient(): Promise<{ client; files; close() }>` (now async).

- [ ] **Step 1: Write the failing tests**

Create `src/lib/db/system.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { MIGRATIONS, SCHEMA_VERSION, schemaVersion } from './migrate';
import { getMeta, initBudget } from './repos/meta';
import { createSystem } from './system';
import { loadSqlite, memoryFileStore } from './testing';

const FILE = 'budget-0190a000-0000-7000-8000-000000000001.sqlite3';
const OTHER = 'budget-0190a000-0000-7000-8000-000000000002.sqlite3';
const COPY_PREFIX = 'premigration-budget-0190a000-0000-7000-8000-000000000001-';

async function setup() {
	const sqlite3 = await loadSqlite();
	const store = memoryFileStore(sqlite3);
	return { sqlite3, store };
}

/** Creates FILE as a budget at the current schema version, then closes it. */
async function seedBudget(deps: Awaited<ReturnType<typeof setup>>) {
	const { system, getDb } = createSystem(deps);
	await system.open(FILE);
	initBudget(getDb()!, { name: 'Home', currency: 'BRL', locale: 'pt-BR', groups: [] });
	system.close();
}

/** A clock that moves one minute forward on every call. */
function ticking(start = Date.UTC(2026, 8, 19, 12, 0, 0)) {
	let t = start;
	return () => new Date((t += 60_000));
}

describe('createSystem', () => {
	it('creates and migrates new files, and lists only database files', async () => {
		const deps = await setup();
		const { system, getDb } = createSystem(deps);
		await system.open(FILE);
		expect(schemaVersion(getDb()!)).toBe(SCHEMA_VERSION);
		deps.store.files.set('notes.txt', deps.store.files.get(FILE)!);
		expect(system.listFiles()).toEqual([FILE]);
	});

	it('rejects file names the pool could not hold', async () => {
		const { system } = createSystem(await setup());
		await expect(system.open('../evil.sqlite3')).rejects.toMatchObject({ code: 'INVALID_INPUT' });
		expect(() => system.deleteFile('x.db')).toThrow(
			expect.objectContaining({ code: 'INVALID_INPUT' })
		);
	});

	it('makes room in the pool before opening a file', async () => {
		const deps = await setup();
		const reserve = vi.spyOn(deps.store, 'reserve');
		await createSystem(deps).system.open(FILE);
		expect(reserve).toHaveBeenCalledWith(3);
	});

	it('saves a copy of a budget before migrating it', async () => {
		const deps = await setup();
		await seedBudget(deps);
		const { system, getDb } = createSystem({
			...deps,
			migrations: [...MIGRATIONS, 'CREATE TABLE extra (x INTEGER)'],
			now: () => new Date('2026-09-19T12:34:56.789Z')
		});
		await system.open(FILE);
		expect(schemaVersion(getDb()!)).toBe(SCHEMA_VERSION + 1);
		const copy = `${COPY_PREFIX}20260919123456789.sqlite3`;
		expect(system.listFiles()).toEqual([FILE, copy]);
		const saved = deps.store.files.get(copy)!;
		expect(schemaVersion(saved)).toBe(SCHEMA_VERSION);
		expect(getMeta(saved).name).toBe('Home');
	});

	it('keeps the three newest copies', async () => {
		const deps = await setup();
		await seedBudget(deps);
		const now = ticking();
		const migrations = [...MIGRATIONS];
		for (let i = 1; i <= 4; i++) {
			migrations.push(`CREATE TABLE extra_${i} (x INTEGER)`);
			const { system } = createSystem({ ...deps, migrations: [...migrations], now });
			await system.open(FILE);
			system.close();
		}
		const copies = [...deps.store.files.keys()].filter((f) => f.startsWith(COPY_PREFIX)).sort();
		expect(copies).toHaveLength(3);
		expect(copies.map((c) => schemaVersion(deps.store.files.get(c)!))).toEqual([
			SCHEMA_VERSION + 1,
			SCHEMA_VERSION + 2,
			SCHEMA_VERSION + 3
		]);
	});

	it('does not copy new or current files', async () => {
		const deps = await setup();
		await seedBudget(deps);
		const { system } = createSystem(deps);
		await system.open(FILE);
		await system.open(OTHER);
		expect(system.listFiles().sort()).toEqual([FILE, OTHER]);
	});

	it('deletes a budget together with its copies', async () => {
		const deps = await setup();
		await seedBudget(deps);
		const upgraded = createSystem({ ...deps, migrations: [...MIGRATIONS, 'SELECT 1'] });
		await upgraded.system.open(FILE);
		await upgraded.system.open(OTHER);
		upgraded.system.deleteFile(FILE);
		expect(upgraded.system.listFiles()).toEqual([OTHER]);
	});

	it('closes the open file when it is deleted, and on release', async () => {
		const deps = await setup();
		const release = vi.spyOn(deps.store, 'release');
		const { system, getDb } = createSystem(deps);
		await system.open(FILE);
		system.deleteFile(FILE);
		expect(getDb()).toBeNull();
		await system.open(OTHER);
		system.release();
		expect(getDb()).toBeNull();
		expect(release).toHaveBeenCalledOnce();
	});
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm test src/lib/db/system.test.ts`

Expected: the file fails to load: `Cannot find module './system'` (and `loadSqlite` doesn't exist yet).

- [ ] **Step 3: Add the image helpers and the system**

Create `src/lib/db/image.ts`:

```ts
import type { Sqlite3Static } from '@sqlite.org/sqlite-wasm';
import type { Db } from './connection';

/** The bytes of a `.sqlite` file holding a copy of `db`. */
export function toImage(sqlite3: Sqlite3Static, db: Db): Uint8Array {
	return sqlite3.capi.sqlite3_js_db_export(db);
}

/** Opens an in-memory database holding a copy of a `.sqlite` file. The caller closes it. */
export function openImage(sqlite3: Sqlite3Static, bytes: Uint8Array): Db {
	const image = bytes.slice();
	// A WAL-mode file can't be read from memory. Mark it as rollback-journal, as the OPFS pool
	// does when it imports a file.
	if (image.length >= 20 && image[18] === 2 && image[19] === 2) image.set([1, 1], 18);
	const db = new sqlite3.oo1.DB(':memory:', 'c');
	const { capi, wasm } = sqlite3;
	const rc = capi.sqlite3_deserialize(
		db,
		'main',
		wasm.allocFromTypedArray(image),
		image.length,
		image.length,
		capi.SQLITE_DESERIALIZE_FREEONCLOSE | capi.SQLITE_DESERIALIZE_RESIZEABLE
	);
	if (rc !== 0) {
		db.close();
		throw new Error(`sqlite3_deserialize failed (${rc})`);
	}
	return db;
}
```

Create `src/lib/db/system.ts`:

```ts
import type { Sqlite3Static } from '@sqlite.org/sqlite-wasm';
import { DomainError } from '$lib/domain/errors';
import { configure, type Db } from './connection';
import { toImage } from './image';
import { MIGRATIONS, migrate, schemaVersion } from './migrate';
import type { SystemApi } from './api';

/** Where database files live: the OPFS SAH pool in the worker, in-memory databases in tests. */
export interface FileStore {
	/** File names, without a leading slash. */
	list(): string[];
	/** Opens a file, creating an empty database if it doesn't exist. */
	open(name: string): Db;
	close(db: Db): void;
	/** Creates or replaces a file with the bytes of a `.sqlite` file. */
	write(name: string, bytes: Uint8Array): Promise<void>;
	remove(name: string): void;
	/** Makes sure `count` more files fit next to the ones that exist now. */
	reserve(count: number): Promise<void>;
	/** Lets go of the storage so another tab can open it. */
	release(): void;
}

export interface SystemDeps {
	sqlite3: Sqlite3Static;
	store: FileStore;
	migrations?: readonly string[];
	now?: () => Date;
}

const FILE_NAME = /^[A-Za-z0-9_-]+\.sqlite3$/;
/** Room kept before creating a file: the file, its journal and the open database's journal. */
const SPARE_FILES = 3;
const KEPT_COPIES = 3;

function checkFileName(fileName: string): void {
	if (!FILE_NAME.test(fileName))
		throw new DomainError('INVALID_INPUT', `Bad file name ${fileName}`);
}

/** `budget-<id>.sqlite3` → `premigration-budget-<id>-`, the prefix of its pre-migration copies. */
function copyPrefix(fileName: string): string {
	return `premigration-${fileName.replace(/\.sqlite3$/, '')}-`;
}

/** The worker's file operations (spec §2, §7) over any FileStore. */
export function createSystem(deps: SystemDeps): { system: SystemApi; getDb: () => Db | null } {
	const { sqlite3, store } = deps;
	const migrations = deps.migrations ?? MIGRATIONS;
	const now = deps.now ?? (() => new Date());
	let db: Db | null = null;
	let openName: string | null = null;

	function closeDb(): void {
		if (db) store.close(db);
		db = null;
		openName = null;
	}

	function copiesOf(fileName: string): string[] {
		const prefix = copyPrefix(fileName);
		return store
			.list()
			.filter((n) => n.startsWith(prefix))
			.sort();
	}

	/** Saves `current` as a timestamped copy of `fileName` and keeps only the newest few. */
	async function saveCopy(fileName: string, current: Db): Promise<void> {
		const stamp = now().toISOString().replace(/\D/g, '');
		await store.write(`${copyPrefix(fileName)}${stamp}.sqlite3`, toImage(sqlite3, current));
		for (const old of copiesOf(fileName).slice(0, -KEPT_COPIES)) store.remove(old);
	}

	const system: SystemApi = {
		async open(fileName) {
			checkFileName(fileName);
			closeDb();
			await store.reserve(SPARE_FILES);
			const next = store.open(fileName);
			try {
				configure(next);
				const version = schemaVersion(next);
				if (version > 0 && version < migrations.length) await saveCopy(fileName, next);
				migrate(next, migrations);
			} catch (err) {
				store.close(next);
				throw err;
			}
			db = next;
			openName = fileName;
		},
		close: closeDb,
		listFiles() {
			return store.list().filter((n) => FILE_NAME.test(n));
		},
		deleteFile(fileName) {
			checkFileName(fileName);
			if (openName === fileName) closeDb();
			store.remove(fileName);
			for (const copy of copiesOf(fileName)) store.remove(copy);
		},
		release() {
			closeDb();
			store.release();
		}
	};
	return { system, getDb: () => db };
}
```

In `src/lib/db/api.ts`, replace:

```ts
export interface SystemApi {
	open(fileName: string): void;
	close(): void;
	listFiles(): string[];
	deleteFile(fileName: string): void;
```

with:

```ts
export interface SystemApi {
	/** Opens a budget file (creating it if needed) and migrates it, saving a copy first. */
	open(fileName: string): Promise<void>;
	close(): void;
	listFiles(): string[];
	/** Deletes a budget file and its pre-migration copies. */
	deleteFile(fileName: string): void;
```

- [ ] **Step 4: Add the test helpers**

Replace the contents of `src/lib/db/testing.ts` with:

```ts
import sqlite3InitModule, { type Sqlite3Static } from '@sqlite.org/sqlite-wasm';
import { configure, one, type Db } from './connection';
import { openImage } from './image';
import { migrate } from './migrate';
import { initBudget } from './repos/meta';
import type { FileStore } from './system';

let sqlite: Promise<Sqlite3Static> | undefined;

/**
 * The SQLite module shared by every test helper. Databases only work with the module that
 * created them, so tests must not load their own. Test-only.
 */
export function loadSqlite(): Promise<Sqlite3Static> {
	sqlite ??= sqlite3InitModule();
	return sqlite;
}

/** A fresh, migrated in-memory database. Test-only. */
export async function createTestDb(): Promise<Db> {
	const s = await loadSqlite();
	const db = new s.oo1.DB(':memory:', 'c');
	configure(db);
	migrate(db);
	return db;
}

/** A migrated database with an initialized BRL budget: Bills (Rent, Utilities), Everyday (Food, Fun). */
export async function createBudgetDb(): Promise<Db> {
	const db = await createTestDb();
	initBudget(db, {
		name: 'Test Budget',
		currency: 'BRL',
		locale: 'pt-BR',
		groups: [
			{ name: 'Bills', categories: ['Rent', 'Utilities'] },
			{ name: 'Everyday', categories: ['Food', 'Fun'] }
		]
	});
	return db;
}

/** Looks up a category id by name (test convenience). */
export function categoryId(db: Db, name: string): string {
	const row = one<{ id: string }>(db, 'SELECT id FROM categories WHERE name = ?', [name]);
	if (!row) throw new Error(`No category named ${name}`);
	return row.id;
}

/**
 * A FileStore whose files are in-memory databases, kept in `files`. Closing a file keeps its
 * database (it *is* the file). Test-only.
 */
export function memoryFileStore(sqlite3: Sqlite3Static): FileStore & { files: Map<string, Db> } {
	const files = new Map<string, Db>();
	return {
		files,
		list: () => [...files.keys()],
		open(name) {
			let db = files.get(name);
			if (!db) {
				db = new sqlite3.oo1.DB(':memory:', 'c');
				files.set(name, db);
			}
			return db;
		},
		close() {},
		async write(name, bytes) {
			files.get(name)?.close();
			files.set(name, openImage(sqlite3, bytes));
		},
		remove(name) {
			files.get(name)?.close();
			files.delete(name);
		},
		async reserve() {},
		release() {}
	};
}
```

Replace the contents of `src/lib/client/testing.ts` with:

```ts
import type { Db } from '$lib/db/connection';
import { createDispatcher } from '$lib/db/dispatcher';
import { createSystem } from '$lib/db/system';
import { loadSqlite, memoryFileStore } from '$lib/db/testing';
import { REGISTRY_KEY, type KeyValueStore } from './registry';
import { createRpcClient, type RpcClient } from './rpc';

/** A Map-backed KeyValueStore, optionally pre-filled with a raw registry value. Test-only. */
export function memoryStore(registry?: string): KeyValueStore & { data: Map<string, string> } {
	const data = new Map<string, string>();
	if (registry !== undefined) data.set(REGISTRY_KEY, registry);
	return {
		data,
		getItem: (k) => data.get(k) ?? null,
		setItem: (k, v) => void data.set(k, v)
	};
}

/**
 * An RPC client talking to the worker's real dispatcher and system calls over a MessageChannel,
 * like the app talks to the worker. Budget "files" are in-memory databases kept in `files`.
 * Test-only.
 */
export async function createTestClient(): Promise<{
	client: RpcClient;
	files: Map<string, Db>;
	close(): void;
}> {
	const sqlite3 = await loadSqlite();
	const store = memoryFileStore(sqlite3);
	const dispatch = createDispatcher(createSystem({ sqlite3, store }));
	const channel = new MessageChannel();
	channel.port2.onmessage = async (e) => channel.port2.postMessage(await dispatch(e.data));
	return {
		client: createRpcClient(channel.port1),
		files: store.files,
		close() {
			channel.port1.close();
			channel.port2.close();
			for (const db of store.files.values()) db.close();
		}
	};
}
```

`createTestClient` is async now, so update its only caller.

In `src/lib/client/session.test.ts`, replace:

```ts

function setup() {
	const test = createTestClient();
	clients.push(test);
```

with:

```ts

async function setup() {
	const test = await createTestClient();
	clients.push(test);
```

Then replace:

```ts
	it('starts onboarding when there is no budget yet', async () => {
		const { api, store } = setup();
		expect(await openLastBudget(api, store)).toEqual({ kind: 'onboarding' });
	});

	it('reopens the budget created last', async () => {
		const { api, store } = setup();
		const { file } = await createBudget(api, store, HOME);
```

with:

```ts
	it('starts onboarding when there is no budget yet', async () => {
		const { api, store } = await setup();
		expect(await openLastBudget(api, store)).toEqual({ kind: 'onboarding' });
	});

	it('reopens the budget created last', async () => {
		const { api, store } = await setup();
		const { file } = await createBudget(api, store, HOME);
```

Then replace:

```ts
	it('rebuilds a lost registry from the budget files', async () => {
		const { api, store } = setup();
		const { file } = await createBudget(api, store, HOME);
```

with:

```ts
	it('rebuilds a lost registry from the budget files', async () => {
		const { api, store } = await setup();
		const { file } = await createBudget(api, store, HOME);
```

Then replace:

```ts
	it('deletes files left behind by an interrupted onboarding', async () => {
		const { api, store, files } = setup();
		files.set(newBudgetFile(), await createTestDb());
```

with:

```ts
	it('deletes files left behind by an interrupted onboarding', async () => {
		const { api, store, files } = await setup();
		files.set(newBudgetFile(), await createTestDb());
```

Then replace:

```ts
	it('creates the budget, its categories and its first account', async () => {
		const { api, store } = setup();
		const { file, meta } = await createBudget(api, store, HOME);
```

with:

```ts
	it('creates the budget, its categories and its first account', async () => {
		const { api, store } = await setup();
		const { file, meta } = await createBudget(api, store, HOME);
```

Then replace:

```ts
	it('removes the new file when setup fails', async () => {
		const { api, store, files } = setup();
		const err = await createBudget(api, store, { ...HOME, currency: 'XYZ' }).catch((e) => e);
```

with:

```ts
	it('removes the new file when setup fails', async () => {
		const { api, store, files } = await setup();
		const err = await createBudget(api, store, { ...HOME, currency: 'XYZ' }).catch((e) => e);
```

The fake systems in two tests must return a promise from `open`:

In `src/lib/db/dispatcher.test.ts`, replace:

```ts
		system: {
			open: (name) => void opened.push(name),
			close: () => {},
```

with:

```ts
		system: {
			open: async (name) => void opened.push(name),
			close: () => {},
```

In `src/lib/client/rpc.test.ts`, replace:

```ts
		system: {
			open: () => {},
			close: () => {},
```

with:

```ts
		system: {
			open: async () => {},
			close: () => {},
```

- [ ] **Step 5: Run the worker on createSystem**

Replace the contents of `src/lib/db/worker.ts` with:

```ts
/// <reference lib="webworker" />
import sqlite3InitModule, { type SAHPoolUtil, type Sqlite3Static } from '@sqlite.org/sqlite-wasm';
import { DomainError } from '$lib/domain/errors';
import { createDispatcher } from './dispatcher';
import { createSystem, type FileStore } from './system';
import type { CallRequest } from './protocol';

const POOL_ATTEMPTS = 5;

async function initPool(): Promise<{ sqlite3: Sqlite3Static; pool: SAHPoolUtil }> {
	let lastError: unknown;
	try {
		const sqlite3 = await sqlite3InitModule();
		// A tab that just handed over may still be letting go of its file handles, so retry briefly.
		// `forceReinitIfPreviouslyFailed` is supported by sqlite-wasm but missing from its types.
		const options = { name: 'moneta', initialCapacity: 12, forceReinitIfPreviouslyFailed: true };
		for (let attempt = 1; attempt <= POOL_ATTEMPTS; attempt++) {
			try {
				return { sqlite3, pool: await sqlite3.installOpfsSAHPoolVfs(options) };
			} catch (err) {
				lastError = err;
				await new Promise((r) => setTimeout(r, 200 * attempt));
			}
		}
	} catch (err) {
		lastError = err;
	}
	throw new DomainError(
		'STORAGE_UNAVAILABLE',
		lastError instanceof Error ? lastError.message : 'OPFS is not available'
	);
}

/** Budget files in the OPFS SAH pool. Pool paths start with a slash; file names don't. */
function opfsStore(pool: SAHPoolUtil): FileStore {
	return {
		list: () => pool.getFileNames().map((n) => n.replace(/^\//, '')),
		open: (name) => new pool.OpfsSAHPoolDb(`/${name}`),
		close: (db) => db.close(),
		async write(name, bytes) {
			await pool.importDb(`/${name}`, bytes);
		},
		remove(name) {
			pool.unlink(`/${name}`);
		},
		async reserve(count) {
			// The pool only grows on request, and it starts with room for 12 files.
			await pool.reserveMinimumCapacity(pool.getFileCount() + count);
		},
		release() {
			if (!pool.isPaused()) pool.pauseVfs();
		}
	};
}

const dispatchReady = initPool().then(({ sqlite3, pool }) =>
	createDispatcher(createSystem({ sqlite3, store: opfsStore(pool) }))
);

self.onmessage = async (event: MessageEvent<CallRequest>) => {
	const req = event.data;
	try {
		const dispatch = await dispatchReady;
		self.postMessage(await dispatch(req));
	} catch (err) {
		const e = err instanceof DomainError ? err : new DomainError('INTERNAL', String(err));
		self.postMessage({ id: req.id, ok: false, error: { code: e.code, message: e.message } });
	}
};
```

- [ ] **Step 6: Run the tests and the browser tests**

Run: `pnpm test`

Expected: all 275 pass.

Run: `pnpm lint && pnpm check`

Expected: clean.

Run: `pnpm test:e2e`

Expected: all 14 e2e tests pass (the worker now opens files through `createSystem` and the OPFS store).

- [ ] **Step 7: Commit**

```bash
git add src/lib/db src/lib/client/testing.ts src/lib/client/session.test.ts src/lib/client/rpc.test.ts
git commit -m "feat: save a copy of each budget before migrating it" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Export the open budget and check backups before restoring

`api.system.exportFile()` returns the open budget as `.sqlite` bytes. `api.system.importFile(fileName, bytes)` runs `checkBackup` (spec §6, in order: SQLite header, `PRAGMA integrity_check`, the `meta` table, a known schema version; older files are migrated) on an in-memory copy, then writes the checked file under a new name and leaves it closed. It never overwrites an existing file, so restoring can't damage the open budget (Decision 4). Each failed check has its own translated error.

**Files:**
- Create: `src/lib/db/backup.ts`
- Modify: `src/lib/db/system.ts`, `src/lib/db/image.ts`, `src/lib/db/api.ts`, `src/lib/db/dispatcher.ts`, `src/lib/domain/errors.ts`, `src/lib/i18n/errors.ts`, `src/lib/i18n/messages/en.json`, `src/lib/i18n/messages/pt-BR.json`
- Test: `src/lib/db/backup.test.ts` (new), `src/lib/db/system.test.ts`; fakes in `src/lib/db/dispatcher.test.ts`, `src/lib/client/rpc.test.ts`

**Interfaces:**
- Consumes: `toImage`, `openImage`, `createSystem` (Task 2), `migrate` (Task 1), `isInitialized` (Plan 1).
- Produces:
  - `checkBackup(sqlite3, bytes: Uint8Array, migrations = MIGRATIONS): Uint8Array<ArrayBuffer>`, throwing `BACKUP_NOT_SQLITE`, `BACKUP_DAMAGED`, `BACKUP_NOT_MONETA` or `SCHEMA_TOO_NEW`.
  - `SystemApi.exportFile(): Uint8Array<ArrayBuffer>` (`NO_DATABASE_OPEN` without an open budget) and `SystemApi.importFile(fileName: string, bytes: Uint8Array): Promise<void>` (`INVALID_INPUT` if the file exists). Neither reports changed tables.
  - Error codes `BACKUP_NOT_SQLITE`, `BACKUP_DAMAGED`, `BACKUP_NOT_MONETA` with messages `error_backup_not_sqlite`, `error_backup_damaged`, `error_backup_not_moneta`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/db/backup.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { checkBackup } from './backup';
import { openImage, toImage } from './image';
import { MIGRATIONS, SCHEMA_VERSION, schemaVersion } from './migrate';
import { getMeta } from './repos/meta';
import { createBudgetDb, createTestDb, loadSqlite } from './testing';

async function budgetImage(): Promise<Uint8Array> {
	return toImage(await loadSqlite(), await createBudgetDb());
}

describe('checkBackup', () => {
	it('returns a file that opens as the same budget', async () => {
		const sqlite3 = await loadSqlite();
		const db = openImage(sqlite3, checkBackup(sqlite3, await budgetImage()));
		expect(getMeta(db).name).toBe('Test Budget');
		db.close();
	});

	it('rejects files that are not SQLite databases', async () => {
		const sqlite3 = await loadSqlite();
		const text = new TextEncoder().encode('Date,Payee,Amount\n'.repeat(64));
		expect(() => checkBackup(sqlite3, text)).toThrow(
			expect.objectContaining({ code: 'BACKUP_NOT_SQLITE' })
		);
		const truncated = (await budgetImage()).slice(0, 1000);
		expect(() => checkBackup(sqlite3, truncated)).toThrow(
			expect.objectContaining({ code: 'BACKUP_NOT_SQLITE' })
		);
	});

	it('rejects damaged files', async () => {
		const sqlite3 = await loadSqlite();
		const bytes = await budgetImage();
		bytes.fill(0xff, 4096, 8192);
		expect(() => checkBackup(sqlite3, bytes)).toThrow(
			expect.objectContaining({ code: 'BACKUP_DAMAGED' })
		);
	});

	it('rejects SQLite files that are not Moneta budgets', async () => {
		const sqlite3 = await loadSqlite();
		const other = new sqlite3.oo1.DB(':memory:', 'c');
		other.exec('CREATE TABLE notes (text TEXT)');
		expect(() => checkBackup(sqlite3, toImage(sqlite3, other))).toThrow(
			expect.objectContaining({ code: 'BACKUP_NOT_MONETA' })
		);
		const neverSetUp = toImage(sqlite3, await createTestDb());
		expect(() => checkBackup(sqlite3, neverSetUp)).toThrow(
			expect.objectContaining({ code: 'BACKUP_NOT_MONETA' })
		);
	});

	it('rejects budgets from a newer app', async () => {
		const sqlite3 = await loadSqlite();
		const db = await createBudgetDb();
		db.exec(`PRAGMA user_version = ${SCHEMA_VERSION + 1}`);
		expect(() => checkBackup(sqlite3, toImage(sqlite3, db))).toThrow(
			expect.objectContaining({ code: 'SCHEMA_TOO_NEW' })
		);
	});

	it('migrates budgets from an older app', async () => {
		const sqlite3 = await loadSqlite();
		const image = checkBackup(sqlite3, await budgetImage(), [
			...MIGRATIONS,
			'CREATE TABLE extra (x INTEGER)'
		]);
		const db = openImage(sqlite3, image);
		expect(schemaVersion(db)).toBe(SCHEMA_VERSION + 1);
		db.close();
	});

	it('accepts files saved in WAL mode', async () => {
		const sqlite3 = await loadSqlite();
		const bytes = await budgetImage();
		bytes.set([2, 2], 18);
		const db = openImage(sqlite3, checkBackup(sqlite3, bytes));
		expect(getMeta(db).name).toBe('Test Budget');
		db.close();
	});
});
```

In `src/lib/db/system.test.ts`, replace:

```ts
	});
});
```

with:

```ts
	});
});

describe('exportFile / importFile', () => {
	it('exports the open budget and imports it as a new file', async () => {
		const deps = await setup();
		await seedBudget(deps);
		const { system, getDb } = createSystem(deps);
		await system.open(FILE);
		const bytes = system.exportFile();
		await system.importFile(OTHER, bytes);
		expect(getDb()).not.toBeNull();
		await system.open(OTHER);
		expect(getMeta(getDb()!).name).toBe('Home');
	});

	it('needs an open budget to export', async () => {
		const { system } = createSystem(await setup());
		expect(() => system.exportFile()).toThrow(
			expect.objectContaining({ code: 'NO_DATABASE_OPEN' })
		);
	});

	it('never overwrites a file, and keeps nothing from an invalid backup', async () => {
		const deps = await setup();
		await seedBudget(deps);
		const { system } = createSystem(deps);
		await system.open(FILE);
		const bytes = system.exportFile();
		await expect(system.importFile(FILE, bytes)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
		await expect(system.importFile(OTHER, new Uint8Array(4096))).rejects.toMatchObject({
			code: 'BACKUP_NOT_SQLITE'
		});
		expect(system.listFiles()).toEqual([FILE]);
	});
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm test src/lib/db/backup.test.ts src/lib/db/system.test.ts`

Expected: `backup.test.ts` fails to load (`Cannot find module './backup'`), and the 3 new system tests fail (`system.exportFile is not a function`).

- [ ] **Step 3: Add the error codes and their messages**

In `src/lib/domain/errors.ts`, replace:

```ts
	'TRANSFER_INVALID',
	'WORKER_FAILED',
```

with:

```ts
	'TRANSFER_INVALID',
	'BACKUP_NOT_SQLITE',
	'BACKUP_DAMAGED',
	'BACKUP_NOT_MONETA',
	'WORKER_FAILED',
```

In `src/lib/i18n/errors.ts`, replace:

```ts
	TRANSFER_INVALID: m.error_transfer_invalid,
	WORKER_FAILED: m.error_worker_failed,
```

with:

```ts
	TRANSFER_INVALID: m.error_transfer_invalid,
	BACKUP_NOT_SQLITE: m.error_backup_not_sqlite,
	BACKUP_DAMAGED: m.error_backup_damaged,
	BACKUP_NOT_MONETA: m.error_backup_not_moneta,
	WORKER_FAILED: m.error_worker_failed,
```

In `src/lib/i18n/messages/en.json`, replace:

```json
	"error_transfer_invalid": "Choose another account to transfer to.",
	"error_worker_failed": "The database stopped. Reload to continue.",
```

with:

```json
	"error_transfer_invalid": "Choose another account to transfer to.",
	"error_backup_not_sqlite": "That file isn't a Moneta backup (.sqlite).",
	"error_backup_damaged": "That backup is damaged and can't be restored.",
	"error_backup_not_moneta": "That database isn't a Moneta budget.",
	"error_worker_failed": "The database stopped. Reload to continue.",
```

In `src/lib/i18n/messages/pt-BR.json`, replace:

```json
	"error_transfer_invalid": "Escolha outra conta para a transferência.",
	"error_worker_failed": "O banco de dados parou. Recarregue para continuar.",
```

with:

```json
	"error_transfer_invalid": "Escolha outra conta para a transferência.",
	"error_backup_not_sqlite": "Esse arquivo não é um backup do Moneta (.sqlite).",
	"error_backup_damaged": "Esse backup está danificado e não pode ser restaurado.",
	"error_backup_not_moneta": "Esse banco de dados não é um orçamento do Moneta.",
	"error_worker_failed": "O banco de dados parou. Recarregue para continuar.",
```

- [ ] **Step 4: Implement the check, export and import**

Create `src/lib/db/backup.ts`:

```ts
import type { Sqlite3Static } from '@sqlite.org/sqlite-wasm';
import { DomainError } from '$lib/domain/errors';
import { configure, one, type Db } from './connection';
import { openImage, toImage } from './image';
import { MIGRATIONS, migrate, schemaVersion } from './migrate';
import { isInitialized } from './repos/meta';

const HEADER = 'SQLite format 3\0';

/** SQLite files start with a fixed header and are made of whole pages (512 bytes at least). */
function looksLikeSqlite(bytes: Uint8Array): boolean {
	if (bytes.length < 512 || bytes.length % 512 !== 0) return false;
	for (let i = 0; i < HEADER.length; i++) if (bytes[i] !== HEADER.charCodeAt(i)) return false;
	return true;
}

function isIntact(db: Db): boolean {
	try {
		return db.selectValues('PRAGMA integrity_check').join() === 'ok';
	} catch {
		return false; // e.g. SQLITE_NOTADB or SQLITE_CORRUPT
	}
}

/**
 * Checks a `.sqlite` backup before it may replace anything (spec §6, in this order): the SQLite
 * header, `PRAGMA integrity_check`, the `meta` table, and a schema version this app knows.
 * Older budgets are migrated. Returns the checked, migrated file. Works on an in-memory copy.
 */
export function checkBackup(
	sqlite3: Sqlite3Static,
	bytes: Uint8Array,
	migrations: readonly string[] = MIGRATIONS
): Uint8Array {
	if (!looksLikeSqlite(bytes)) throw new DomainError('BACKUP_NOT_SQLITE');
	let db: Db;
	try {
		db = openImage(sqlite3, bytes);
	} catch {
		throw new DomainError('BACKUP_DAMAGED');
	}
	try {
		if (!isIntact(db)) throw new DomainError('BACKUP_DAMAGED');
		const hasMeta = one(
			db,
			"SELECT 1 AS x FROM sqlite_master WHERE type = 'table' AND name = 'meta'"
		);
		if (!hasMeta || schemaVersion(db) < 1) throw new DomainError('BACKUP_NOT_MONETA');
		configure(db);
		migrate(db, migrations);
		if (!isInitialized(db)) throw new DomainError('BACKUP_NOT_MONETA');
		return toImage(sqlite3, db);
	} finally {
		db.close();
	}
}
```

`sqlite3_js_db_export` returns a `Uint8Array<ArrayBuffer>`; keep that type so the bytes can go into a `Blob` in Task 7.

In `src/lib/db/image.ts`, replace:

```ts
/** The bytes of a `.sqlite` file holding a copy of `db`. */
export function toImage(sqlite3: Sqlite3Static, db: Db): Uint8Array {
	return sqlite3.capi.sqlite3_js_db_export(db);
```

with:

```ts
/** The bytes of a `.sqlite` file holding a copy of `db`. */
export function toImage(sqlite3: Sqlite3Static, db: Db): Uint8Array<ArrayBuffer> {
	return sqlite3.capi.sqlite3_js_db_export(db);
```

In `src/lib/db/system.ts`, replace:

```ts
import { DomainError } from '$lib/domain/errors';
import { configure, type Db } from './connection';
```

with:

```ts
import { DomainError } from '$lib/domain/errors';
import { checkBackup } from './backup';
import { configure, type Db } from './connection';
```

Then replace:

```ts
			store.release();
		}
```

with:

```ts
			store.release();
		},
		exportFile() {
			if (!db) throw new DomainError('NO_DATABASE_OPEN');
			return toImage(sqlite3, db);
		},
		async importFile(fileName, bytes) {
			checkFileName(fileName);
			if (store.list().includes(fileName))
				throw new DomainError('INVALID_INPUT', `${fileName} already exists`);
			const image = checkBackup(sqlite3, bytes, migrations);
			await store.reserve(SPARE_FILES);
			await store.write(fileName, image);
		}
```

In `src/lib/db/api.ts`, replace:

```ts
	release(): void;
}
```

with:

```ts
	release(): void;
	/** The open budget as the bytes of a `.sqlite` file. */
	exportFile(): Uint8Array<ArrayBuffer>;
	/** Checks a `.sqlite` backup, migrates it and saves it as a new file, left closed. */
	importFile(fileName: string, bytes: Uint8Array): Promise<void>;
}
```

In `src/lib/db/dispatcher.ts`, replace:

```ts
	deleteFile: [],
	release: []
} as const;
```

with:

```ts
	deleteFile: [],
	release: [],
	exportFile: [],
	importFile: []
} as const;
```

The fake systems need the two new calls:

In `src/lib/db/dispatcher.test.ts`, replace:

```ts
			deleteFile: () => {},
			release: () => {}
		}
```

with:

```ts
			deleteFile: () => {},
			release: () => {},
			exportFile: () => new Uint8Array(),
			importFile: async () => {}
		}
```

In `src/lib/client/rpc.test.ts`, replace:

```ts
			deleteFile: () => {},
			release: () => {}
		}
```

with:

```ts
			deleteFile: () => {},
			release: () => {},
			exportFile: () => new Uint8Array(),
			importFile: async () => {}
		}
```

- [ ] **Step 5: Run the tests**

Run: `pnpm test`

Expected: all 285 pass, including `errorMessage` translating the three new codes.

- [ ] **Step 6: Verify and commit**

Run: `pnpm lint && pnpm check`

Expected: clean.

```bash
git add src/lib/db src/lib/domain/errors.ts src/lib/i18n src/lib/client/rpc.test.ts
git commit -m "feat: export budgets as .sqlite files and check backups before restoring them" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Switch, update, delete and restore budget files

Main-thread session functions for Settings, all tested against the real dispatcher through `createTestClient`. They keep the localStorage registry in step with the files. `restoreBudget` imports the backup as a new file and opens it; with `replace` it then deletes the budget that was open. If the restored file can't be opened, it deletes it and reopens the old one.

**Files:**
- Modify: `src/lib/client/registry.ts`, `src/lib/client/session.ts`
- Test: `src/lib/client/registry.test.ts`, `src/lib/client/session.test.ts`

**Interfaces:**
- Consumes: `api.system.importFile`, `api.system.exportFile` (Task 3), `openLastBudget`, `createBudget`, registry helpers (Plan 2).
- Produces:
  - `removeBudget(registry: Registry, file: string): Registry`
  - `switchBudget(api, store, file): Promise<{ file; meta }>`
  - `updateBudget(api, store, file, patch: MetaPatch): Promise<void>` (renames in the registry too)
  - `deleteBudget(api, store, file, openFile): Promise<OpenResult | null>`: `null` when another budget was deleted; otherwise what opened next (`ready` or `onboarding`)
  - `restoreBudget(api, store, bytes: Uint8Array, openFile: string, replace: boolean): Promise<{ file; meta }>`

- [ ] **Step 1: Write the failing tests**

In `src/lib/client/registry.test.ts`, replace:

```ts
	reconcile,
	saveRegistry,
```

with:

```ts
	reconcile,
	removeBudget,
	saveRegistry,
```

Then replace:

```ts
			lastOpened: B
		});
	});
});
```

with:

```ts
			lastOpened: B
		});
	});
});

describe('removeBudget', () => {
	it('drops the entry and forgets it as the last opened file', () => {
		const registry = {
			budgets: [
				{ file: A, name: 'Home' },
				{ file: B, name: 'Work' }
			],
			lastOpened: B
		};
		expect(removeBudget(registry, B)).toEqual({
			budgets: [{ file: A, name: 'Home' }],
			lastOpened: null
		});
		expect(removeBudget(registry, A).lastOpened).toBe(B);
	});
});
```

In `src/lib/client/session.test.ts`, replace:

```ts
import { RpcError } from './rpc';
import { createBudget, openLastBudget, startupError, type NewBudget } from './session';
import { createTestClient, memoryStore } from './testing';
```

with:

```ts
import { RpcError } from './rpc';
import {
	createBudget,
	deleteBudget,
	openLastBudget,
	restoreBudget,
	startupError,
	switchBudget,
	updateBudget,
	type NewBudget,
	type SessionApi
} from './session';
import { createTestClient, memoryStore } from './testing';
```

Then replace:

```ts

describe('startupError', () => {
```

with:

```ts

describe('switchBudget / updateBudget', () => {
	it('opens another budget and remembers it', async () => {
		const { api, store } = await setup();
		const home = await createBudget(api, store, HOME);
		await createBudget(api, store, { ...HOME, name: 'Work' });
		expect(await switchBudget(api, store, home.file)).toMatchObject({
			file: home.file,
			meta: { name: 'Home' }
		});
		expect(loadRegistry(store).lastOpened).toBe(home.file);
	});

	it('renames the open budget in its file and in the registry', async () => {
		const { api, store } = await setup();
		const { file } = await createBudget(api, store, HOME);
		await updateBudget(api, store, file, { name: 'House', locale: 'en-US' });
		expect(await api.meta.get()).toMatchObject({ name: 'House', locale: 'en-US' });
		expect(loadRegistry(store).budgets).toEqual([{ file, name: 'House' }]);
	});
});

describe('deleteBudget', () => {
	it('deletes another budget and keeps the open one', async () => {
		const { api, store, files } = await setup();
		const home = await createBudget(api, store, HOME);
		const work = await createBudget(api, store, { ...HOME, name: 'Work' });
		expect(await deleteBudget(api, store, home.file, work.file)).toBeNull();
		expect([...files.keys()]).toEqual([work.file]);
		expect(loadRegistry(store).budgets).toEqual([{ file: work.file, name: 'Work' }]);
		expect((await api.meta.get()).name).toBe('Work');
	});

	it('opens the next budget after deleting the open one, or onboarding after the last', async () => {
		const { api, store } = await setup();
		const home = await createBudget(api, store, HOME);
		const work = await createBudget(api, store, { ...HOME, name: 'Work' });
		expect(await deleteBudget(api, store, work.file, work.file)).toMatchObject({
			kind: 'ready',
			file: home.file
		});
		expect(await deleteBudget(api, store, home.file, home.file)).toEqual({ kind: 'onboarding' });
	});
});

describe('restoreBudget', () => {
	it('replaces the open budget with a backup', async () => {
		const { api, store, files } = await setup();
		const { file } = await createBudget(api, store, HOME);
		const backup = await api.system.exportFile();
		await api.meta.update({ name: 'Changed' });
		const restored = await restoreBudget(api, store, backup, file, true);
		expect(restored.file).not.toBe(file);
		expect(restored.meta.name).toBe('Home');
		expect([...files.keys()]).toEqual([restored.file]);
		expect(loadRegistry(store)).toEqual({
			budgets: [{ file: restored.file, name: 'Home' }],
			lastOpened: restored.file
		});
		const [account] = await api.accounts.list();
		expect(account).toMatchObject({ name: 'Checking', balance: 150000 });
	});

	it('imports a backup as a new budget', async () => {
		const { api, store, files } = await setup();
		const { file } = await createBudget(api, store, HOME);
		const restored = await restoreBudget(api, store, await api.system.exportFile(), file, false);
		expect(files.size).toBe(2);
		expect(loadRegistry(store).budgets.map((b) => b.file)).toEqual([file, restored.file]);
		expect(loadRegistry(store).lastOpened).toBe(restored.file);
	});

	it('leaves the open budget alone when the backup is invalid', async () => {
		const { api, store, files } = await setup();
		const { file } = await createBudget(api, store, HOME);
		const err = await restoreBudget(api, store, new Uint8Array(512), file, true).catch((e) => e);
		expect(err).toMatchObject({ code: 'BACKUP_NOT_SQLITE' });
		expect([...files.keys()]).toEqual([file]);
		expect((await api.meta.get()).name).toBe('Home');
	});

	it('reopens the open budget if the restored one cannot be opened', async () => {
		const { api, store, files } = await setup();
		const { file } = await createBudget(api, store, HOME);
		const backup = await api.system.exportFile();
		const failing: SessionApi = {
			meta: api.meta,
			accounts: api.accounts,
			system: {
				...pick(api.system),
				open: (name: string) =>
					name === file ? api.system.open(name) : Promise.reject(new Error('disk error'))
			}
		};
		await expect(restoreBudget(failing, store, backup, file, true)).rejects.toThrow('disk error');
		expect([...files.keys()]).toEqual([file]);
		expect((await api.meta.get()).name).toBe('Home');
	});
});

/** Copies the system calls off the RPC proxy (a proxy has no own keys to spread). */
function pick(system: SessionApi['system']): SessionApi['system'] {
	return {
		open: system.open,
		close: system.close,
		listFiles: system.listFiles,
		deleteFile: system.deleteFile,
		release: system.release,
		exportFile: system.exportFile,
		importFile: system.importFile
	};
}

describe('startupError', () => {
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm test src/lib/client`

Expected: 9 failures, all `… is not a function` (`removeBudget`, `switchBudget`, `updateBudget`, `deleteBudget`, `restoreBudget`).

- [ ] **Step 3: Implement**

In `src/lib/client/registry.ts`, replace:

```ts
	return { ...registry, lastOpened: file };
}
```

with:

```ts
	return { ...registry, lastOpened: file };
}

export function removeBudget(registry: Registry, file: string): Registry {
	return {
		budgets: registry.budgets.filter((b) => b.file !== file),
		lastOpened: registry.lastOpened === file ? null : registry.lastOpened
	};
}
```

In `src/lib/client/session.ts`, replace:

```ts
import type { CreateAccountInput } from '$lib/db/repos/accounts';
import type { BudgetMeta, InitBudgetInput } from '$lib/db/repos/meta';
import {
```

with:

```ts
import type { CreateAccountInput } from '$lib/db/repos/accounts';
import type { BudgetMeta, InitBudgetInput, MetaPatch } from '$lib/db/repos/meta';
import {
```

Then replace:

```ts
	reconcile,
	saveRegistry,
```

with:

```ts
	reconcile,
	removeBudget,
	saveRegistry,
```

Then replace:

```ts

export type StartupErrorCode =
```

with:

```ts

/** Opens another budget file and remembers it as the last one opened. */
export async function switchBudget(
	api: SessionApi,
	store: KeyValueStore,
	file: string
): Promise<{ file: string; meta: BudgetMeta }> {
	await api.system.open(file);
	const meta = await api.meta.get();
	saveRegistry(
		store,
		markOpened(upsertBudget(loadRegistry(store), { file, name: meta.name }), file)
	);
	return { file, meta };
}

/** Changes the open budget's name, currency or locale, keeping the registry's name in step. */
export async function updateBudget(
	api: SessionApi,
	store: KeyValueStore,
	file: string,
	patch: MetaPatch
): Promise<void> {
	await api.meta.update(patch);
	const { name } = await api.meta.get();
	saveRegistry(store, upsertBudget(loadRegistry(store), { file, name }));
}

/**
 * Deletes a budget file. Deleting the open budget (`openFile`) opens the next one, or returns
 * onboarding when none is left; deleting another budget returns null.
 */
export async function deleteBudget(
	api: SessionApi,
	store: KeyValueStore,
	file: string,
	openFile: string
): Promise<OpenResult | null> {
	await api.system.deleteFile(file);
	saveRegistry(store, removeBudget(loadRegistry(store), file));
	return file === openFile ? openLastBudget(api, store) : null;
}

/**
 * Restores a `.sqlite` backup as a new budget file and opens it. The worker checks the backup
 * first, so an invalid one changes nothing. With `replace`, the open budget (`openFile`) is
 * deleted once the restored one is open. If that fails, `openFile` is opened again.
 */
export async function restoreBudget(
	api: SessionApi,
	store: KeyValueStore,
	bytes: Uint8Array,
	openFile: string,
	replace: boolean
): Promise<{ file: string; meta: BudgetMeta }> {
	const file = newBudgetFile();
	await api.system.importFile(file, bytes);
	let meta: BudgetMeta;
	try {
		await api.system.open(file);
		meta = await api.meta.get();
	} catch (err) {
		await api.system.deleteFile(file).catch(() => {});
		await api.system.open(openFile).catch(() => {});
		throw err;
	}
	let registry = upsertBudget(loadRegistry(store), { file, name: meta.name });
	if (replace) {
		await api.system.deleteFile(openFile);
		registry = removeBudget(registry, openFile);
	}
	saveRegistry(store, markOpened(registry, file));
	return { file, meta };
}

export type StartupErrorCode =
```

- [ ] **Step 4: Run the tests**

Run: `pnpm test src/lib/client`

Expected: all pass.

- [ ] **Step 5: Verify and commit**

Run: `pnpm lint && pnpm check && pnpm test`

Expected: clean, 294 unit tests pass.

```bash
git add src/lib/client
git commit -m "feat: switch, update, delete and restore budget files" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Settings: budget files and budget details

Two new Settings cards. **Budget details** edits the open budget's name, number/date format and currency through `updateBudget`. **Budget files** lists the budgets, opens another one, deletes one (tap twice), and creates a new one by showing the onboarding form with a Cancel button (Decision 10). `AppState.show(client, file, meta)` replaces the open budget; the shell is keyed on the file, so it remounts. The repo's existing "currency with other decimals" rule now throws `CURRENCY_LOCKED` so the form can say why (Decision 9).

**Files:**
- Create: `src/lib/components/settings/BudgetDetails.svelte`, `src/lib/components/settings/BudgetFiles.svelte`, `e2e/settings.e2e.ts`
- Modify: `src/lib/db/repos/meta.ts`, `src/lib/domain/errors.ts`, `src/lib/i18n/errors.ts`, `src/lib/i18n/messages/en.json`, `src/lib/i18n/messages/pt-BR.json`, `src/lib/client/app-state.svelte.ts`, `src/lib/components/app/Boot.svelte`, `src/lib/components/app/Onboarding.svelte`, `src/routes/settings/+page.svelte`, `e2e/helpers.ts`
- Test: `src/lib/db/repos/meta.test.ts`, `e2e/settings.e2e.ts`

**Interfaces:**
- Consumes: `switchBudget`, `updateBudget`, `deleteBudget` (Task 4); `createBudget`, `localeChoices`, `currencyChoices`, `ResponsiveDialog` patterns (Plan 2).
- Produces:
  - `AppState.show(client: RpcClient, file: string, meta: BudgetMeta): void`
  - `Onboarding` prop `onCancel?: () => void` (shows "New budget" as the title and a Cancel button)
  - Error code `CURRENCY_LOCKED` (`error_currency_locked`)
  - e2e helpers `fillNewBudget(page, name, balance)` and `openSettings(page)`
  - `data-testid="budget-files"` on the budget list

- [ ] **Step 1: Write the failing repo test**

In `src/lib/db/repos/meta.test.ts`, replace:

```ts
		expect(() => updateMeta(db, { currency: 'JPY' })).toThrow(
			expect.objectContaining({ code: 'INVALID_INPUT' })
		);
```

with:

```ts
		expect(() => updateMeta(db, { currency: 'JPY' })).toThrow(
			expect.objectContaining({ code: 'CURRENCY_LOCKED' })
		);
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test src/lib/db/repos/meta.test.ts`

Expected: 1 failure: "allows currencies with the same minor units once data exists" still gets `INVALID_INPUT`.

- [ ] **Step 3: Add `CURRENCY_LOCKED` and the Settings messages**

In `src/lib/db/repos/meta.ts`, replace:

```ts
				throw new DomainError(
					'INVALID_INPUT',
					'Cannot switch to a currency with different minor units once data exists'
```

with:

```ts
				throw new DomainError(
					'CURRENCY_LOCKED',
					'Cannot switch to a currency with different minor units once data exists'
```

In `src/lib/domain/errors.ts`, replace:

```ts
	'BACKUP_NOT_MONETA',
	'WORKER_FAILED',
```

with:

```ts
	'BACKUP_NOT_MONETA',
	'CURRENCY_LOCKED',
	'WORKER_FAILED',
```

In `src/lib/i18n/errors.ts`, replace:

```ts
	BACKUP_NOT_MONETA: m.error_backup_not_moneta,
	WORKER_FAILED: m.error_worker_failed,
```

with:

```ts
	BACKUP_NOT_MONETA: m.error_backup_not_moneta,
	CURRENCY_LOCKED: m.error_currency_locked,
	WORKER_FAILED: m.error_worker_failed,
```

In `src/lib/i18n/messages/en.json`, replace:

```json
	"error_backup_not_moneta": "That database isn't a Moneta budget.",
	"error_worker_failed": "The database stopped. Reload to continue.",
```

with:

```json
	"error_backup_not_moneta": "That database isn't a Moneta budget.",
	"error_currency_locked": "This budget already has amounts in it, so its currency can only change to one with the same number of decimal places.",
	"error_worker_failed": "The database stopped. Reload to continue.",
```

Then replace:

```json
	"onboarding_create": "Create budget",
	"default_group_bills": "Bills",
```

with:

```json
	"onboarding_create": "Create budget",
	"onboarding_new_title": "New budget",
	"default_group_bills": "Bills",
```

Then replace:

```json
	"transaction_cleared": "Cleared",
	"settings_app": "App",
```

with:

```json
	"transaction_cleared": "Cleared",
	"settings_saved": "Saved.",
	"settings_budget_details": "Budget details",
	"settings_budget_files": "Budget files",
	"settings_budget_current": "Open now",
	"settings_budget_open": "Open",
	"settings_budget_open_named": "Open {name}",
	"settings_budget_delete_named": "Delete {name}",
	"settings_budget_new": "New budget",
	"settings_app": "App",
```

In `src/lib/i18n/messages/pt-BR.json`, replace:

```json
	"error_backup_not_moneta": "Esse banco de dados não é um orçamento do Moneta.",
	"error_worker_failed": "O banco de dados parou. Recarregue para continuar.",
```

with:

```json
	"error_backup_not_moneta": "Esse banco de dados não é um orçamento do Moneta.",
	"error_currency_locked": "Este orçamento já tem valores, então a moeda só pode mudar para outra com o mesmo número de casas decimais.",
	"error_worker_failed": "O banco de dados parou. Recarregue para continuar.",
```

Then replace:

```json
	"onboarding_default_account_name": "Conta corrente",
	"onboarding_create": "Criar orçamento",
```

with:

```json
	"onboarding_default_account_name": "Conta corrente",
	"onboarding_new_title": "Novo orçamento",
	"onboarding_create": "Criar orçamento",
```

Then replace:

```json
	"transaction_cleared": "Compensada",
	"settings_app": "Aplicativo",
```

with:

```json
	"transaction_cleared": "Compensada",
	"settings_saved": "Salvo.",
	"settings_budget_details": "Detalhes do orçamento",
	"settings_budget_files": "Arquivos de orçamento",
	"settings_budget_current": "Aberto agora",
	"settings_budget_open": "Abrir",
	"settings_budget_open_named": "Abrir {name}",
	"settings_budget_delete_named": "Excluir {name}",
	"settings_budget_new": "Novo orçamento",
	"settings_app": "Aplicativo",
```

Run: `pnpm test src/lib/db/repos/meta.test.ts src/lib/i18n`

Expected: all pass.

- [ ] **Step 4: Let the app switch budgets and cancel onboarding**

In `src/lib/client/app-state.svelte.ts`, replace:

```ts
	session: BudgetSession | null = $state(null);
}
```

with:

```ts
	session: BudgetSession | null = $state(null);

	/** Shows `file` as the open budget. The app shell remounts, since it is keyed on the file. */
	show(client: RpcClient, file: string, meta: BudgetMeta): void {
		this.session = new BudgetSession(client, file, meta);
		this.boot = { kind: 'ready' };
	}
}
```

In `src/lib/components/app/Boot.svelte`, replace:

```svelte
	import { resolve } from '$app/paths';
	import { AppState, BudgetSession, setApp } from '$lib/client/app-state.svelte';
	import { startDbWorker, type DbWorker } from '$lib/client/db';
```

with:

```svelte
	import { resolve } from '$app/paths';
	import { AppState, setApp } from '$lib/client/app-state.svelte';
	import { startDbWorker, type DbWorker } from '$lib/client/db';
```

Then replace:

```svelte
	function ready(started: DbWorker, file: string, meta: BudgetMeta) {
		if (started !== worker) return;
		app.session = new BudgetSession(started, file, meta);
		app.boot = { kind: 'ready' };
	}
```

with:

```svelte
	function ready(started: DbWorker, file: string, meta: BudgetMeta) {
		if (started === worker) app.show(started, file, meta);
	}

	/** Back from creating another budget (Settings): reopen the budget that was open. */
	async function cancelOnboarding() {
		const session = app.session;
		if (!worker || !session) return;
		try {
			await worker.api.system.open(session.file);
			app.boot = { kind: 'ready' };
		} catch (err) {
			app.boot = { kind: 'error', ...startupError(err) };
		}
	}
```

Then replace:

```svelte
		}}
	/>
```

with:

```svelte
		}}
		onCancel={app.session ? cancelOnboarding : undefined}
	/>
```

In `src/lib/components/app/Onboarding.svelte`, replace:

```svelte

	let { api, onCreated }: { api: SessionApi; onCreated: (file: string, meta: BudgetMeta) => void } =
		$props();

```

with:

```svelte

	/** First-run setup, also used from Settings to add a budget (then `onCancel` goes back). */
	let {
		api,
		onCreated,
		onCancel
	}: {
		api: SessionApi;
		onCreated: (file: string, meta: BudgetMeta) => void;
		onCancel?: () => void;
	} = $props();

```

Then replace:

```svelte
		<Card.Header>
			<Card.Title class="text-xl">{m.onboarding_title()}</Card.Title>
			<Card.Description>{m.onboarding_intro()}</Card.Description>
```

with:

```svelte
		<Card.Header>
			<Card.Title class="text-xl">
				{onCancel ? m.onboarding_new_title() : m.onboarding_title()}
			</Card.Title>
			<Card.Description>{m.onboarding_intro()}</Card.Description>
```

Then replace:

```svelte
				{/if}
				<Button type="submit" disabled={busy}>{m.onboarding_create()}</Button>
			</form>
```

with:

```svelte
				{/if}
				<div class="flex flex-col gap-2 sm:flex-row-reverse">
					<Button type="submit" disabled={busy}>{m.onboarding_create()}</Button>
					{#if onCancel}
						<Button type="button" variant="outline" disabled={busy} onclick={onCancel}>
							{m.cancel()}
						</Button>
					{/if}
				</div>
			</form>
```

- [ ] **Step 5: Add the two Settings cards**

Create `src/lib/components/settings/BudgetDetails.svelte`:

```svelte
<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { NativeSelect, NativeSelectOption } from '$lib/components/ui/native-select';
	import { useSession } from '$lib/client/app-state.svelte';
	import { runAction } from '$lib/client/notify';
	import { updateBudget } from '$lib/client/session';
	import { currencyChoices, localeChoices } from '$lib/i18n/formats';
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';

	const session = useSession();
	const locales = localeChoices(getLocale(), session.meta.locale);
	const currencies = currencyChoices(getLocale());

	let name = $state(session.meta.name);
	let locale = $state(session.meta.locale);
	let currency = $state(session.meta.currency);
	let error = $state<string | null>(null);
	let busy = $state(false);

	async function save(event: SubmitEvent) {
		event.preventDefault();
		busy = true;
		error = await runAction(() =>
			updateBudget(session.api, localStorage, session.file, { name, locale, currency })
		);
		busy = false;
		if (!error) toast.success(m.settings_saved());
	}
</script>

<Card.Root>
	<Card.Header>
		<Card.Title>{m.settings_budget_details()}</Card.Title>
	</Card.Header>
	<Card.Content>
		<form class="grid gap-4" onsubmit={save}>
			<div class="grid gap-2">
				<Label for="details-name">{m.onboarding_budget_name()}</Label>
				<Input id="details-name" bind:value={name} required autocomplete="off" />
			</div>
			<div class="grid gap-2">
				<Label for="details-locale">{m.onboarding_locale()}</Label>
				<NativeSelect id="details-locale" class="w-full" bind:value={locale}>
					{#each locales as choice (choice.value)}
						<NativeSelectOption value={choice.value}>{choice.label}</NativeSelectOption>
					{/each}
				</NativeSelect>
			</div>
			<div class="grid gap-2">
				<Label for="details-currency">{m.onboarding_currency()}</Label>
				<NativeSelect id="details-currency" class="w-full" bind:value={currency}>
					{#each currencies as choice (choice.value)}
						<NativeSelectOption value={choice.value}>{choice.label}</NativeSelectOption>
					{/each}
				</NativeSelect>
			</div>
			{#if error}<p class="text-sm text-destructive" role="alert">{error}</p>{/if}
			<Button type="submit" class="justify-self-start" disabled={busy}>{m.save()}</Button>
		</form>
	</Card.Content>
</Card.Root>
```

Create `src/lib/components/settings/BudgetFiles.svelte`:

```svelte
<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { getApp, useSession } from '$lib/client/app-state.svelte';
	import { runAction } from '$lib/client/notify';
	import { loadRegistry } from '$lib/client/registry';
	import { deleteBudget, switchBudget } from '$lib/client/session';
	import { currentMonth } from '$lib/domain/month';
	import { m } from '$lib/paraglide/messages';

	const app = getApp();
	const session = useSession();
	let budgets = $state(loadRegistry(localStorage).budgets);
	let confirming = $state<string | null>(null);
	let error = $state<string | null>(null);

	async function open(file: string) {
		error = await runAction(async () => {
			const opened = await switchBudget(session.api, localStorage, file);
			app.show(session.client, opened.file, opened.meta);
		});
		if (!error) void goto(resolve('/budget/[month]', { month: currentMonth() }));
	}

	async function remove(file: string) {
		if (confirming !== file) {
			confirming = file;
			return;
		}
		confirming = null;
		error = await runAction(async () => {
			const next = await deleteBudget(session.api, localStorage, file, session.file);
			if (next?.kind === 'ready') app.show(session.client, next.file, next.meta);
			else if (next?.kind === 'onboarding') {
				app.session = null;
				app.boot = { kind: 'onboarding' };
			}
			budgets = loadRegistry(localStorage).budgets;
		});
	}
</script>

<Card.Root>
	<Card.Header>
		<Card.Title>{m.settings_budget_files()}</Card.Title>
	</Card.Header>
	<Card.Content class="grid gap-4">
		<ul class="grid gap-2" data-testid="budget-files">
			{#each budgets as budget (budget.file)}
				{@const current = budget.file === session.file}
				{@const name = current ? session.meta.name : budget.name}
				<li class="flex flex-wrap items-center gap-2">
					<span class="min-w-0 flex-1 truncate">{name}</span>
					{#if current}
						<Badge variant="secondary">{m.settings_budget_current()}</Badge>
					{:else}
						<Button
							variant="outline"
							size="sm"
							aria-label={m.settings_budget_open_named({ name })}
							onclick={() => open(budget.file)}
						>
							{m.settings_budget_open()}
						</Button>
					{/if}
					<Button
						variant="destructive"
						size="sm"
						aria-label={confirming === budget.file
							? undefined
							: m.settings_budget_delete_named({ name })}
						onclick={() => remove(budget.file)}
					>
						{confirming === budget.file ? m.confirm_delete() : m.delete()}
					</Button>
				</li>
			{/each}
		</ul>
		{#if error}<p class="text-sm text-destructive" role="alert">{error}</p>{/if}
		<Button
			variant="outline"
			class="justify-self-start"
			onclick={() => (app.boot = { kind: 'onboarding' })}
		>
			{m.settings_budget_new()}
		</Button>
	</Card.Content>
</Card.Root>
```

In `src/routes/settings/+page.svelte`, replace:

```svelte
	import { NativeSelect, NativeSelectOption } from '$lib/components/ui/native-select';
	import { m } from '$lib/paraglide/messages';
```

with:

```svelte
	import { NativeSelect, NativeSelectOption } from '$lib/components/ui/native-select';
	import BudgetDetails from '$lib/components/settings/BudgetDetails.svelte';
	import BudgetFiles from '$lib/components/settings/BudgetFiles.svelte';
	import { m } from '$lib/paraglide/messages';
```

Then replace:

```svelte
	<h1 class="text-xl font-semibold">{m.nav_settings()}</h1>
	<Card.Root>
```

with:

```svelte
	<h1 class="text-xl font-semibold">{m.nav_settings()}</h1>
	<BudgetDetails />
	<BudgetFiles />
	<Card.Root>
```

Run: `pnpm lint && pnpm check`

Expected: clean.

- [ ] **Step 6: Write the e2e tests**

Replace the contents of `e2e/helpers.ts` with:

```ts
import { expect, type Page } from '@playwright/test';

/** Fills the new-budget form (USD, en-US, a checking account) and submits it. */
export async function fillNewBudget(page: Page, name: string, balance: string): Promise<void> {
	await page.getByLabel('Budget name').fill(name);
	await page.getByLabel('Number and date format').selectOption('en-US');
	await page.getByLabel('Currency').selectOption('USD');
	await page.getByLabel('Account name').fill('Checking');
	await page.getByLabel('Current balance').fill(balance);
	await page.getByRole('button', { name: 'Create budget' }).click();
}

/** Creates a USD budget with a checking account holding $1,000 and lands on the budget screen. */
export async function onboard(page: Page, name = 'Home'): Promise<void> {
	await page.goto('/');
	await fillNewBudget(page, name, '1000');
	await expect(page.getByTestId('rta-amount')).toHaveText('$1,000.00');
}

export function categoryRow(page: Page, name: string) {
	return page.getByTestId('category-row').filter({ hasText: name });
}

export async function openSettings(page: Page): Promise<void> {
	await page.getByRole('link', { name: 'Settings' }).first().click();
	await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
}
```

Create `e2e/settings.e2e.ts`:

```ts
import { expect, test } from '@playwright/test';
import { fillNewBudget, onboard, openSettings } from './helpers';

test('creates, switches, renames and deletes budgets', async ({ page }) => {
	await onboard(page);
	await openSettings(page);

	await page.getByRole('button', { name: 'New budget' }).click();
	await page.getByRole('button', { name: 'Cancel' }).click();
	await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

	await page.getByRole('button', { name: 'New budget' }).click();
	await fillNewBudget(page, 'Work', '250');
	await expect(page.getByTestId('rta-amount')).toHaveText('$250.00');

	await openSettings(page);
	const files = page.getByTestId('budget-files');
	await expect(files.getByRole('listitem')).toHaveText([/Home/, /Work/]);
	await page.getByRole('button', { name: 'Open Home' }).click();
	await expect(page.getByTestId('rta-amount')).toHaveText('$1,000.00');

	await openSettings(page);
	await page.getByLabel('Budget name').fill('House');
	await page.getByRole('button', { name: 'Save' }).click();
	await expect(files.getByRole('listitem').first()).toContainText('House');

	await page.getByRole('button', { name: 'Delete Work' }).click();
	await page.getByRole('button', { name: 'Tap again to delete' }).click();
	await expect(files.getByRole('listitem')).toHaveText([/House/]);

	await page.reload();
	await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
	await expect(files.getByRole('listitem')).toHaveText([/House/]);
});

test('keeps the currency once the budget has amounts', async ({ page }) => {
	await onboard(page);
	await openSettings(page);
	await page.getByLabel('Currency').selectOption('JPY');
	await page.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByRole('alert')).toContainText('same number of decimal places');
	await page.getByLabel('Currency').selectOption('EUR');
	await page.getByRole('button', { name: 'Save' }).click();
	await page.getByRole('link', { name: 'Budget' }).first().click();
	await expect(page.getByTestId('rta-amount')).toHaveText('€1,000.00');
});

test('deleting the last budget starts over', async ({ page }) => {
	await onboard(page);
	await openSettings(page);
	await page.getByRole('button', { name: 'Delete Home' }).click();
	await page.getByRole('button', { name: 'Tap again to delete' }).click();
	await expect(page.getByText('Welcome to Moneta')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Cancel' })).toBeHidden();
});
```

- [ ] **Step 7: Run the e2e tests**

Run: `pnpm test:e2e`

Expected: all 17 pass (14 existing, 3 new).

- [ ] **Step 8: Commit**

Run: `pnpm test`

Expected: 294 unit tests pass.

```bash
git add src e2e
git commit -m "feat: manage budget files and budget details in Settings" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Backup file names, CSV and JSON exports, and the reminder rule

The pure parts of Settings → Backup. `backupFileName` gives ASCII names such as `moneta-casa-familia-2026-09-19.sqlite`. `transactionsCsv` turns `api.transactions.list()` rows into CSV (Decision 7). `dumpBudget` (worker side, `api.backup.dump()`) returns every table for the JSON export (Decision 8). `backupDue` is the 14-day rule (Decision 5). `fileTarget` saves by triggering a download; it is the only `BackupTarget` in v1 (Decision 6).

**Files:**
- Create: `src/lib/backup/target.ts`, `src/lib/backup/file-target.ts`, `src/lib/backup/export-csv.ts`, `src/lib/backup/reminder.ts`, `src/lib/db/repos/dump.ts`
- Modify: `src/lib/db/api.ts`
- Test: `src/lib/backup/target.test.ts`, `src/lib/backup/export-csv.test.ts`, `src/lib/backup/reminder.test.ts`, `src/lib/db/repos/dump.test.ts`

**Interfaces:**
- Consumes: `TransactionRow`, `listTransactions` (Plan 1), `currencyDigits`, `todayIso`, `schemaVersion`, `ALL_TABLES`.
- Produces:
  - `interface BackupTarget { save(fileName: string, data: Blob): Promise<void> }`, `fileTarget: BackupTarget`
  - `backupFileName(budgetName: string, extension: string, now = new Date()): string`
  - `minorToDecimal(minor: number, digits: number): string`, `transactionsCsv(rows: TransactionRow[], currency: string): string`
  - `backupDue(meta: { createdAt; lastBackupAt }, now = new Date()): boolean`
  - `interface BudgetDump`, `dumpBudget(db, now = new Date()): BudgetDump`, RPC `api.backup.dump(): Promise<BudgetDump>`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/backup/target.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { backupFileName } from './target';

describe('backupFileName', () => {
	const day = new Date(2026, 8, 19, 23, 30);

	it('names the file after the budget and the local date', () => {
		expect(backupFileName('Home', 'sqlite', day)).toBe('moneta-home-2026-09-19.sqlite');
	});

	it('keeps the name readable and safe for any file system', () => {
		expect(backupFileName('Casa & Família 2026', 'csv', day)).toBe(
			'moneta-casa-familia-2026-2026-09-19.csv'
		);
		expect(backupFileName('???', 'json', day)).toBe('moneta-budget-2026-09-19.json');
	});
});
```

Create `src/lib/backup/reminder.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { backupDue } from './reminder';

const now = new Date('2026-09-19T12:00:00Z');

describe('backupDue', () => {
	it('is due 14 days after the last backup', () => {
		const meta = { createdAt: '2026-01-01T00:00:00Z' };
		expect(backupDue({ ...meta, lastBackupAt: '2026-09-06T12:00:00Z' }, now)).toBe(false);
		expect(backupDue({ ...meta, lastBackupAt: '2026-09-05T12:00:00Z' }, now)).toBe(true);
	});

	it('counts from the creation date when there was never a backup', () => {
		expect(backupDue({ createdAt: '2026-09-10T00:00:00Z', lastBackupAt: null }, now)).toBe(false);
		expect(backupDue({ createdAt: '2026-08-01T00:00:00Z', lastBackupAt: null }, now)).toBe(true);
	});
});
```

`export-csv.test.ts` builds real rows with the repos: a split, income whose payee starts with `=`, a payee with a comma and quotes, and a transfer.

Create `src/lib/backup/export-csv.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createAccount } from '$lib/db/repos/accounts';
import { readyToAssignCategoryId } from '$lib/db/repos/meta';
import { createTransaction, listTransactions } from '$lib/db/repos/transactions';
import { categoryId, createBudgetDb } from '$lib/db/testing';
import { minorToDecimal, transactionsCsv } from './export-csv';

describe('minorToDecimal', () => {
	it('writes plain decimals with the currency precision', () => {
		expect(minorToDecimal(-123456, 2)).toBe('-1234.56');
		expect(minorToDecimal(5, 2)).toBe('0.05');
		expect(minorToDecimal(-5, 2)).toBe('-0.05');
		expect(minorToDecimal(1500, 0)).toBe('1500');
		expect(minorToDecimal(1, 3)).toBe('0.001');
	});
});

describe('transactionsCsv', () => {
	it('writes one row per transaction and per split line, oldest first', async () => {
		const db = await createBudgetDb();
		const base = { onBudget: true, startingDate: '2026-09-01' };
		const bank = createAccount(db, { ...base, name: 'Bank', type: 'checking', startingBalance: 0 });
		const cash = createAccount(db, { ...base, name: 'Cash', type: 'cash', startingBalance: 0 });
		createTransaction(db, {
			accountId: bank,
			date: '2026-09-03',
			amount: -3000,
			payeeName: 'Market, "Central"',
			memo: 'week',
			splits: [
				{ categoryId: categoryId(db, 'Food'), amount: -2000, memo: 'food' },
				{ categoryId: categoryId(db, 'Fun'), amount: -1000 }
			]
		});
		createTransaction(db, {
			accountId: bank,
			date: '2026-09-02',
			amount: 100000,
			payeeName: '=Employer',
			categoryId: readyToAssignCategoryId(db),
			cleared: true
		});
		createTransaction(db, {
			accountId: bank,
			date: '2026-09-04',
			amount: -5000,
			transferAccountId: cash
		});

		const csv = transactionsCsv(listTransactions(db), 'BRL');
		expect(csv.startsWith('\uFEFF')).toBe(true);
		expect(csv.slice(1).split('\r\n')).toEqual([
			'Date,Account,Payee,Transfer,Category,Memo,Amount,Cleared',
			"2026-09-02,Bank,'=Employer,,Ready to Assign,,1000.00,cleared",
			'2026-09-03,Bank,"Market, ""Central""",,Food,food,-20.00,uncleared',
			'2026-09-03,Bank,"Market, ""Central""",,Fun,week,-10.00,uncleared',
			'2026-09-04,Bank,,Cash,,,-50.00,uncleared',
			'2026-09-04,Cash,,Bank,,,50.00,uncleared',
			''
		]);
	});
});
```

Create `src/lib/db/repos/dump.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { SCHEMA_VERSION } from '../migrate';
import { createBudgetDb } from '../testing';
import { createAccount } from './accounts';
import { dumpBudget } from './dump';

describe('dumpBudget', () => {
	it('holds every table as plain JSON', async () => {
		const db = await createBudgetDb();
		createAccount(db, {
			name: 'Bank',
			type: 'checking',
			onBudget: true,
			startingBalance: 1000,
			startingDate: '2026-09-01'
		});
		const dump = dumpBudget(db, new Date('2026-09-19T12:00:00Z'));
		expect(dump).toMatchObject({
			format: 'moneta-budget',
			schemaVersion: SCHEMA_VERSION,
			exportedAt: '2026-09-19T12:00:00.000Z',
			meta: { name: 'Test Budget', currency: 'BRL', locale: 'pt-BR' }
		});
		expect(Object.keys(dump.tables).sort()).toEqual([
			'accounts',
			'budget_assignments',
			'categories',
			'category_groups',
			'payees',
			'transaction_splits',
			'transactions'
		]);
		expect(dump.tables.accounts).toEqual([expect.objectContaining({ name: 'Bank', on_budget: 1 })]);
		expect(dump.tables.transactions).toEqual([expect.objectContaining({ amount: 1000 })]);
		expect(JSON.parse(JSON.stringify(dump))).toEqual(dump);
	});
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm test src/lib/backup src/lib/db/repos/dump.test.ts`

Expected: all four files fail to load (`Cannot find module`).

- [ ] **Step 3: Implement**

Create `src/lib/backup/target.ts`:

```ts
import { todayIso } from '$lib/domain/month';

/**
 * Where backups and exports go. v1 has one target that downloads files (`file-target.ts`);
 * cloud targets (spec §1, out of scope for v1) would implement the same interface.
 */
export interface BackupTarget {
	save(fileName: string, data: Blob): Promise<void>;
}

/** e.g. `moneta-casa-familia-2026-09-19.sqlite`: ASCII only, safe on any file system. */
export function backupFileName(budgetName: string, extension: string, now = new Date()): string {
	const slug =
		budgetName
			.normalize('NFD')
			.replace(/[̀-ͯ]/g, '')
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '') || 'budget';
	return `moneta-${slug}-${todayIso(now)}.${extension}`;
}
```

Create `src/lib/backup/file-target.ts`:

```ts
import type { BackupTarget } from './target';

/** Saves backups as browser downloads. */
export const fileTarget: BackupTarget = {
	async save(fileName, data) {
		const url = URL.createObjectURL(data);
		const link = document.createElement('a');
		link.href = url;
		link.download = fileName;
		link.click();
		// Give the browser time to start the download before the URL goes away.
		setTimeout(() => URL.revokeObjectURL(url), 60_000);
	}
};
```

Create `src/lib/backup/reminder.ts`:

```ts
import type { BudgetMeta } from '$lib/db/repos/meta';

const REMINDER_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

/** True once a budget has gone 14 days without a `.sqlite` backup (or since it was created). */
export function backupDue(
	meta: Pick<BudgetMeta, 'createdAt' | 'lastBackupAt'>,
	now: Date = new Date()
): boolean {
	const since = Date.parse(meta.lastBackupAt ?? meta.createdAt);
	return Number.isFinite(since) && now.getTime() - since >= REMINDER_DAYS * DAY_MS;
}
```

Keep the byte-order mark as the `'﻿'` escape in source: ESLint rejects a literal one (`no-irregular-whitespace`).

Create `src/lib/backup/export-csv.ts`:

```ts
import type { TransactionRow } from '$lib/db/repos/transactions';
import { currencyDigits } from '$lib/domain/money';

/** Byte-order mark: tells spreadsheets the file is UTF-8. */
const BOM = '\uFEFF';
const HEADER = ['Date', 'Account', 'Payee', 'Transfer', 'Category', 'Memo', 'Amount', 'Cleared'];

/** Minor units as a plain decimal with a dot, e.g. -123456 → "-1234.56" (2 digits). */
export function minorToDecimal(minor: number, digits: number): string {
	const sign = minor < 0 ? '-' : '';
	const abs = String(Math.abs(minor)).padStart(digits + 1, '0');
	if (digits === 0) return sign + abs;
	return `${sign}${abs.slice(0, -digits)}.${abs.slice(-digits)}`;
}

/** Quotes a field when needed (RFC 4180). */
function field(value: string): string {
	return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** A text field that spreadsheets must not run as a formula (OWASP "CSV injection"). */
function text(value: string | null): string {
	const v = value ?? '';
	return field(/^[=+\-@\t\r]/.test(v) ? `'${v}` : v);
}

/**
 * Transactions as CSV for spreadsheets: one row per transaction, and one per line of a split
 * transaction, oldest first. Amounts are plain decimals (negative = outflow), dates ISO, and
 * names as stored. Starts with a byte-order mark so spreadsheets read it as UTF-8.
 */
export function transactionsCsv(rows: TransactionRow[], currency: string): string {
	const digits = currencyDigits(currency);
	const sorted = [...rows].sort((a, b) =>
		a.date === b.date ? (a.id < b.id ? -1 : 1) : a.date < b.date ? -1 : 1
	);
	const lines = [HEADER.join(',')];
	for (const t of sorted) {
		const parts = t.isSplit
			? t.splits.map((s) => ({
					category: s.categoryName,
					memo: s.memo || t.memo,
					amount: s.amount
				}))
			: [{ category: t.categoryName, memo: t.memo, amount: t.amount }];
		for (const p of parts) {
			lines.push(
				[
					t.date,
					text(t.accountName),
					text(t.payeeName),
					text(t.transferAccountName),
					text(p.category),
					text(p.memo),
					minorToDecimal(p.amount, digits),
					t.cleared ? 'cleared' : 'uncleared'
				].join(',')
			);
		}
	}
	return `${BOM}${lines.join('\r\n')}\r\n`;
}
```

Create `src/lib/db/repos/dump.ts`:

```ts
import { all, ALL_TABLES, type Db, type Table } from '../connection';
import { schemaVersion } from '../migrate';

/**
 * The whole budget as JSON: the `meta` keys, and every other table's rows with their SQL
 * column names and values (booleans are 0/1, amounts are minor units). For reading elsewhere;
 * the `.sqlite` export is the backup that can be restored.
 */
export interface BudgetDump {
	format: 'moneta-budget';
	schemaVersion: number;
	exportedAt: string;
	meta: Record<string, string>;
	tables: Record<Exclude<Table, 'meta'>, Record<string, unknown>[]>;
}

export function dumpBudget(db: Db, now: Date = new Date()): BudgetDump {
	const meta = Object.fromEntries(
		all<{ key: string; value: string }>(db, 'SELECT key, value FROM meta ORDER BY key').map((r) => [
			r.key,
			r.value
		])
	);
	const tables = Object.fromEntries(
		ALL_TABLES.filter((t) => t !== 'meta').map((t) => [
			t,
			all<Record<string, unknown>>(db, `SELECT * FROM ${t} ORDER BY 1, 2`)
		])
	) as BudgetDump['tables'];
	return {
		format: 'moneta-budget',
		schemaVersion: schemaVersion(db),
		exportedAt: now.toISOString(),
		meta,
		tables
	};
}
```

The RPC wraps `dumpBudget` so the client can't pass `now`:

In `src/lib/db/api.ts`, replace:

```ts
import * as budget from './repos/budget';

```

with:

```ts
import * as budget from './repos/budget';
import * as dump from './repos/dump';

```

Then replace:

```ts
		quickAssign: write(['budget_assignments'], budget.applyQuickAssign)
	}
```

with:

```ts
		quickAssign: write(['budget_assignments'], budget.applyQuickAssign)
	},
	backup: {
		dump: read((db) => dump.dumpBudget(db))
	}
```

- [ ] **Step 4: Run the tests**

Run: `pnpm test src/lib/backup src/lib/db/repos/dump.test.ts`

Expected: all 7 pass.

- [ ] **Step 5: Verify and commit**

Run: `pnpm lint && pnpm check && pnpm test`

Expected: clean, 301 unit tests pass.

```bash
git add src/lib/backup src/lib/db
git commit -m "feat: CSV and JSON exports, backup file names and the backup reminder rule" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Settings: backup, restore, exports and storage

`backup/actions.ts` ties the exports to the open budget and a `BackupTarget`; `backUp` also records `lastBackupAt`. Settings gets a **Backup** card (last backup, "Back up now", a file input to restore, CSV and JSON exports), a **restore dialog** (replace the open budget, tap twice, or add as a new budget), and a **Storage** card (persistence and space used; spec §2, §5). `AppShell` shows the reminder toast when a backup is due.

The restore file input is the shadcn `Input`, which binds `value` on file inputs. Clear it through that binding (`chosen = ''`), not by setting the element's `value`: Svelte would write the old path back, which the browser rejects, and the next pick would never open the dialog.

**Files:**
- Create: `src/lib/backup/actions.ts`, `src/lib/components/settings/BackupCard.svelte`, `src/lib/components/settings/RestoreDialog.svelte`, `src/lib/components/settings/StorageCard.svelte`, `e2e/backup.e2e.ts`
- Modify: `src/lib/i18n/formats.ts`, `src/lib/i18n/messages/en.json`, `src/lib/i18n/messages/pt-BR.json`, `src/routes/settings/+page.svelte`, `src/lib/components/app/AppShell.svelte`
- Test: `src/lib/backup/actions.test.ts`, `src/lib/i18n/formats.test.ts`, `e2e/backup.e2e.ts`

**Interfaces:**
- Consumes: `api.system.exportFile` (Task 3), `restoreBudget` (Task 4), `AppState.show`, `openSettings` (Task 5), everything in Task 6.
- Produces:
  - `interface ExportSource { api: ClientApi; meta: BudgetMeta }` (a `BudgetSession` fits)
  - `backUp(source, target = fileTarget, now = new Date())`, `exportTransactionsCsv(source, target?, now?)`, `exportBudgetJson(source, target?, now?)`: all `Promise<void>`
  - `formatDateTime(iso: string, locale: string, timeZone?: string): string`, `formatBytes(bytes: number, locale: string): string`
  - `data-testid="last-backup"`, `data-testid="storage-persisted"`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/backup/actions.test.ts`:

```ts
import { describe, it, expect, afterEach } from 'vitest';
import { createBudget } from '$lib/client/session';
import { createTestClient, memoryStore } from '$lib/client/testing';
import type { BudgetDump } from '$lib/db/repos/dump';
import { backUp, exportBudgetJson, exportTransactionsCsv } from './actions';
import type { BackupTarget } from './target';

const clients: { close(): void }[] = [];
afterEach(() => {
	for (const c of clients.splice(0)) c.close();
});

async function setup() {
	const test = await createTestClient();
	clients.push(test);
	const api = test.client.api;
	const { meta } = await createBudget(api, memoryStore(), {
		name: 'Home',
		currency: 'USD',
		locale: 'en-US',
		groups: [{ name: 'Everyday', categories: ['Food'] }],
		account: {
			name: 'Checking',
			type: 'checking',
			onBudget: true,
			startingBalance: 150000,
			startingDate: '2026-09-01'
		}
	});
	const saved: { fileName: string; data: Blob }[] = [];
	const target: BackupTarget = {
		save: async (fileName, data) => void saved.push({ fileName, data })
	};
	return { api, session: { api, meta }, saved, target };
}

describe('backUp', () => {
	it('saves the budget as a .sqlite file and records the backup date', async () => {
		const { api, session, saved, target } = await setup();
		await backUp(session, target, new Date(2026, 8, 19, 10, 0));
		expect(saved[0].fileName).toBe('moneta-home-2026-09-19.sqlite');
		const bytes = new Uint8Array(await saved[0].data.arrayBuffer());
		expect(new TextDecoder().decode(bytes.slice(0, 15))).toBe('SQLite format 3');
		expect((await api.meta.get()).lastBackupAt).toBe(new Date(2026, 8, 19, 10, 0).toISOString());
	});
});

describe('exportTransactionsCsv / exportBudgetJson', () => {
	it('saves the transactions as CSV and the budget as JSON', async () => {
		const { session, saved, target } = await setup();
		const now = new Date(2026, 8, 19, 10, 0);
		await exportTransactionsCsv(session, target, now);
		await exportBudgetJson(session, target, now);
		expect(saved.map((s) => s.fileName)).toEqual([
			'moneta-home-2026-09-19.csv',
			'moneta-home-2026-09-19.json'
		]);
		expect(await saved[0].data.text()).toContain('2026-09-01,Checking,Starting Balance,');
		const dump = JSON.parse(await saved[1].data.text()) as BudgetDump;
		expect(dump.meta.name).toBe('Home');
	});
});
```

In `src/lib/i18n/formats.test.ts`, replace:

```ts
	currencyChoices,
	formatDate,
	formatMonth,
```

with:

```ts
	currencyChoices,
	formatBytes,
	formatDate,
	formatDateTime,
	formatMonth,
```

Then replace:

```ts
		expect(formatDate('2026-01-01', 'pt-BR')).toBe('1 de jan. de 2026');
	});
});
```

with:

```ts
		expect(formatDate('2026-01-01', 'pt-BR')).toBe('1 de jan. de 2026');
	});
});

describe('formatDateTime', () => {
	it('shows a timestamp with date and time', () => {
		expect(formatDateTime('2026-09-19T15:04:00Z', 'pt-BR', 'UTC')).toBe(
			'19 de set. de 2026, 15:04'
		);
	});
});

describe('formatBytes', () => {
	it('picks a readable unit, from kilobytes up', () => {
		expect(formatBytes(500, 'en-US')).toBe('0.5 kB');
		expect(formatBytes(1_234_567, 'en-US')).toBe('1.2 MB');
		expect(formatBytes(1_500_000, 'pt-BR')).toBe('1,5 MB');
		expect(formatBytes(5e9, 'pt-BR')).toBe('5 GB');
	});
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm test src/lib/backup src/lib/i18n/formats.test.ts`

Expected: `actions.test.ts` fails to load, and the two new format tests fail (`formatDateTime is not a function`, `formatBytes is not a function`).

- [ ] **Step 3: Implement the formatters and actions**

In `src/lib/i18n/formats.ts`, replace:

```ts
	}).format(utc(date));
}
```

with:

```ts
	}).format(utc(date));
}

/** "19 de set. de 2026, 15:04" for an ISO timestamp, in the device's time zone by default. */
export function formatDateTime(iso: string, locale: string, timeZone?: string): string {
	return new Intl.DateTimeFormat(locale, {
		dateStyle: 'medium',
		timeStyle: 'short',
		timeZone
	}).format(new Date(iso));
}

const BYTE_UNITS = ['kilobyte', 'megabyte', 'gigabyte', 'terabyte'] as const;

/** "1.2 MB": decimal units (1 kB = 1000 bytes), as browsers report storage. */
export function formatBytes(bytes: number, locale: string): string {
	let value = bytes / 1000;
	let unit = 0;
	while (value >= 1000 && unit < BYTE_UNITS.length - 1) {
		value /= 1000;
		unit++;
	}
	return new Intl.NumberFormat(locale, {
		style: 'unit',
		unit: BYTE_UNITS[unit],
		maximumFractionDigits: 1
	}).format(value);
}
```

Create `src/lib/backup/actions.ts`:

```ts
import type { ClientApi } from '$lib/db/api';
import type { BudgetMeta } from '$lib/db/repos/meta';
import { transactionsCsv } from './export-csv';
import { fileTarget } from './file-target';
import { backupFileName, type BackupTarget } from './target';

/** What the exports need from the open budget (a BudgetSession in the app). */
export interface ExportSource {
	api: ClientApi;
	meta: BudgetMeta;
}

/** Saves the open budget as a `.sqlite` file (the backup that can be restored). */
export async function backUp(
	source: ExportSource,
	target: BackupTarget = fileTarget,
	now = new Date()
): Promise<void> {
	const bytes = await source.api.system.exportFile();
	await target.save(
		backupFileName(source.meta.name, 'sqlite', now),
		new Blob([bytes], { type: 'application/vnd.sqlite3' })
	);
	await source.api.meta.update({ lastBackupAt: now.toISOString() });
}

export async function exportTransactionsCsv(
	source: ExportSource,
	target: BackupTarget = fileTarget,
	now = new Date()
): Promise<void> {
	const csv = transactionsCsv(await source.api.transactions.list(), source.meta.currency);
	await target.save(
		backupFileName(source.meta.name, 'csv', now),
		new Blob([csv], { type: 'text/csv;charset=utf-8' })
	);
}

export async function exportBudgetJson(
	source: ExportSource,
	target: BackupTarget = fileTarget,
	now = new Date()
): Promise<void> {
	const json = `${JSON.stringify(await source.api.backup.dump(), null, '\t')}\n`;
	await target.save(
		backupFileName(source.meta.name, 'json', now),
		new Blob([json], { type: 'application/json' })
	);
}
```

Run: `pnpm test src/lib/backup src/lib/i18n/formats.test.ts`

Expected: all pass.

- [ ] **Step 4: Add the messages**

In `src/lib/i18n/messages/en.json`, replace:

```json
	"settings_budget_new": "New budget",
	"settings_app": "App",
```

with:

```json
	"settings_budget_new": "New budget",
	"settings_backup": "Backup",
	"backup_last": "Last backup: {date}",
	"backup_never": "Last backup: never",
	"backup_hint": "A backup is the whole budget in one .sqlite file. Keep it somewhere safe, off this device.",
	"backup_now": "Back up now",
	"backup_restore": "Restore from a backup",
	"backup_restore_title": "Restore a backup",
	"backup_restore_file": "File: {file}",
	"backup_restore_replace": "Replace {name}",
	"backup_restore_replace_confirm": "Tap again to replace",
	"backup_restore_replace_hint": "Everything in {name} is replaced by the backup.",
	"backup_restore_new": "Add as a new budget",
	"backup_restored": "Backup restored.",
	"backup_exports": "Exports",
	"backup_exports_hint": "For spreadsheets and other apps. These files can't be restored.",
	"backup_export_csv": "Transactions (CSV)",
	"backup_export_json": "Whole budget (JSON)",
	"backup_reminder": "Your last backup is more than two weeks old.",
	"settings_storage": "Storage",
	"storage_persisted": "Your budget is stored persistently: the browser won't clear it to free up space.",
	"storage_not_persisted": "The browser may clear your budget if the device runs low on space. Back up regularly.",
	"storage_persist_ask": "Keep my data",
	"storage_used": "Space used: {used} of {quota}",
	"settings_app": "App",
```

In `src/lib/i18n/messages/pt-BR.json`, replace:

```json
	"settings_budget_new": "Novo orçamento",
	"settings_app": "Aplicativo",
```

with:

```json
	"settings_budget_new": "Novo orçamento",
	"settings_backup": "Backup",
	"backup_last": "Último backup: {date}",
	"backup_never": "Último backup: nunca",
	"backup_hint": "Um backup é o orçamento inteiro em um arquivo .sqlite. Guarde-o em um lugar seguro, fora deste aparelho.",
	"backup_now": "Fazer backup agora",
	"backup_restore": "Restaurar um backup",
	"backup_restore_title": "Restaurar um backup",
	"backup_restore_file": "Arquivo: {file}",
	"backup_restore_replace": "Substituir {name}",
	"backup_restore_replace_confirm": "Toque de novo para substituir",
	"backup_restore_replace_hint": "Tudo em {name} é substituído pelo backup.",
	"backup_restore_new": "Adicionar como novo orçamento",
	"backup_restored": "Backup restaurado.",
	"backup_exports": "Exportações",
	"backup_exports_hint": "Para planilhas e outros apps. Esses arquivos não podem ser restaurados.",
	"backup_export_csv": "Transações (CSV)",
	"backup_export_json": "Orçamento inteiro (JSON)",
	"backup_reminder": "Seu último backup tem mais de duas semanas.",
	"settings_storage": "Armazenamento",
	"storage_persisted": "Seu orçamento está guardado de forma persistente: o navegador não vai apagá-lo para liberar espaço.",
	"storage_not_persisted": "O navegador pode apagar seu orçamento se o aparelho ficar sem espaço. Faça backups com frequência.",
	"storage_persist_ask": "Manter meus dados",
	"storage_used": "Espaço usado: {used} de {quota}",
	"settings_app": "Aplicativo",
```

- [ ] **Step 5: Add the cards, the restore dialog and the reminder**

Create `src/lib/components/settings/RestoreDialog.svelte`:

```svelte
<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { toast } from 'svelte-sonner';
	import { Button } from '$lib/components/ui/button';
	import ResponsiveDialog from '$lib/components/ResponsiveDialog.svelte';
	import { getApp, useSession } from '$lib/client/app-state.svelte';
	import { runAction } from '$lib/client/notify';
	import { restoreBudget } from '$lib/client/session';
	import { currentMonth } from '$lib/domain/month';
	import { m } from '$lib/paraglide/messages';

	let { open = $bindable(false), file }: { open: boolean; file: File | null } = $props();
	const app = getApp();
	const session = useSession();
	let confirmReplace = $state(false);
	let busy = $state(false);
	let error = $state<string | null>(null);

	$effect(() => {
		if (!open) return;
		confirmReplace = false;
		error = null;
	});

	async function restore(replace: boolean) {
		if (!file) return;
		if (replace && !confirmReplace) {
			confirmReplace = true;
			return;
		}
		busy = true;
		const bytes = new Uint8Array(await file.arrayBuffer());
		error = await runAction(async () => {
			const restored = await restoreBudget(session.api, localStorage, bytes, session.file, replace);
			app.show(session.client, restored.file, restored.meta);
		});
		busy = false;
		if (error) return;
		open = false;
		toast.success(m.backup_restored());
		void goto(resolve('/budget/[month]', { month: currentMonth() }));
	}
</script>

<ResponsiveDialog
	bind:open
	title={m.backup_restore_title()}
	description={file ? m.backup_restore_file({ file: file.name }) : undefined}
>
	<div class="grid gap-4">
		<div class="grid gap-1">
			<Button variant="destructive" disabled={busy} onclick={() => restore(true)}>
				{confirmReplace
					? m.backup_restore_replace_confirm()
					: m.backup_restore_replace({ name: session.meta.name })}
			</Button>
			<p class="text-xs text-muted-foreground">
				{m.backup_restore_replace_hint({ name: session.meta.name })}
			</p>
		</div>
		<Button variant="outline" disabled={busy} onclick={() => restore(false)}>
			{m.backup_restore_new()}
		</Button>
		{#if error}<p class="text-sm text-destructive" role="alert">{error}</p>{/if}
	</div>
</ResponsiveDialog>
```

Create `src/lib/components/settings/BackupCard.svelte`:

```svelte
<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Separator } from '$lib/components/ui/separator';
	import RestoreDialog from './RestoreDialog.svelte';
	import { backUp, exportBudgetJson, exportTransactionsCsv } from '$lib/backup/actions';
	import { useSession } from '$lib/client/app-state.svelte';
	import { runActionToast } from '$lib/client/notify';
	import { formatDateTime } from '$lib/i18n/formats';
	import { m } from '$lib/paraglide/messages';

	const session = useSession();
	let restoring = $state(false);
	let picked = $state<File | null>(null);
	let chosen = $state('');

	function pick(event: Event & { currentTarget: HTMLInputElement }) {
		picked = event.currentTarget.files?.[0] ?? null;
		// Clear the input so choosing the same file again still fires `change`.
		chosen = '';
		if (picked) restoring = true;
	}
</script>

<Card.Root>
	<Card.Header>
		<Card.Title>{m.settings_backup()}</Card.Title>
		<Card.Description>{m.backup_hint()}</Card.Description>
	</Card.Header>
	<Card.Content class="grid gap-4">
		<p class="text-sm" data-testid="last-backup">
			{session.meta.lastBackupAt
				? m.backup_last({ date: formatDateTime(session.meta.lastBackupAt, session.meta.locale) })
				: m.backup_never()}
		</p>
		<Button class="justify-self-start" onclick={() => runActionToast(() => backUp(session))}>
			{m.backup_now()}
		</Button>
		<div class="grid gap-2">
			<Label for="restore-file">{m.backup_restore()}</Label>
			<Input
				id="restore-file"
				type="file"
				bind:value={chosen}
				accept=".sqlite,.sqlite3,.db,application/vnd.sqlite3,application/x-sqlite3"
				onchange={pick}
			/>
		</div>
		<Separator />
		<div class="grid gap-2">
			<p class="text-sm font-medium">{m.backup_exports()}</p>
			<p class="text-xs text-muted-foreground">{m.backup_exports_hint()}</p>
			<div class="flex flex-wrap gap-2">
				<Button
					variant="outline"
					onclick={() => runActionToast(() => exportTransactionsCsv(session))}
				>
					{m.backup_export_csv()}
				</Button>
				<Button variant="outline" onclick={() => runActionToast(() => exportBudgetJson(session))}>
					{m.backup_export_json()}
				</Button>
			</div>
		</div>
	</Card.Content>
</Card.Root>

<RestoreDialog bind:open={restoring} file={picked} />
```

Create `src/lib/components/settings/StorageCard.svelte`:

```svelte
<script lang="ts">
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { formatBytes } from '$lib/i18n/formats';
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';

	let persisted = $state<boolean | null>(null);
	let estimate = $state<StorageEstimate | null>(null);

	async function refresh() {
		persisted = (await navigator.storage?.persisted?.()) ?? null;
		estimate = (await navigator.storage?.estimate?.()) ?? null;
	}

	async function ask() {
		await navigator.storage?.persist?.();
		await refresh();
	}

	onMount(() => void refresh());
</script>

<Card.Root>
	<Card.Header>
		<Card.Title>{m.settings_storage()}</Card.Title>
	</Card.Header>
	<Card.Content class="grid gap-4 text-sm">
		{#if persisted !== null}
			<p data-testid="storage-persisted">
				{persisted ? m.storage_persisted() : m.storage_not_persisted()}
			</p>
			{#if !persisted}
				<Button variant="outline" class="justify-self-start" onclick={ask}>
					{m.storage_persist_ask()}
				</Button>
			{/if}
		{/if}
		{#if estimate?.usage !== undefined && estimate.quota !== undefined}
			<p>
				{m.storage_used({
					used: formatBytes(estimate.usage, getLocale()),
					quota: formatBytes(estimate.quota, getLocale())
				})}
			</p>
		{/if}
	</Card.Content>
</Card.Root>
```

In `src/routes/settings/+page.svelte`, replace:

```svelte
	import { NativeSelect, NativeSelectOption } from '$lib/components/ui/native-select';
	import BudgetDetails from '$lib/components/settings/BudgetDetails.svelte';
	import BudgetFiles from '$lib/components/settings/BudgetFiles.svelte';
	import { m } from '$lib/paraglide/messages';
```

with:

```svelte
	import { NativeSelect, NativeSelectOption } from '$lib/components/ui/native-select';
	import BackupCard from '$lib/components/settings/BackupCard.svelte';
	import BudgetDetails from '$lib/components/settings/BudgetDetails.svelte';
	import BudgetFiles from '$lib/components/settings/BudgetFiles.svelte';
	import StorageCard from '$lib/components/settings/StorageCard.svelte';
	import { m } from '$lib/paraglide/messages';
```

Then replace:

```svelte
	<BudgetFiles />
	<Card.Root>
```

with:

```svelte
	<BudgetFiles />
	<BackupCard />
	<StorageCard />
	<Card.Root>
```

In `src/lib/components/app/AppShell.svelte`, replace:

```svelte
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';
```

with:

```svelte
<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { page } from '$app/state';
```

Then replace:

```svelte
	import TransactionDialog from '$lib/components/transactions/TransactionDialog.svelte';
	import { useSession } from '$lib/client/app-state.svelte';
	import { useLive } from '$lib/client/live.svelte';
	import { currentMonth } from '$lib/domain/month';
```

with:

```svelte
	import TransactionDialog from '$lib/components/transactions/TransactionDialog.svelte';
	import { backUp } from '$lib/backup/actions';
	import { backupDue } from '$lib/backup/reminder';
	import { useSession } from '$lib/client/app-state.svelte';
	import { useLive } from '$lib/client/live.svelte';
	import { runActionToast } from '$lib/client/notify';
	import { currentMonth } from '$lib/domain/month';
```

Then replace:

```svelte
	let adding = $state(false);
</script>
```

with:

```svelte
	let adding = $state(false);

	onMount(() => {
		if (!backupDue(session.meta)) return;
		toast(m.backup_reminder(), {
			duration: 15_000,
			action: { label: m.backup_now(), onClick: () => void runActionToast(() => backUp(session)) }
		});
	});
</script>
```

Run: `pnpm lint && pnpm check`

Expected: clean.

- [ ] **Step 6: Write the e2e tests**

Create `e2e/backup.e2e.ts`:

```ts
import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { onboard, openSettings } from './helpers';

async function download(page: Page, button: string, path: string): Promise<string> {
	const downloading = page.waitForEvent('download');
	await page.getByRole('button', { name: button }).click();
	const file = await downloading;
	await file.saveAs(path);
	return file.suggestedFilename();
}

test('backs up, then restores over the budget or as a new one', async ({ page }, testInfo) => {
	await onboard(page);
	await openSettings(page);
	await expect(page.getByTestId('last-backup')).toHaveText('Last backup: never');

	const backup = testInfo.outputPath('home.sqlite');
	expect(await download(page, 'Back up now', backup)).toMatch(
		/^moneta-home-\d{4}-\d{2}-\d{2}\.sqlite$/
	);
	await expect(page.getByTestId('last-backup')).not.toHaveText('Last backup: never');

	await page.getByLabel('Budget name').fill('Changed');
	await page.getByRole('button', { name: 'Save' }).click();
	const files = page.getByTestId('budget-files');
	await expect(files.getByRole('listitem')).toHaveText([/Changed/]);

	await page.getByLabel('Restore from a backup').setInputFiles(backup);
	const dialog = page.getByRole('dialog');
	await dialog.getByRole('button', { name: 'Replace Changed' }).click();
	await dialog.getByRole('button', { name: 'Tap again to replace' }).click();
	await expect(page.getByTestId('rta-amount')).toHaveText('$1,000.00');
	await openSettings(page);
	await expect(files.getByRole('listitem')).toHaveText([/Home/]);

	await page.getByLabel('Restore from a backup').setInputFiles(backup);
	await dialog.getByRole('button', { name: 'Add as a new budget' }).click();
	await expect(page.getByTestId('rta-amount')).toHaveText('$1,000.00');
	await openSettings(page);
	await expect(files.getByRole('listitem')).toHaveText([/Home/, /Home/]);

	await page.getByLabel('Restore from a backup').setInputFiles({
		name: 'notes.txt',
		mimeType: 'text/plain',
		buffer: Buffer.from('not a budget')
	});
	await dialog.getByRole('button', { name: 'Add as a new budget' }).click();
	await expect(dialog.getByRole('alert')).toHaveText("That file isn't a Moneta backup (.sqlite).");
});

test('exports transactions as CSV and the budget as JSON', async ({ page }, testInfo) => {
	await onboard(page);
	await openSettings(page);
	const csv = testInfo.outputPath('home.csv');
	await download(page, 'Transactions (CSV)', csv);
	expect(await readFile(csv, 'utf8')).toContain(
		',Checking,Starting Balance,,Ready to Assign,,1000.00,cleared'
	);
	const json = testInfo.outputPath('home.json');
	await download(page, 'Whole budget (JSON)', json);
	expect(JSON.parse(await readFile(json, 'utf8'))).toMatchObject({
		format: 'moneta-budget',
		meta: { name: 'Home', currency: 'USD' }
	});
});
```

- [ ] **Step 7: Run the e2e tests**

Run: `pnpm test:e2e`

Expected: all 19 pass.

- [ ] **Step 8: Commit**

Run: `pnpm test`

Expected: 305 unit tests pass.

```bash
git add src e2e
git commit -m "feat: back up, restore and export from Settings, with storage status and a backup reminder" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: Report data: spending by category and net worth

Worker side: `reports.spending({ from, to })` sums net spending per category in SQL (Decision 11), and `reports.netWorth(through)` feeds per-account monthly sums to the pure `netWorthSeries`. `transactions.list` gains a `categoryId` filter (matching split lines too) for the drill-down. Client side: date-range presets and each category's share.

**Files:**
- Create: `src/lib/db/repos/reports.ts`, `src/lib/domain/net-worth.ts`, `src/lib/reports/range.ts`, `src/lib/reports/spending.ts`
- Modify: `src/lib/db/repos/transactions.ts`, `src/lib/db/api.ts`
- Test: `src/lib/db/repos/reports.test.ts`, `src/lib/domain/net-worth.test.ts`, `src/lib/reports/range.test.ts`, `src/lib/reports/spending.test.ts`, `src/lib/db/repos/transactions.test.ts`

**Interfaces:**
- Consumes: `isDate`, `isMonth`, `monthRange`, `compareMonths`, `addMonths`, `monthOf` (Plan 1), `TransactionRow`.
- Produces:
  - `TransactionQuery.categoryId?: string`
  - `interface SpendingRow { categoryId; name; groupName; amount }` (amount > 0), `spendingByCategory(db, { from, to }): SpendingRow[]`, RPC `api.reports.spending({ from, to })`
  - `interface NetWorthPoint { month; assets; debts; netWorth }`, `netWorthSeries(changes, through): NetWorthPoint[]`, `netWorth(db, through: Month)`, RPC `api.reports.netWorth(through)`
  - `RANGE_PRESETS`, `type RangePreset`, `presetRange(preset, today): { from; to }`
  - `amountInCategory(row: TransactionRow, categoryId): number`, `withShares(rows): { total; rows: (SpendingRow & { share })[] }` (share in percent)

- [ ] **Step 1: Write the failing tests**

In `src/lib/db/repos/transactions.test.ts`, replace:

```ts

	it('pages with limit and offset', () => {
```

with:

```ts

	it('filters by category, including split lines', () => {
		expect(listTransactions(db, { categoryId: food }).map((t) => t.amount)).toEqual([-300, -100]);
		expect(
			listTransactions(db, { categoryId: fun, from: '2026-03-01' }).map((t) => t.amount)
		).toEqual([-300]);
	});

	it('pages with limit and offset', () => {
```

Create `src/lib/domain/net-worth.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { netWorthSeries } from './net-worth';

describe('netWorthSeries', () => {
	it('totals month-end balances into assets and debts', () => {
		const series = netWorthSeries(
			[
				{ accountId: 'bank', month: '2026-07', amount: 100000 },
				{ accountId: 'card', month: '2026-07', amount: -20000 },
				{ accountId: 'bank', month: '2026-09', amount: -30000 },
				{ accountId: 'card', month: '2026-09', amount: 25000 }
			],
			'2026-10'
		);
		expect(series).toEqual([
			{ month: '2026-07', assets: 100000, debts: -20000, netWorth: 80000 },
			{ month: '2026-08', assets: 100000, debts: -20000, netWorth: 80000 },
			{ month: '2026-09', assets: 75000, debts: 0, netWorth: 75000 },
			{ month: '2026-10', assets: 75000, debts: 0, netWorth: 75000 }
		]);
	});

	it('runs through the last month with data when that is later', () => {
		const series = netWorthSeries(
			[{ accountId: 'bank', month: '2026-11', amount: 500 }],
			'2026-09'
		);
		expect(series.map((p) => p.month)).toEqual(['2026-11']);
	});

	it('is empty without data', () => {
		expect(netWorthSeries([], '2026-09')).toEqual([]);
	});
});
```

Create `src/lib/reports/range.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { presetRange, RANGE_PRESETS } from './range';

describe('presetRange', () => {
	it.each([
		['this_month', '2026-09-01', '2026-09-30'],
		['last_month', '2026-08-01', '2026-08-31'],
		['last_3_months', '2026-07-01', '2026-09-30'],
		['last_12_months', '2025-10-01', '2026-09-30'],
		['this_year', '2026-01-01', '2026-12-31']
	] as const)('%s', (preset, from, to) => {
		expect(presetRange(preset, '2026-09-19')).toEqual({ from, to });
	});

	it('knows the end of February', () => {
		expect(presetRange('last_month', '2028-03-10')).toEqual({
			from: '2028-02-01',
			to: '2028-02-29'
		});
	});

	it('lists every preset', () => {
		expect(RANGE_PRESETS).toHaveLength(5);
	});
});
```

Create `src/lib/reports/spending.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type { TransactionRow } from '$lib/db/repos/transactions';
import { amountInCategory, withShares } from './spending';

const row = (fields: Partial<TransactionRow>) => ({ ...({} as TransactionRow), ...fields });

describe('amountInCategory', () => {
	it('is the amount, or the sum of the split lines in that category', () => {
		expect(amountInCategory(row({ amount: -500, isSplit: false, splits: [] }), 'food')).toBe(-500);
		const split = row({
			amount: -900,
			isSplit: true,
			splits: [
				{ id: '1', categoryId: 'food', categoryName: 'Food', amount: -300, memo: '' },
				{ id: '2', categoryId: 'fun', categoryName: 'Fun', amount: -500, memo: '' },
				{ id: '3', categoryId: 'food', categoryName: 'Food', amount: -100, memo: '' }
			]
		});
		expect(amountInCategory(split, 'food')).toBe(-400);
	});
});

describe('withShares', () => {
	it('adds each category’s share of the total, in percent', () => {
		expect(
			withShares([
				{ categoryId: 'a', name: 'Rent', groupName: 'Bills', amount: 7500 },
				{ categoryId: 'b', name: 'Food', groupName: 'Everyday', amount: 2500 }
			])
		).toEqual({
			total: 10000,
			rows: [
				{ categoryId: 'a', name: 'Rent', groupName: 'Bills', amount: 7500, share: 75 },
				{ categoryId: 'b', name: 'Food', groupName: 'Everyday', amount: 2500, share: 25 }
			]
		});
		expect(withShares([])).toEqual({ total: 0, rows: [] });
	});
});
```

The report test covers what spending must leave out: a refund, income, a card payment, a categorized transfer to an off-budget account (which counts: it is spending from the budget), and last month.

Create `src/lib/db/repos/reports.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { categoryId, createBudgetDb } from '../testing';
import type { Db } from '../connection';
import { createAccount } from './accounts';
import { readyToAssignCategoryId } from './meta';
import { netWorth, spendingByCategory } from './reports';
import { createTransaction } from './transactions';

let db: Db;
let bank: string;
let visa: string;
let broker: string;

beforeEach(async () => {
	db = await createBudgetDb();
	const base = { onBudget: true, startingDate: '2026-08-01' };
	bank = createAccount(db, { ...base, name: 'Bank', type: 'checking', startingBalance: 200000 });
	visa = createAccount(db, { ...base, name: 'Visa', type: 'credit_card', startingBalance: -50000 });
	broker = createAccount(db, {
		...base,
		name: 'Broker',
		type: 'investment',
		onBudget: false,
		startingBalance: 100000
	});
});

describe('spendingByCategory', () => {
	beforeEach(() => {
		const food = categoryId(db, 'Food');
		const rent = categoryId(db, 'Rent');
		const fun = categoryId(db, 'Fun');
		createTransaction(db, {
			accountId: bank,
			date: '2026-09-01',
			amount: -120000,
			categoryId: rent
		});
		createTransaction(db, { accountId: visa, date: '2026-09-05', amount: -8000, categoryId: food });
		createTransaction(db, {
			accountId: bank,
			date: '2026-09-10',
			amount: -5000,
			splits: [
				{ categoryId: food, amount: -3000 },
				{ categoryId: fun, amount: -2000 }
			]
		});
		// a refund, income, a card payment, an off-budget transfer and last month's spending
		createTransaction(db, { accountId: bank, date: '2026-09-11', amount: 1000, categoryId: fun });
		createTransaction(db, {
			accountId: bank,
			date: '2026-09-12',
			amount: 300000,
			categoryId: readyToAssignCategoryId(db)
		});
		createTransaction(db, {
			accountId: bank,
			date: '2026-09-15',
			amount: -8000,
			transferAccountId: visa
		});
		createTransaction(db, {
			accountId: bank,
			date: '2026-09-16',
			amount: -10000,
			transferAccountId: broker,
			categoryId: fun
		});
		createTransaction(db, { accountId: bank, date: '2026-08-20', amount: -7000, categoryId: food });
	});

	it('sums net spending per category in the date range, largest first, then by name', () => {
		expect(spendingByCategory(db, { from: '2026-09-01', to: '2026-09-30' })).toEqual([
			{ categoryId: categoryId(db, 'Rent'), name: 'Rent', groupName: 'Bills', amount: 120000 },
			{ categoryId: categoryId(db, 'Food'), name: 'Food', groupName: 'Everyday', amount: 11000 },
			{ categoryId: categoryId(db, 'Fun'), name: 'Fun', groupName: 'Everyday', amount: 11000 }
		]);
	});

	it('leaves out categories with more refunds than spending', () => {
		const rows = spendingByCategory(db, { from: '2026-09-11', to: '2026-09-11' });
		expect(rows).toEqual([]);
	});

	it('rejects invalid ranges', () => {
		expect(() => spendingByCategory(db, { from: '2026-09-30', to: '2026-09-01' })).toThrow(
			expect.objectContaining({ code: 'INVALID_INPUT' })
		);
		expect(() => spendingByCategory(db, { from: 'x', to: '2026-09-01' })).toThrow(
			expect.objectContaining({ code: 'INVALID_INPUT' })
		);
	});
});

describe('netWorth', () => {
	it('tracks every account, on and off budget, month by month', () => {
		createTransaction(db, {
			accountId: visa,
			date: '2026-09-05',
			amount: -10000,
			categoryId: categoryId(db, 'Food')
		});
		createTransaction(db, {
			accountId: bank,
			date: '2026-09-15',
			amount: -60000,
			transferAccountId: visa
		});
		expect(netWorth(db, '2026-10')).toEqual([
			{ month: '2026-08', assets: 300000, debts: -50000, netWorth: 250000 },
			{ month: '2026-09', assets: 240000, debts: 0, netWorth: 240000 },
			{ month: '2026-10', assets: 240000, debts: 0, netWorth: 240000 }
		]);
	});

	it('rejects an invalid month', () => {
		expect(() => netWorth(db, '2026-13')).toThrow(
			expect.objectContaining({ code: 'INVALID_INPUT' })
		);
	});
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm test src/lib/domain/net-worth.test.ts src/lib/reports src/lib/db/repos/reports.test.ts src/lib/db/repos/transactions.test.ts`

Expected: the four new files fail to load, and "filters by category, including split lines" fails (the filter is ignored).

- [ ] **Step 3: Implement**

Create `src/lib/domain/net-worth.ts`:

```ts
import { compareMonths, monthRange, type Month } from './month';

/** The sum of an account's transactions dated in one month. */
export interface AccountMonthChange {
	accountId: string;
	month: Month;
	amount: number;
}

export interface NetWorthPoint {
	month: Month;
	assets: number; // Σ positive account balances at the end of the month
	debts: number; // Σ negative account balances (≤ 0)
	netWorth: number;
}

/**
 * Month-end totals from the first month with data through `through` (or the last month with
 * data, if later). Each account counts as an asset or a debt by the sign of its balance.
 */
export function netWorthSeries(changes: AccountMonthChange[], through: Month): NetWorthPoint[] {
	if (changes.length === 0) return [];
	const months = changes.map((c) => c.month).sort(compareMonths);
	const last =
		compareMonths(months[months.length - 1], through) > 0 ? months[months.length - 1] : through;
	const balances = new Map<string, number>();
	return monthRange(months[0], last).map((month) => {
		for (const c of changes)
			if (c.month === month) balances.set(c.accountId, (balances.get(c.accountId) ?? 0) + c.amount);
		let assets = 0;
		let debts = 0;
		for (const balance of balances.values()) {
			if (balance > 0) assets += balance;
			else debts += balance;
		}
		return { month, assets, debts, netWorth: assets + debts };
	});
}
```

Create `src/lib/reports/range.ts`:

```ts
import { addMonths, monthOf, type Month } from '$lib/domain/month';

export const RANGE_PRESETS = [
	'this_month',
	'last_month',
	'last_3_months',
	'last_12_months',
	'this_year'
] as const;

export type RangePreset = (typeof RANGE_PRESETS)[number];

export interface DateRange {
	from: string; // YYYY-MM-DD
	to: string;
}

function lastDay(month: Month): string {
	const [y, m] = month.split('-').map(Number);
	const day = new Date(Date.UTC(y, m, 0)).getUTCDate();
	return `${month}-${String(day).padStart(2, '0')}`;
}

/** The whole months a preset covers, relative to `today` (YYYY-MM-DD). */
export function presetRange(preset: RangePreset, today: string): DateRange {
	const month = monthOf(today);
	const span = (first: Month, last: Month) => ({ from: `${first}-01`, to: lastDay(last) });
	switch (preset) {
		case 'this_month':
			return span(month, month);
		case 'last_month':
			return span(addMonths(month, -1), addMonths(month, -1));
		case 'last_3_months':
			return span(addMonths(month, -2), month);
		case 'last_12_months':
			return span(addMonths(month, -11), month);
		case 'this_year':
			return span(`${today.slice(0, 4)}-01`, `${today.slice(0, 4)}-12`);
	}
}
```

Create `src/lib/reports/spending.ts`:

```ts
import type { SpendingRow } from '$lib/db/repos/reports';
import type { TransactionRow } from '$lib/db/repos/transactions';

/** How much of a transaction falls in a category: the amount, or its split lines there. */
export function amountInCategory(row: TransactionRow, categoryId: string): number {
	if (!row.isSplit) return row.amount;
	return row.splits
		.filter((s) => s.categoryId === categoryId)
		.reduce((sum, s) => sum + s.amount, 0);
}

/** The report's total, and each category's share of it in percent. */
export function withShares(rows: SpendingRow[]): {
	total: number;
	rows: (SpendingRow & { share: number })[];
} {
	const total = rows.reduce((sum, r) => sum + r.amount, 0);
	return { total, rows: rows.map((r) => ({ ...r, share: total ? (r.amount / total) * 100 : 0 })) };
}
```

Create `src/lib/db/repos/reports.ts`:

```ts
import { DomainError } from '$lib/domain/errors';
import { isDate, isMonth, type Month } from '$lib/domain/month';
import { netWorthSeries, type AccountMonthChange, type NetWorthPoint } from '$lib/domain/net-worth';
import { all, type Db } from '../connection';

export interface SpendingRow {
	categoryId: string;
	name: string;
	groupName: string;
	amount: number; // net spending: outflows minus refunds, > 0
}

export interface SpendingQuery {
	from: string; // YYYY-MM-DD, inclusive
	to: string;
}

/**
 * Net spending per category over a date range, on-budget accounts only, largest first.
 * Income (Ready to Assign) is left out, and so are categories whose refunds outweigh spending.
 */
export function spendingByCategory(db: Db, query: SpendingQuery): SpendingRow[] {
	if (!isDate(query.from) || !isDate(query.to) || query.from > query.to)
		throw new DomainError('INVALID_INPUT', 'Invalid date range');
	return all<SpendingRow>(
		db,
		`SELECT c.id AS categoryId, c.name, g.name AS groupName, -SUM(e.amount) AS amount
		 FROM (
			SELECT t.category_id AS categoryId, t.amount
			FROM transactions t JOIN accounts a ON a.id = t.account_id
			WHERE a.on_budget = 1 AND t.is_split = 0 AND t.category_id IS NOT NULL
			  AND t.date BETWEEN :from AND :to
			UNION ALL
			SELECT s.category_id, s.amount
			FROM transaction_splits s
			JOIN transactions t ON t.id = s.transaction_id
			JOIN accounts a ON a.id = t.account_id
			WHERE a.on_budget = 1 AND t.date BETWEEN :from AND :to
		 ) e
		 JOIN categories c ON c.id = e.categoryId
		 JOIN category_groups g ON g.id = c.group_id
		 WHERE c.system IS NULL
		 GROUP BY c.id
		 HAVING SUM(e.amount) < 0
		 ORDER BY SUM(e.amount), c.name`,
		{ ':from': query.from, ':to': query.to }
	);
}

/** Month-end assets, debts and net worth across every account, through `through`. */
export function netWorth(db: Db, through: Month): NetWorthPoint[] {
	if (!isMonth(through)) throw new DomainError('INVALID_INPUT', `Invalid month ${through}`);
	const changes = all<AccountMonthChange>(
		db,
		`SELECT account_id AS accountId, substr(date, 1, 7) AS month, SUM(amount) AS amount
		 FROM transactions GROUP BY account_id, month`
	);
	return netWorthSeries(changes, through);
}
```

In `src/lib/db/repos/transactions.ts`, replace:

```ts
	accountId?: string;
	search?: string;
```

with:

```ts
	accountId?: string;
	categoryId?: string; // the transaction's category or one of its split lines'
	search?: string;
```

Then replace:

```ts
		 WHERE (:accountId IS NULL OR t.account_id = :accountId)
		   AND (:from IS NULL OR t.date >= :from)
```

with:

```ts
		 WHERE (:accountId IS NULL OR t.account_id = :accountId)
		   AND (:categoryId IS NULL OR t.category_id = :categoryId
		     OR EXISTS (SELECT 1 FROM transaction_splits s
		                WHERE s.transaction_id = t.id AND s.category_id = :categoryId))
		   AND (:from IS NULL OR t.date >= :from)
```

Then replace:

```ts
			':accountId': query.accountId ?? null,
			':from': query.from ?? null,
```

with:

```ts
			':accountId': query.accountId ?? null,
			':categoryId': query.categoryId ?? null,
			':from': query.from ?? null,
```

In `src/lib/db/api.ts`, replace:

```ts
import * as dump from './repos/dump';

```

with:

```ts
import * as dump from './repos/dump';
import * as reports from './repos/reports';

```

Then replace:

```ts
	},
	backup: {
```

with:

```ts
	},
	reports: {
		spending: read(reports.spendingByCategory),
		netWorth: read(reports.netWorth)
	},
	backup: {
```

- [ ] **Step 4: Run the tests**

Run: `pnpm test`

Expected: all 323 pass.

- [ ] **Step 5: Verify and commit**

Run: `pnpm lint && pnpm check`

Expected: clean.

```bash
git add src/lib
git commit -m "feat: spending by category and net worth report data" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: The Reports screen

`/reports` shows **Spending by category** (period picker, horizontal bar chart, table with shares and a total; choosing a category, in the table or on its bar, lists its transactions, each linking to its account) and **Net worth** (assets and debts as diverging bars, and a month table). Charts use shadcn-svelte's `chart` component on LayerChart 2. The navigation gets a fourth item, Reports (spec §5: Budget · Accounts · Reports · Settings).

Two details from checking the screen: long category names get cut off at the chart's left edge, so the chart pads 104px and shortens labels to 14 characters (the table shows them in full); and the neutral theme's chart colors are all grey, so `--chart-1` becomes teal (the app icon's color) in both themes.

**Files:**
- Create (generated): `src/lib/components/ui/chart/*`
- Create: `src/lib/components/reports/SpendingReport.svelte`, `src/lib/components/reports/NetWorthReport.svelte`, `src/routes/reports/+page.svelte`, `e2e/reports.e2e.ts`
- Modify: `src/lib/domain/money.ts`, `src/lib/client/app-state.svelte.ts`, `src/lib/components/app/AppShell.svelte`, `src/routes/layout.css`, `src/lib/i18n/messages/en.json`, `src/lib/i18n/messages/pt-BR.json`, `package.json`, `pnpm-lock.yaml`
- Test: `src/lib/domain/money.test.ts`, `e2e/reports.e2e.ts`

**Interfaces:**
- Consumes: `api.reports.*`, `transactions.list({ categoryId })`, `presetRange`, `withShares`, `amountInCategory` (Task 8), `payeeDisplay` (Plan 2).
- Produces:
  - `formatMoneyCompact(minor: number, fmt: MoneyFormat): string`, `BudgetSession.formatCompact(minor): string`
  - Route `/reports`; `data-testid="spending-table"`, `data-testid="net-worth-table"`

- [ ] **Step 1: Add the chart component**

Run: `pnpm dlx shadcn-svelte@1.7.0 add chart --yes`

Expected: `src/lib/components/ui/chart/` is created and `layerchart` (`^2.5.0`) is added to `devDependencies`.

Run: `pnpm exec prettier --write src/lib/components/ui/chart`

Then, in `src/lib/components/ui/chart/chart-tooltip.svelte`, replace:

```svelte
	function defaultFormatter(value: any, _payload: TooltipPayload[]) {
```

with:

```svelte
	function defaultFormatter(value: any) {
```

(ESLint rejects the unused parameter.)

Run: `pnpm lint && pnpm check`

Expected: clean.

- [ ] **Step 2: Write the failing formatter test**

In `src/lib/domain/money.test.ts`, replace:

```ts
import { describe, it, expect } from 'vitest';
import { currencyDigits, formatAmountInput, formatMoney, parseAmount } from './money';

```

with:

```ts
import { describe, it, expect } from 'vitest';
import {
	currencyDigits,
	formatAmountInput,
	formatMoney,
	formatMoneyCompact,
	parseAmount
} from './money';

```

Then replace:

```ts
		expect(parseAmount(text, fmt)).toBe(minor);
	});
});
```

with:

```ts
		expect(parseAmount(text, fmt)).toBe(minor);
	});
});

describe('formatMoneyCompact', () => {
	it('abbreviates large amounts for chart axes', () => {
		expect(formatMoneyCompact(123456789, USD)).toBe('$1.2M');
		expect(norm(formatMoneyCompact(150000, BRL))).toBe('R$ 1,5 mil');
		expect(formatMoneyCompact(-25000, USD)).toBe('-$250');
		expect(norm(formatMoneyCompact(1500, JPY))).toBe('￥1500');
	});
});
```

Run: `pnpm test src/lib/domain/money.test.ts`

Expected: 1 failure, `formatMoneyCompact is not a function`.

- [ ] **Step 3: Implement it**

In `src/lib/domain/money.ts`, replace:

```ts
		minor / 10 ** digits
	);
}

```

with:

```ts
		minor / 10 ** digits
	);
}

/** A short form for chart axes, e.g. "$1.2M" or "R$ 1,5 mil". */
export function formatMoneyCompact(minor: number, fmt: MoneyFormat): string {
	const digits = currencyDigits(fmt.currency);
	return new Intl.NumberFormat(fmt.locale, {
		style: 'currency',
		currency: fmt.currency,
		notation: 'compact',
		maximumFractionDigits: 1
	}).format(minor / 10 ** digits);
}

```

In `src/lib/client/app-state.svelte.ts`, replace:

```ts
import type { BudgetMeta } from '$lib/db/repos/meta';
import { formatMoney, parseAmount, type MoneyFormat } from '$lib/domain/money';
import type { RpcClient } from './rpc';
```

with:

```ts
import type { BudgetMeta } from '$lib/db/repos/meta';
import { formatMoney, formatMoneyCompact, parseAmount, type MoneyFormat } from '$lib/domain/money';
import type { RpcClient } from './rpc';
```

Then replace:

```ts

	parse = (text: string): number | null => parseAmount(text, this.money);
```

with:

```ts

	/** A short form for chart axes, e.g. "$1.2M". */
	formatCompact = (minor: number): string => formatMoneyCompact(minor, this.money);

	parse = (text: string): number | null => parseAmount(text, this.money);
```

Run: `pnpm test src/lib/domain/money.test.ts`

Expected: all pass.

- [ ] **Step 4: Add the messages and the chart color**

In `src/lib/i18n/messages/en.json`, replace:

```json
	"nav_accounts": "Accounts",
	"nav_settings": "Settings",
```

with:

```json
	"nav_accounts": "Accounts",
	"nav_reports": "Reports",
	"nav_settings": "Settings",
```

Then replace:

```json
	"transaction_cleared": "Cleared",
	"settings_saved": "Saved.",
```

with:

```json
	"transaction_cleared": "Cleared",
	"reports_spending": "Spending by category",
	"reports_period": "Period",
	"reports_range_this_month": "This month",
	"reports_range_last_month": "Last month",
	"reports_range_last_3_months": "Last 3 months",
	"reports_range_last_12_months": "Last 12 months",
	"reports_range_this_year": "This year",
	"reports_range_custom": "Custom",
	"reports_range_all": "All time",
	"reports_total": "Total",
	"reports_spent": "Spent",
	"reports_share": "Share",
	"reports_spending_empty": "No spending in this period.",
	"reports_category_transactions": "Transactions in {category}",
	"reports_net_worth": "Net worth",
	"reports_month": "Month",
	"reports_assets": "Assets",
	"reports_debts": "Debts",
	"reports_net_worth_empty": "No transactions yet.",
	"settings_saved": "Saved.",
```

In `src/lib/i18n/messages/pt-BR.json`, replace:

```json
	"nav_accounts": "Contas",
	"nav_settings": "Configurações",
```

with:

```json
	"nav_accounts": "Contas",
	"nav_reports": "Relatórios",
	"nav_settings": "Configurações",
```

Then replace:

```json
	"transaction_cleared": "Compensada",
	"settings_saved": "Salvo.",
```

with:

```json
	"transaction_cleared": "Compensada",
	"reports_spending": "Gastos por categoria",
	"reports_period": "Período",
	"reports_range_this_month": "Este mês",
	"reports_range_last_month": "Mês passado",
	"reports_range_last_3_months": "Últimos 3 meses",
	"reports_range_last_12_months": "Últimos 12 meses",
	"reports_range_this_year": "Este ano",
	"reports_range_custom": "Personalizado",
	"reports_range_all": "Todo o período",
	"reports_total": "Total",
	"reports_spent": "Gasto",
	"reports_share": "Parcela",
	"reports_spending_empty": "Nenhum gasto neste período.",
	"reports_category_transactions": "Transações em {category}",
	"reports_net_worth": "Patrimônio líquido",
	"reports_month": "Mês",
	"reports_assets": "Ativos",
	"reports_debts": "Dívidas",
	"reports_net_worth_empty": "Nenhuma transação ainda.",
	"settings_saved": "Salvo.",
```

In `src/routes/layout.css`, replace:

```css
	--ring: oklch(0.708 0 0);
	--chart-1: oklch(0.87 0 0);
	--chart-2: oklch(0.556 0 0);
```

with:

```css
	--ring: oklch(0.708 0 0);
	--chart-1: oklch(0.6 0.118 184.704);
	--chart-2: oklch(0.556 0 0);
```

Then replace:

```css
	--ring: oklch(0.556 0 0);
	--chart-1: oklch(0.87 0 0);
	--chart-2: oklch(0.556 0 0);
```

with:

```css
	--ring: oklch(0.556 0 0);
	--chart-1: oklch(0.777 0.152 181.912);
	--chart-2: oklch(0.556 0 0);
```

- [ ] **Step 5: Build the screen**

Create `src/lib/components/reports/SpendingReport.svelte`:

```svelte
<script lang="ts">
	import { resolve } from '$app/paths';
	import { BarChart } from 'layerchart';
	import * as Card from '$lib/components/ui/card';
	import * as Chart from '$lib/components/ui/chart';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { NativeSelect, NativeSelectOption } from '$lib/components/ui/native-select';
	import { payeeDisplay } from '$lib/accounts/register';
	import { useSession } from '$lib/client/app-state.svelte';
	import { useLive } from '$lib/client/live.svelte';
	import type { Table } from '$lib/db/connection';
	import type { TransactionRow } from '$lib/db/repos/transactions';
	import { todayIso } from '$lib/domain/month';
	import { errorMessage } from '$lib/i18n/errors';
	import { formatDate } from '$lib/i18n/formats';
	import { presetRange, RANGE_PRESETS, type RangePreset } from '$lib/reports/range';
	import { amountInCategory, withShares } from '$lib/reports/spending';
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';

	const session = useSession();
	const PRESETS: Record<RangePreset, () => string> = {
		this_month: m.reports_range_this_month,
		last_month: m.reports_range_last_month,
		last_3_months: m.reports_range_last_3_months,
		last_12_months: m.reports_range_last_12_months,
		this_year: m.reports_range_this_year
	};
	const TABLES: Table[] = [
		'transactions',
		'transaction_splits',
		'categories',
		'category_groups',
		'accounts'
	];

	let preset = $state<RangePreset | 'custom'>('this_month');
	let from = $state(presetRange('this_month', todayIso()).from);
	let to = $state(presetRange('this_month', todayIso()).to);
	let selected = $state<string | null>(null);

	function choosePreset() {
		if (preset !== 'custom') ({ from, to } = presetRange(preset, todayIso()));
		selected = null;
	}

	const spending = useLive(session.client, TABLES, () =>
		session.api.reports.spending({ from, to })
	);
	const report = $derived(withShares(spending.data ?? []));
	const category = $derived(report.rows.find((r) => r.categoryId === selected) ?? null);
	const transactions = useLive(session.client, [...TABLES, 'payees'], () =>
		selected
			? session.api.transactions.list({ categoryId: selected, from, to })
			: Promise.resolve<TransactionRow[]>([])
	);

	const config = { amount: { label: m.reports_spent(), color: 'var(--chart-1)' } };
	/** Long names would push the bars off the chart; the table below has them in full. */
	const shortName = (name: string) => (name.length > 14 ? `${name.slice(0, 13)}…` : name);
	const percent = $derived(
		new Intl.NumberFormat(getLocale(), { style: 'percent', maximumFractionDigits: 1 })
	);
</script>

<Card.Root>
	<Card.Header>
		<Card.Title>{m.reports_spending()}</Card.Title>
	</Card.Header>
	<Card.Content class="grid gap-4">
		<div class="grid gap-3 sm:grid-cols-3">
			<div class="grid gap-2">
				<Label for="spending-period">{m.reports_period()}</Label>
				<NativeSelect
					id="spending-period"
					class="w-full"
					bind:value={preset}
					onchange={choosePreset}
				>
					{#each RANGE_PRESETS as value (value)}
						<NativeSelectOption {value}>{PRESETS[value]()}</NativeSelectOption>
					{/each}
					<NativeSelectOption value="custom">{m.reports_range_custom()}</NativeSelectOption>
				</NativeSelect>
			</div>
			<div class="grid gap-2">
				<Label for="spending-from">{m.register_from()}</Label>
				<Input
					id="spending-from"
					type="date"
					bind:value={from}
					oninput={() => (preset = 'custom')}
				/>
			</div>
			<div class="grid gap-2">
				<Label for="spending-to">{m.register_to()}</Label>
				<Input id="spending-to" type="date" bind:value={to} oninput={() => (preset = 'custom')} />
			</div>
		</div>

		{#if spending.error}
			<p class="text-sm text-destructive" role="alert">{errorMessage(spending.error)}</p>
		{:else if spending.data && report.rows.length === 0}
			<p class="text-sm text-muted-foreground">{m.reports_spending_empty()}</p>
		{:else if report.rows.length > 0}
			<Chart.Container
				{config}
				class="aspect-auto w-full"
				style="height: {report.rows.length * 2.25 + 2.5}rem"
			>
				<BarChart
					data={report.rows}
					orientation="horizontal"
					y="name"
					x="amount"
					series={[{ key: 'amount', label: config.amount.label, color: config.amount.color }]}
					padding={{ left: 104, bottom: 24 }}
					onBarClick={(_, detail) => (selected = detail.data.categoryId)}
					props={{
						bars: { strokeWidth: 0, radius: 4 },
						xAxis: { format: session.formatCompact },
						yAxis: { format: shortName }
					}}
				/>
			</Chart.Container>

			<table class="w-full text-sm" data-testid="spending-table">
				<thead class="text-left text-xs text-muted-foreground">
					<tr>
						<th class="py-1 font-medium">{m.budget_category()}</th>
						<th class="py-1 text-right font-medium">{m.reports_spent()}</th>
						<th class="py-1 text-right font-medium">{m.reports_share()}</th>
					</tr>
				</thead>
				<tbody>
					{#each report.rows as row (row.categoryId)}
						<tr class="border-t">
							<td class="py-1.5">
								<button
									type="button"
									class="text-left hover:underline aria-pressed:font-semibold"
									aria-pressed={selected === row.categoryId}
									onclick={() => (selected = selected === row.categoryId ? null : row.categoryId)}
								>
									{row.name}
									<span class="block text-xs text-muted-foreground">{row.groupName}</span>
								</button>
							</td>
							<td class="py-1.5 text-right tabular-nums">{session.format(row.amount)}</td>
							<td class="py-1.5 text-right text-muted-foreground tabular-nums">
								{percent.format(row.share / 100)}
							</td>
						</tr>
					{/each}
				</tbody>
				<tfoot>
					<tr class="border-t font-medium">
						<td class="py-1.5">{m.reports_total()}</td>
						<td class="py-1.5 text-right tabular-nums">{session.format(report.total)}</td>
						<td></td>
					</tr>
				</tfoot>
			</table>
		{/if}

		{#if category}
			<section
				class="grid gap-2"
				aria-label={m.reports_category_transactions({ category: category.name })}
			>
				<h3 class="text-sm font-medium">
					{m.reports_category_transactions({ category: category.name })}
				</h3>
				<ul class="grid text-sm">
					{#each transactions.data ?? [] as row (row.id)}
						{@const payee = payeeDisplay(row)}
						<li class="flex items-center gap-3 border-t py-1.5">
							<span class="w-24 shrink-0 text-xs text-muted-foreground">
								{formatDate(row.date, getLocale())}
							</span>
							<a
								class="min-w-0 flex-1 truncate hover:underline"
								href={resolve('/accounts/[id]', { id: row.accountId })}
							>
								{#if payee.kind === 'transfer'}
									{payee.direction === 'to'
										? m.register_transfer_to({ account: payee.accountName })
										: m.register_transfer_from({ account: payee.accountName })}
								{:else if payee.kind === 'payee'}
									{payee.name}
								{:else}
									{row.accountName}
								{/if}
							</a>
							<span class="tabular-nums"
								>{session.format(amountInCategory(row, category.categoryId))}</span
							>
						</li>
					{/each}
				</ul>
			</section>
		{/if}
	</Card.Content>
</Card.Root>
```

Create `src/lib/components/reports/NetWorthReport.svelte`:

```svelte
<script lang="ts">
	import { BarChart } from 'layerchart';
	import * as Card from '$lib/components/ui/card';
	import * as Chart from '$lib/components/ui/chart';
	import { Label } from '$lib/components/ui/label';
	import { NativeSelect, NativeSelectOption } from '$lib/components/ui/native-select';
	import { useSession } from '$lib/client/app-state.svelte';
	import { useLive } from '$lib/client/live.svelte';
	import { currentMonth } from '$lib/domain/month';
	import { errorMessage } from '$lib/i18n/errors';
	import { formatMonth } from '$lib/i18n/formats';
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';

	const session = useSession();
	let span = $state<'last_12_months' | 'all'>('last_12_months');

	const series = useLive(session.client, ['transactions', 'accounts'], () =>
		session.api.reports.netWorth(currentMonth())
	);
	const points = $derived(span === 'all' ? (series.data ?? []) : (series.data ?? []).slice(-12));
	const chartData = $derived(
		points.map((p) => ({ ...p, label: formatMonth(p.month, getLocale()) }))
	);

	const config = {
		assets: { label: m.reports_assets(), color: 'var(--chart-1)' },
		debts: { label: m.reports_debts(), color: 'var(--destructive)' }
	};
</script>

<Card.Root>
	<Card.Header>
		<Card.Title>{m.reports_net_worth()}</Card.Title>
	</Card.Header>
	<Card.Content class="grid gap-4">
		<div class="grid gap-2 sm:max-w-xs">
			<Label for="net-worth-period">{m.reports_period()}</Label>
			<NativeSelect id="net-worth-period" class="w-full" bind:value={span}>
				<NativeSelectOption value="last_12_months">
					{m.reports_range_last_12_months()}
				</NativeSelectOption>
				<NativeSelectOption value="all">{m.reports_range_all()}</NativeSelectOption>
			</NativeSelect>
		</div>

		{#if series.error}
			<p class="text-sm text-destructive" role="alert">{errorMessage(series.error)}</p>
		{:else if series.data && points.length === 0}
			<p class="text-sm text-muted-foreground">{m.reports_net_worth_empty()}</p>
		{:else if points.length > 0}
			<Chart.Container {config} class="aspect-auto h-64 w-full">
				<BarChart
					data={chartData}
					x="label"
					seriesLayout="stackDiverging"
					series={[
						{ key: 'assets', label: config.assets.label, color: config.assets.color },
						{ key: 'debts', label: config.debts.label, color: config.debts.color }
					]}
					props={{ bars: { strokeWidth: 0 }, yAxis: { format: session.formatCompact } }}
				/>
			</Chart.Container>

			<table class="w-full text-sm" data-testid="net-worth-table">
				<thead class="text-left text-xs text-muted-foreground">
					<tr>
						<th class="py-1 font-medium">{m.reports_month()}</th>
						<th class="py-1 text-right font-medium">{m.reports_assets()}</th>
						<th class="py-1 text-right font-medium">{m.reports_debts()}</th>
						<th class="py-1 text-right font-medium">{m.reports_net_worth()}</th>
					</tr>
				</thead>
				<tbody>
					{#each [...points].reverse() as point (point.month)}
						<tr class="border-t">
							<td class="py-1.5">{formatMonth(point.month, getLocale())}</td>
							<td class="py-1.5 text-right tabular-nums">{session.format(point.assets)}</td>
							<td class="py-1.5 text-right tabular-nums">{session.format(point.debts)}</td>
							<td class="py-1.5 text-right font-medium tabular-nums">
								{session.format(point.netWorth)}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</Card.Content>
</Card.Root>
```

Create `src/routes/reports/+page.svelte`:

```svelte
<script lang="ts">
	import NetWorthReport from '$lib/components/reports/NetWorthReport.svelte';
	import SpendingReport from '$lib/components/reports/SpendingReport.svelte';
	import { m } from '$lib/paraglide/messages';
</script>

<div class="mx-auto grid max-w-3xl gap-4 p-3 md:p-6">
	<h1 class="text-xl font-semibold">{m.nav_reports()}</h1>
	<SpendingReport />
	<NetWorthReport />
</div>
<svelte:head><title>{m.nav_reports()} · {m.app_name()}</title></svelte:head>
```

In `src/lib/components/app/AppShell.svelte`, replace:

```svelte
	import { resolve } from '$app/paths';
	import LandmarkIcon from '@lucide/svelte/icons/landmark';
```

with:

```svelte
	import { resolve } from '$app/paths';
	import ChartColumnIcon from '@lucide/svelte/icons/chart-column';
	import LandmarkIcon from '@lucide/svelte/icons/landmark';
```

Then replace:

```svelte
			active: path.startsWith('/accounts')
		},
```

with:

```svelte
			active: path.startsWith('/accounts')
		},
		{
			href: resolve('/reports'),
			label: m.nav_reports(),
			icon: ChartColumnIcon,
			active: path.startsWith('/reports')
		},
```

Then replace:

```svelte
	<nav
		class="fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
		aria-label={m.nav_label()}
```

with:

```svelte
	<nav
		class="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
		aria-label={m.nav_label()}
```

Run: `pnpm lint && pnpm check`

Expected: clean.

- [ ] **Step 6: Write the e2e tests**

Create `e2e/reports.e2e.ts`:

```ts
import { expect, test, type Page } from '@playwright/test';
import { onboard } from './helpers';

async function spend(page: Page, payee: string, amount: string, category: string) {
	await page.getByRole('button', { name: 'Transaction', exact: true }).click();
	const dialog = page.getByRole('dialog');
	await dialog.getByLabel('Payee').fill(payee);
	await dialog.getByLabel('Amount', { exact: true }).fill(amount);
	await dialog.getByLabel('Category', { exact: true }).selectOption({ label: category });
	await dialog.getByRole('button', { name: 'Save' }).click();
	await expect(dialog).toBeHidden();
}

test('shows spending by category with its transactions, and net worth', async ({ page }) => {
	await onboard(page);
	await spend(page, 'Market', '60', 'Groceries');
	await spend(page, 'Bistro', '40', 'Dining Out');
	await spend(page, 'Bakery', '15', 'Groceries');

	await page.getByRole('link', { name: 'Reports' }).first().click();
	await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible();
	const table = page.getByTestId('spending-table');
	await expect(table.locator('tbody tr')).toHaveText([
		/Groceries.*\$75\.00.*65\.2%/,
		/Dining Out.*\$40\.00.*34\.8%/
	]);
	await expect(table.locator('tfoot')).toContainText('$115.00');

	await table.getByRole('button', { name: /Groceries/ }).click();
	const drill = page.getByRole('region', { name: 'Transactions in Groceries' });
	await expect(drill.getByRole('listitem')).toHaveText([/Bakery.*-\$15\.00/, /Market.*-\$60\.00/]);

	await page.getByLabel('Period').first().selectOption('last_month');
	await expect(page.getByText('No spending in this period.')).toBeVisible();

	await expect(page.getByTestId('net-worth-table').locator('tbody tr').first()).toContainText(
		'$885.00'
	);
});

test.describe('on a phone', () => {
	test.use({ viewport: { width: 390, height: 844 } });

	test('reaches Reports from the bottom navigation', async ({ page }) => {
		await onboard(page);
		await spend(page, 'Market', '60', 'Groceries');
		await spend(page, 'Electric company', '90', 'Utilities');
		await page.getByRole('link', { name: 'Reports' }).click();
		await expect(page.getByTestId('spending-table')).toContainText('Groceries');
	});
});
```

- [ ] **Step 7: Run the e2e tests**

Run: `pnpm test:e2e`

Expected: all 21 pass. To look at the screen, add `await page.screenshot({ path: test.info().outputPath('reports.png'), fullPage: true });` at the end of a reports test and open the file under `test-results/`; don't commit that line.

- [ ] **Step 8: Commit**

Run: `pnpm test`

Expected: 324 unit tests pass.

```bash
git add package.json pnpm-lock.yaml src e2e
git commit -m "feat: reports for spending by category and net worth" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 10: Installable, offline PWA with a prompt to update

Spec §8. `@vite-pwa/sveltekit` generates the manifest and a Workbox service worker that precaches the whole build, SQLite's `.wasm` and worker included, with `index.html` as the fallback for every route. With `registerType: 'prompt'`, a new version waits until the user taps "Reload" in a toast; `Boot` then waits for in-flight RPCs (`RpcClient.idle()`), releases and stops the database worker, and activates the new service worker, which reloads the page. Icons are generated from `static/icon.svg` (Decision 13). `pnpm preview` and the e2e tests serve `build/` with `sirv` (Decision 12).

`virtual:pwa-register` needs two more direct dependencies than the plugin: `vite-plugin-pwa` (its types) and `workbox-window` (it imports it; without it the build fails with `failed to resolve import "workbox-window"`). In `pnpm dev` the module is a no-op, so the dev server has no service worker.

**Files:**
- Create: `static/icon.svg`, `pwa-assets.config.js`, `e2e/pwa.e2e.ts`; generated: `static/favicon.ico`, `static/pwa-64x64.png`, `static/pwa-192x192.png`, `static/pwa-512x512.png`, `static/maskable-icon-512x512.png`, `static/apple-touch-icon-180x180.png`
- Delete: `src/lib/assets/favicon.svg` (the Svelte logo)
- Modify: `package.json`, `pnpm-lock.yaml`, `vite.config.ts`, `src/app.html`, `src/app.d.ts`, `src/routes/+layout.svelte`, `src/lib/client/rpc.ts`, `src/lib/components/app/Boot.svelte`, `src/lib/i18n/messages/en.json`, `src/lib/i18n/messages/pt-BR.json`
- Test: `src/lib/client/rpc.test.ts`, `e2e/pwa.e2e.ts`

**Interfaces:**
- Consumes: `Boot`'s `stopWorker` and `worker` (Plan 2), `toast` (svelte-sonner).
- Produces:
  - `RpcClient.idle(): Promise<void>`: resolves when no call awaits a reply (at once if none; also when the worker fails)
  - Scripts `pnpm preview` (sirv, port 4173) and `pnpm icons`
  - `/manifest.webmanifest`, `/sw.js`

- [ ] **Step 1: Write the failing `idle` tests**

In `src/lib/client/rpc.test.ts`, replace:

```ts
		expect(fatal).toHaveLength(1);
	});
});
```

with:

```ts
		expect(fatal).toHaveLength(1);
	});
});

describe('idle', () => {
	it('resolves once every call in flight has its reply', async () => {
		const client = connect(await createBudgetDb());
		expect(await client.idle()).toBeUndefined();
		const events: string[] = [];
		void client.api.meta.get().then(() => events.push('reply'));
		await client.idle();
		events.push('idle');
		expect(events).toEqual(['reply', 'idle']);
	});

	it('resolves when the worker fails', async () => {
		const { endpoint, emit } = silentEndpoint();
		const client = createRpcClient(endpoint);
		void client.api.meta.get().catch(() => {});
		const idle = client.idle();
		emit('error');
		await expect(idle).resolves.toBeUndefined();
	});
});
```

Run: `pnpm test src/lib/client/rpc.test.ts`

Expected: 2 failures, `client.idle is not a function`.

- [ ] **Step 2: Implement `idle`**

In `src/lib/client/rpc.ts`, replace:

```ts
	onFatal(listener: FatalListener): () => void;
}
```

with:

```ts
	onFatal(listener: FatalListener): () => void;
	/** Resolves once no call is waiting for its reply. */
	idle(): Promise<void>;
}
```

Then replace:

```ts
	const fatalListeners = new Set<FatalListener>();

```

with:

```ts
	const fatalListeners = new Set<FatalListener>();
	const idleWaiters: (() => void)[] = [];

	function settle(): void {
		if (pending.size === 0) for (const resolve of idleWaiters.splice(0)) resolve();
	}

```

Then replace:

```ts
		pending.clear();
		for (const l of fatalListeners) l(fatal);
```

with:

```ts
		pending.clear();
		settle();
		for (const l of fatalListeners) l(fatal);
```

Then replace:

```ts
			entry.reject(new RpcError(res.error.code, res.error.message, res.error.details));
		}
	});
	endpoint.addEventListener('error', (event) => {
```

with:

```ts
			entry.reject(new RpcError(res.error.code, res.error.message, res.error.details));
		}
		settle();
	});
	endpoint.addEventListener('error', (event) => {
```

Then replace:

```ts
			return () => fatalListeners.delete(listener);
		}
```

with:

```ts
			return () => fatalListeners.delete(listener);
		},
		idle() {
			return pending.size === 0
				? Promise.resolve()
				: new Promise<void>((resolve) => idleWaiters.push(resolve));
		}
```

Run: `pnpm test src/lib/client`

Expected: all pass.

- [ ] **Step 3: Add the dependencies and scripts**

Run: `pnpm add -D @vite-pwa/sveltekit@^1.1.0 vite-plugin-pwa@^1.3.0 workbox-window@^7.4.1 sirv-cli@^3.0.1`

In `package.json`, replace:

```json
		"preview": "vite preview",
```

with:

```json
		"preview": "sirv build --single --port 4173",
		"icons": "pnpm --allow-build=sharp dlx @vite-pwa/assets-generator@1.0.2",
```

`playwright.config.ts` already runs `pnpm build && pnpm preview` on port 4173, so it now tests the build the way a static host serves it.

- [ ] **Step 4: Draw and generate the icons**

Create `static/icon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
	<rect width="512" height="512" rx="96" fill="#0f766e" />
	<circle cx="256" cy="256" r="150" fill="none" stroke="#ffffff" stroke-width="28" />
	<path
		d="M186 326V186l70 84 70-84v140"
		fill="none"
		stroke="#ffffff"
		stroke-width="32"
		stroke-linecap="round"
		stroke-linejoin="round"
	/>
</svg>
```

Create `pwa-assets.config.js`:

```js
// Generates the app icons in static/ from static/icon.svg: `pnpm icons`.
// A plain object (no import) so it runs through `pnpm dlx` without another dependency.
const background = '#0f766e';

export default {
	headLinkOptions: { preset: '2023' },
	preset: {
		transparent: { sizes: [64, 192, 512], favicons: [[48, 'favicon.ico']] },
		maskable: { sizes: [512], padding: 0.3, resizeOptions: { background } },
		apple: { sizes: [180], padding: 0.3, resizeOptions: { background } }
	},
	images: ['static/icon.svg']
};
```

Run: `pnpm icons`

Expected: `✔ PWA assets generated`, and `static/` now holds `favicon.ico`, `pwa-64x64.png`, `pwa-192x192.png`, `pwa-512x512.png`, `maskable-icon-512x512.png` and `apple-touch-icon-180x180.png`. The first run downloads the generator and `sharp` (`--allow-build=sharp` lets pnpm build it). Open `static/maskable-icon-512x512.png`: the teal must fill the whole square, with the white ring and "M" in the middle.

Run: `git rm src/lib/assets/favicon.svg`

- [ ] **Step 5: Configure the PWA**

In `vite.config.ts`, replace:

```ts
import { sveltekit } from '@sveltejs/kit/vite';

```

with:

```ts
import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';

```

Then replace:

```ts
			adapter: adapter({ fallback: 'index.html' })
		}),
```

with:

```ts
			adapter: adapter({ fallback: 'index.html' })
		}),
		SvelteKitPWA({
			// Ask before updating (spec §8): the app shows a "Reload" toast.
			registerType: 'prompt',
			injectRegister: false,
			// SvelteKit builds with relative asset paths; the service worker must live at the root.
			base: '/',
			scope: '/',
			kit: { adapterFallback: 'index.html', spa: true },
			manifest: {
				name: 'Moneta',
				short_name: 'Moneta',
				description: 'Zero-based envelope budgeting that stays on your device.',
				theme_color: '#0f766e',
				background_color: '#ffffff',
				display: 'standalone',
				start_url: '/',
				scope: '/',
				icons: [
					{ src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
					{ src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
					{ src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
					{
						src: 'maskable-icon-512x512.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'maskable'
					}
				]
			},
			workbox: {
				// Precache everything, including SQLite's WebAssembly, so the app works offline.
				globPatterns: ['client/**/*.{js,css,html,ico,png,svg,webp,woff2,wasm,webmanifest}'],
				maximumFileSizeToCacheInBytes: 5 * 1024 * 1024
			}
		}),
```

In `src/app.html`, replace:

```html
		<meta name="text-scale" content="scale" />
		%sveltekit.head%
```

with:

```html
		<meta name="text-scale" content="scale" />
		<link rel="icon" href="%sveltekit.assets%/favicon.ico" sizes="48x48" />
		<link rel="icon" href="%sveltekit.assets%/icon.svg" type="image/svg+xml" />
		<link rel="apple-touch-icon" href="%sveltekit.assets%/apple-touch-icon-180x180.png" />
		<link rel="manifest" href="%sveltekit.assets%/manifest.webmanifest" />
		<meta name="theme-color" content="#0f766e" />
		%sveltekit.head%
```

In `src/app.d.ts`, replace:

```ts
// See https://svelte.dev/docs/kit/types#app.d.ts
```

with:

```ts
/// <reference types="vite-plugin-pwa/client" />
// See https://svelte.dev/docs/kit/types#app.d.ts
```

In `src/routes/+layout.svelte`, replace:

```svelte
	import { ModeWatcher } from 'mode-watcher';
	import favicon from '$lib/assets/favicon.svg';
	import { Toaster } from '$lib/components/ui/sonner';
```

with:

```svelte
	import { ModeWatcher } from 'mode-watcher';
	import { Toaster } from '$lib/components/ui/sonner';
```

Then replace:

```svelte
<svelte:head>
	<link rel="icon" href={favicon} />
	<title>{m.app_name()}</title>
```

with:

```svelte
<svelte:head>
	<title>{m.app_name()}</title>
```

- [ ] **Step 6: Register the service worker and offer updates**

In `src/lib/i18n/messages/en.json`, replace:

```json
	"startup_reload": "Reload",
	"startup_storage_unavailable_title": "Storage isn't available",
```

with:

```json
	"startup_reload": "Reload",
	"update_available": "A new version of Moneta is available.",
	"startup_storage_unavailable_title": "Storage isn't available",
```

In `src/lib/i18n/messages/pt-BR.json`, replace:

```json
	"startup_reload": "Recarregar",
	"startup_storage_unavailable_title": "O armazenamento não está disponível",
```

with:

```json
	"startup_reload": "Recarregar",
	"update_available": "Uma nova versão do Moneta está disponível.",
	"startup_storage_unavailable_title": "O armazenamento não está disponível",
```

In `src/lib/components/app/Boot.svelte`, replace:

```svelte
	import { onMount, type Snippet } from 'svelte';
	import { goto } from '$app/navigation';
```

with:

```svelte
	import { onMount, type Snippet } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { registerSW } from 'virtual:pwa-register';
	import { goto } from '$app/navigation';
```

Then replace:

```svelte
	import { currentMonth } from '$lib/domain/month';
	import AppShell from './AppShell.svelte';
```

with:

```svelte
	import { currentMonth } from '$lib/domain/month';
	import { m } from '$lib/paraglide/messages';
	import AppShell from './AppShell.svelte';
```

Then replace:

```svelte

	onMount(() => {
		void (async () => {
```

with:

```svelte

	/**
	 * Installs a waiting app update (spec §8): let in-flight calls finish, close the database
	 * cleanly, then activate the new service worker, which reloads the page.
	 */
	async function applyUpdate(update: (reload: boolean) => Promise<void>) {
		app.boot = { kind: 'loading' };
		await worker?.idle();
		await stopWorker();
		await update(true);
	}

	onMount(() => {
		const update = registerSW({
			onNeedRefresh() {
				toast(m.update_available(), {
					duration: Number.POSITIVE_INFINITY,
					action: { label: m.startup_reload(), onClick: () => void applyUpdate(update) }
				});
			}
		});
		void (async () => {
```

Run: `pnpm lint && pnpm check && pnpm build`

Expected: clean, and the build log ends its PWA section with `precache  120 entries` (the count may differ by a few). `build/sw.js` lists `index.html`, `manifest.webmanifest` and `_app/immutable/workers/assets/sqlite3-….wasm`.

- [ ] **Step 7: Write the e2e tests**

Create `e2e/pwa.e2e.ts`:

```ts
import { expect, test } from '@playwright/test';
import { onboard } from './helpers';

test('keeps working offline after the first load', async ({ page, context }) => {
	await onboard(page);
	// The service worker precaches the app (including SQLite's WebAssembly) on install.
	await page.evaluate(async () => {
		await navigator.serviceWorker.ready;
	});
	await page.reload();
	await expect(page.getByTestId('rta-amount')).toHaveText('$1,000.00');
	expect(await page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);

	await context.setOffline(true);
	await page.reload();
	await expect(page.getByTestId('rta-amount')).toHaveText('$1,000.00');
	await page.goto('/accounts');
	await expect(page.getByRole('heading', { name: 'Accounts' })).toBeVisible();
});

test('can be installed', async ({ page }) => {
	await page.goto('/');
	const href = await page.locator('link[rel="manifest"]').getAttribute('href');
	const manifest = await (await page.request.get(href!)).json();
	expect(manifest).toMatchObject({ name: 'Moneta', display: 'standalone', start_url: '/' });
	const purposes = manifest.icons.map((i: { purpose?: string }) => i.purpose ?? 'any');
	expect(purposes).toContain('maskable');
	for (const icon of manifest.icons) {
		expect((await page.request.get(icon.src)).ok(), icon.src).toBe(true);
	}
});
```

- [ ] **Step 8: Run the e2e tests**

Run: `pnpm test:e2e`

Expected: all 23 pass.

- [ ] **Step 9: Check the update prompt by hand**

The update flow needs two different builds, so it has no automated test. Check it once:

1. `pnpm build && pnpm preview`, open http://localhost:4173, create a budget, and reload once (the service worker now controls the page).
2. Stop the preview. Change `"app_name": "Moneta"` to `"app_name": "Moneta 2"` in `src/lib/i18n/messages/en.json`, then `pnpm build && pnpm preview` again.
3. In the open tab, make the browser check for the new service worker: DevTools → Application → Service workers → "Update".
4. Expected: the toast "A new version of Moneta is available." with "Reload". Tapping it shows "Opening your budget…", then the page reloads with the tab title "Budget · Moneta 2" and the budget unchanged.
5. Undo the `app_name` change.

- [ ] **Step 10: Commit**

Run: `pnpm test`

Expected: 326 unit tests pass.

```bash
git add package.json pnpm-lock.yaml pwa-assets.config.js vite.config.ts static src e2e
git commit -m "feat: installable offline PWA with a prompt to update" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 11: Measure the recompute, record the rulings, update the docs

Plan 1 follow-up: measure the budget recompute. A Vitest benchmark builds a heavy budget and times `getBudgetMonth`, split into the SQL load and the engine. The spec gains this plan's decisions, the follow-ups file marks Plan 3 done with the measurement, and the README and `CLAUDE.md` describe the finished app.

**Files:**
- Create: `src/lib/db/repos/budget.bench.ts`
- Modify: `package.json`, `README.md`, `CLAUDE.md`, `docs/superpowers/specs/2026-09-19-moneta-v1-design.md`, `docs/superpowers/plans/2026-09-19-moneta-plan-1-followups.md`

**Interfaces:**
- Consumes: everything above.
- Produces:
  - Script `pnpm bench`; docs only otherwise

- [ ] **Step 1: Add the benchmark**

Create `src/lib/db/repos/budget.bench.ts`:

```ts
import { bench, describe } from 'vitest';
import { computeBudget } from '$lib/domain/budget-engine';
import { addMonths, monthRange } from '$lib/domain/month';
import { createBudgetDb } from '../testing';
import { run, tx, type Db } from '../connection';
import { createAccount } from './accounts';
import { loadEngineInput } from './aggregates';
import { createCategory, createGroup } from './categories';
import { getBudgetMonth, setAssigned } from './budget';
import { readyToAssignCategoryId } from './meta';
import { createTransaction } from './transactions';

const YEARS = 5;
const CATEGORIES = 40;
const SPENDING_PER_MONTH = 150;
const LAST = '2026-09';

/**
 * A heavy personal budget: 5 years, 40 categories, a checking account and a card,
 * 150 purchases a month (about 9,000 transactions) and an assignment per category and month.
 */
async function bigBudget(): Promise<Db> {
	const db = await createBudgetDb();
	const base = { onBudget: true, startingBalance: 0, startingDate: '2021-10-01' };
	const bank = createAccount(db, { ...base, name: 'Bank', type: 'checking' });
	const card = createAccount(db, { ...base, name: 'Card', type: 'credit_card' });
	const group = createGroup(db, { name: 'Bench' });
	const categories = Array.from({ length: CATEGORIES }, (_, i) =>
		createCategory(db, { groupId: group, name: `Category ${i + 1}` })
	);
	const income = readyToAssignCategoryId(db);
	tx(db, () => {
		for (const month of monthRange(addMonths(LAST, -12 * YEARS + 1), LAST)) {
			createTransaction(db, {
				accountId: bank,
				date: `${month}-01`,
				amount: 1_000_000,
				categoryId: income
			});
			categories.forEach((id) => setAssigned(db, id, month, 20_000));
			for (let i = 0; i < SPENDING_PER_MONTH; i++) {
				createTransaction(db, {
					accountId: i % 3 === 0 ? card : bank,
					date: `${month}-${String((i % 28) + 1).padStart(2, '0')}`,
					amount: -(1_000 + ((i * 37) % 5_000)),
					categoryId: categories[i % CATEGORIES]
				});
			}
		}
	});
	run(db, 'ANALYZE');
	return db;
}

const db = await bigBudget();
const input = loadEngineInput(db);

describe('budget recompute', () => {
	bench('getBudgetMonth, 5 years of history', () => {
		getBudgetMonth(db, LAST);
	});

	bench('loadEngineInput (SQL only)', () => {
		loadEngineInput(db);
	});

	bench('computeBudget (engine only)', () => {
		computeBudget(input, LAST);
	});
});
```

In `package.json`, replace:

```json
		"test": "vitest --run",
		"test:e2e": "playwright test"
	},
```

with:

```json
		"test": "vitest --run",
		"test:e2e": "playwright test",
		"bench": "vitest bench --run"
	},
```

Run: `pnpm bench`

Expected: three rows, in this order of magnitude on a laptop: `getBudgetMonth, 5 years of history` about 100 ms mean, `loadEngineInput (SQL only)` about 85 ms, `computeBudget (engine only)` about 10 ms. Note your numbers; if they differ a lot, use yours in the follow-ups text below. `pnpm test` doesn't run `*.bench.ts` files.

- [ ] **Step 2: Update the spec**

Don't run Prettier on `docs/`.

In `docs/superpowers/specs/2026-09-19-moneta-v1-design.md`, replace:

```markdown
      worker.ts            # opens SQLite (OPFS SAH-pool), dispatches RPC
      migrations/          # 0001_init.sql, ... ; tracked via PRAGMA user_version
      repos/               # accounts.ts, categories.ts, transactions.ts, budget.ts, reports.ts, payees.ts
      aggregates.sql.ts    # SQL aggregation queries feeding the budget engine
```

with:

```markdown
      worker.ts            # opens SQLite (OPFS SAH-pool), dispatches RPC
      system.ts            # budget files: open + migrate, pre-migration copies, export/import
      backup.ts            # restore validation (§6)
      migrations/          # 0001_init.sql, ... ; tracked via PRAGMA user_version
      repos/               # accounts.ts, categories.ts, transactions.ts, budget.ts, reports.ts, payees.ts, dump.ts
      aggregates.sql.ts    # SQL aggregation queries feeding the budget engine
```

Then replace:

```markdown
    backup/
      target.ts            # BackupTarget { save(blob), list(), load(id) }
      file-target.ts       # v1: download / upload .sqlite
      export-csv.ts
      export-json.ts
    i18n/                  # messages/en.json, messages/pt-BR.json
```

with:

```markdown
    backup/
      target.ts            # BackupTarget { save(fileName, blob) }; cloud targets would add listing and loading
      file-target.ts       # v1: downloads (a restore reads a file the user picks)
      export-csv.ts
      actions.ts           # back up (.sqlite), export CSV and JSON (the JSON is dumped by repos/dump.ts)
      reminder.ts
    reports/               # date-range presets, spending shares
    i18n/                  # messages/en.json, messages/pt-BR.json
```

Then replace:

```markdown

- **Spending by category** for a date range: bar chart plus table, drilling down into the transactions.
- **Net worth over time:** month-end totals across all accounts (on- and off-budget), split into assets and debts.

### Settings — `/settings`

- **Budget files:** create, rename, switch, delete (with a confirm step).
- **Budget details:** currency and locale for the current budget.
- **App:** UI language (en / pt-BR), theme.
- **Backup:**
  - Export `.sqlite`.
  - Restore `.sqlite`: replace the current budget (with a confirm step) or import it as a new budget.
  - Export transactions as CSV and the full budget as JSON.
  - Shows the last backup date. A reminder toast appears after 14 days without a backup.
- **Storage:** whether persistence was granted, and space used.
```

with:

```markdown

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
```

Then replace:

```markdown
  4. `user_version` ≤ app schema version; older files are migrated.
  Only after all checks pass is the current file replaced.

## 7. Migrations

- Ordered SQL files, applied when a DB is opened, inside a transaction, with `PRAGMA user_version` tracking the version.
- Before migrating, a timestamped `.sqlite` copy is saved in OPFS; the last 3 are kept.

```

with:

```markdown
  4. `user_version` ≤ app schema version; older files are migrated.
  Only after all checks pass is the current file replaced. The checks run on an in-memory copy, and fail with `BACKUP_NOT_SQLITE`, `BACKUP_DAMAGED`, `BACKUP_NOT_MONETA` or `SCHEMA_TOO_NEW`.

## 7. Migrations

- Ordered SQL files, applied when a DB is opened, inside a transaction, with `PRAGMA user_version` tracking the version. Foreign keys are off while migrating, so a migration can rebuild a table without cascading deletes; each migration must leave `PRAGMA foreign_key_check` clean.
- Before migrating, a timestamped `.sqlite` copy is saved in OPFS (`premigration-<budget file>-<timestamp>.sqlite3`); the last 3 per budget are kept, and they are deleted with their budget. The OPFS pool grows as needed before any file is created.

```

Then replace:

```markdown
- Prompt-to-update: a "New version available · Reload" toast. Reloading waits for in-flight RPCs, closes the DB cleanly, then activates the new service worker.
- Manifest with standard and maskable icons. Install works on Android, desktop Chrome/Edge, and iOS (Add to Home Screen).

```

with:

```markdown
- Prompt-to-update: a "New version available · Reload" toast. Reloading waits for in-flight RPCs, closes the DB cleanly, then activates the new service worker.
- Manifest with standard and maskable icons (generated from `static/icon.svg`). Install works on Android, desktop Chrome/Edge, and iOS (Add to Home Screen).
- The service worker lives at the site root, so the app must be served from a domain root. `pnpm preview` and the e2e tests serve `build/` with a plain static server, as a host would.

```

- [ ] **Step 3: Update the follow-ups**

In `docs/superpowers/plans/2026-09-19-moneta-plan-1-followups.md`, replace:

```markdown

## Plan 3 (reports, backup, PWA)

- **Pre-migration backup (spec §7), and SAH pool capacity:** call `reserveMinimumCapacity` before creating backup copies, since the initial capacity is 12. This must land before any `0002_*.sql` migration.
- **Migrations that rebuild tables** need `PRAGMA foreign_keys = OFF` outside the transaction. The current `migrate` loop can't do that.
- **Performance:** measure the budget recompute. Every read reloads all history; that's fine at MVP scale.
- ~~**Dev smoke route**~~: done in Plan 2. The route and its test were removed; the app's own e2e tests cover the worker, OPFS persistence and RPC.
- **Budget files UI:** the registry (`src/lib/client/registry.ts`) and `createBudget` (`src/lib/client/session.ts`) are ready for Settings → Budget files. Switching budgets means closing the worker's database, opening the other file, and replacing `AppState.session` (the shell is keyed on the file).

```

with:

```markdown

## Plan 3 (reports, backup, PWA): done

Plan 3 (`2026-09-19-moneta-plan-3-reports-backup-pwa.md`) resolved every item:

- **Pre-migration backup (spec §7), and SAH pool capacity:** opening a budget whose schema is older saves a `premigration-…` copy first and keeps the last 3. The pool reserves room (`reserveMinimumCapacity`) before any file is created.
- **Migrations that rebuild tables:** `migrate` turns foreign keys off around the loop and checks `PRAGMA foreign_key_check` before each commit.
- **Performance:** `pnpm bench` measures the recompute on a heavy budget (5 years, 40 categories, about 9,000 transactions): about 105 ms per `budget.month` read, of which about 85 ms is loading the rows from SQL and about 10 ms is the engine. That's acceptable for v1. If it becomes a problem, trim what `loadEngineInput` reads before touching the engine.
- ~~**Dev smoke route**~~: done in Plan 2. The route and its test were removed; the app's own e2e tests cover the worker, OPFS persistence and RPC.
- **Budget files UI:** Settings → Budget files creates, switches and deletes budgets; Budget details renames the open one. `AppState.show` replaces the session, and the shell remounts.

```

- [ ] **Step 4: Update the README and CLAUDE.md**

In `README.md`, replace:

```markdown

> **Status:** the core (budget engine, database, typed RPC to the SQLite worker) and the app UI (budget, accounts, register, transactions, in English and Brazilian Portuguese) are done. Reports, backup/restore and the installable PWA come next. See `docs/superpowers/specs/` for the design and `docs/superpowers/plans/` for the implementation plans.

```

with:

```markdown

> **Status:** v1 is feature-complete: the budget, accounts and transactions, reports (spending by category, net worth), multiple budget files, backup and restore (`.sqlite`), CSV and JSON exports, and an installable PWA that works offline, in English and Brazilian Portuguese. See `docs/superpowers/specs/` for the design and `docs/superpowers/plans/` for the implementation plans.

```

Then replace:

```markdown

The `build/` folder can go on any static host. No special headers (COOP/COEP) are needed.

```

with:

```markdown

The `build/` folder can go on any static host that serves `index.html` for unknown paths. No special headers (COOP/COEP) are needed. Serve it from the root of a domain: the service worker, which makes the app work offline, is registered at `/`.

## Your data

Each budget is one SQLite file in the browser's private storage (OPFS). Settings → Backup saves it as a `.sqlite` file and restores one, and Moneta reminds you when your last backup is more than two weeks old. Before an app update changes a budget's schema, Moneta keeps a copy of the old file in the same storage (the last three).

The app icons in `static/` are generated from `static/icon.svg` with `pnpm icons`.

```

Then replace:

````markdown
pnpm test:unit      # watch mode
```
````

with:

````markdown
pnpm test:unit      # watch mode
pnpm bench          # time the budget recompute on a large budget
```
````

Then replace:

```markdown
src/lib/transactions/  transaction form logic
src/lib/i18n/          message catalogs (en, pt-BR), error messages, labels and formats
```

with:

```markdown
src/lib/transactions/  transaction form logic
src/lib/reports/       report logic (date ranges, spending shares)
src/lib/backup/        backups, CSV and JSON exports, the backup reminder
src/lib/i18n/          message catalogs (en, pt-BR), error messages, labels and formats
```

In `CLAUDE.md`, replace:

```markdown
- Design spec: `docs/superpowers/specs/2026-09-19-moneta-v1-design.md` (source of truth)
- Plans: `docs/superpowers/plans/`. Plan 1 (core) and Plan 2 (app UI) are done; Plan 3 (reports, backup, PWA) is to come. Open follow-ups: `docs/superpowers/plans/2026-09-19-moneta-plan-1-followups.md`.

```

with:

```markdown
- Design spec: `docs/superpowers/specs/2026-09-19-moneta-v1-design.md` (source of truth)
- Plans: `docs/superpowers/plans/`. Plans 1 (core), 2 (app UI) and 3 (reports, backup, PWA) are done. Follow-ups and measurements: `docs/superpowers/plans/2026-09-19-moneta-plan-1-followups.md`.

```

Then replace:

```markdown
pnpm test src/lib/db  # a subset, by path
pnpm test:e2e         # builds, then runs Playwright in Chromium
pnpm lint             # Prettier check + ESLint
```

with:

```markdown
pnpm test src/lib/db  # a subset, by path
pnpm test:e2e         # builds, then runs Playwright in Chromium against `pnpm preview`
pnpm preview          # serves ./build with a static server (sirv), like a host would
pnpm bench            # times the budget recompute on a large budget
pnpm icons            # regenerates the PWA icons in static/ from static/icon.svg
pnpm lint             # Prettier check + ESLint
```

Then replace:

```markdown
- `src/lib/domain/`: pure TS (money, months, budget engine, quick-assign). No DB, no DOM.
- `src/lib/db/`: runs only in the worker. Schema and migrations, repos, RPC surface (`api.ts`), dispatcher.
- `src/lib/client/`: main thread. Typed RPC client (`rpc.ts`), worker start (`db.ts`), `liveQuery` (`live.ts`) and `useLive` (`live.svelte.ts`), tab lock, budget registry and session, app state (`app-state.svelte.ts`: `useSession()`), `runAction`/`notifyError` (`notify.ts`).
- `src/lib/budget/`, `src/lib/accounts/`, `src/lib/transactions/`: pure, unit-tested screen logic (grid model, category order, account defaults, register display, transaction form rules).
- `src/lib/i18n/`: message catalogs (`messages/en.json`, `messages/pt-BR.json`), error messages, labels for system rows, formats. Paraglide compiles them into `src/lib/paraglide/` (generated, not committed).
- `src/lib/components/`: Svelte components by area (`app/`, `budget/`, `accounts/`, `transactions/`); `ui/` holds the generated shadcn-svelte primitives.
- `src/routes/`: SvelteKit pages (`ssr = false`, `adapter-static` with an `index.html` fallback). The root layout's `Boot` claims the tab lock, starts the worker and renders onboarding, a startup screen or the app.
- `e2e/`: Playwright tests against the production build.
```

with:

```markdown
- `src/lib/domain/`: pure TS (money, months, budget engine, quick-assign). No DB, no DOM.
- `src/lib/db/`: runs only in the worker. Schema and migrations, repos, RPC surface (`api.ts`), dispatcher. `system.ts` holds the budget-file calls (`api.system.*`) over a `FileStore`: the OPFS pool in `worker.ts`, in-memory databases in tests (`memoryFileStore`). `backup.ts` checks restores.
- `src/lib/client/`: main thread. Typed RPC client (`rpc.ts`), worker start (`db.ts`), `liveQuery` (`live.ts`) and `useLive` (`live.svelte.ts`), tab lock, budget registry and session, app state (`app-state.svelte.ts`: `useSession()`), `runAction`/`notifyError` (`notify.ts`).
- `src/lib/budget/`, `src/lib/accounts/`, `src/lib/transactions/`, `src/lib/reports/`: pure, unit-tested screen logic (grid model, category order, account defaults, register display, transaction form rules, report ranges).
- `src/lib/backup/`: backups (`.sqlite`), CSV and JSON exports, the backup reminder. Files go out through a `BackupTarget` (downloads in v1).
- `src/lib/i18n/`: message catalogs (`messages/en.json`, `messages/pt-BR.json`), error messages, labels for system rows, formats. Paraglide compiles them into `src/lib/paraglide/` (generated, not committed).
- `src/lib/components/`: Svelte components by area (`app/`, `budget/`, `accounts/`, `transactions/`, `reports/`, `settings/`); `ui/` holds the generated shadcn-svelte primitives (`chart/` wraps LayerChart).
- `src/routes/`: SvelteKit pages (`ssr = false`, `adapter-static` with an `index.html` fallback). The root layout's `Boot` claims the tab lock, starts the worker, registers the service worker (`@vite-pwa/sveltekit`, prompt to update) and renders onboarding, a startup screen or the app.
- `e2e/`: Playwright tests against the production build.
```

Then replace:

```markdown
- IDs are UUIDv7 (`uuidv7`). Dates are `'YYYY-MM-DD'` and months `'YYYY-MM'`. Booleans are 0/1 in SQL and `boolean` in repo results.
- Schema changes are new numbered files in `src/lib/db/migrations/`, tracked by `PRAGMA user_version`. Never edit an applied migration.
- No COOP/COEP headers or server code: the OPFS SAH-pool VFS doesn't need them, and the build must work on any static host.
```

with:

```markdown
- IDs are UUIDv7 (`uuidv7`). Dates are `'YYYY-MM-DD'` and months `'YYYY-MM'`. Booleans are 0/1 in SQL and `boolean` in repo results.
- Schema changes are new numbered files in `src/lib/db/migrations/`, added to `MIGRATIONS` and tracked by `PRAGMA user_version`. Never edit an applied migration. Migrations run with foreign keys off and must leave `PRAGMA foreign_key_check` clean; opening an older budget saves a copy first.
- No COOP/COEP headers or server code: the OPFS SAH-pool VFS doesn't need them, and the build must work on any static host.
```

- [ ] **Step 5: Verify everything and commit**

Run: `pnpm lint && pnpm check && pnpm test && pnpm test:e2e`

Expected: no lint or type problems, 326 unit tests and 23 e2e tests pass.

```bash
git add package.json src/lib/db/repos/budget.bench.ts README.md CLAUDE.md docs/superpowers/specs/2026-09-19-moneta-v1-design.md docs/superpowers/plans/2026-09-19-moneta-plan-1-followups.md
git commit -m "docs: record the Plan 3 rulings and measure the budget recompute" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Spec coverage

| Spec requirement | Where |
| --- | --- |
| §1 basic reports: spending by category, net worth | Tasks 8, 9 |
| §1 multiple budget files | Tasks 4, 5 |
| §1 backup: export/restore `.sqlite`, CSV and JSON exports, backup reminders | Tasks 3, 4, 6, 7 |
| §2 layout: `backup/` (target, file target, CSV, JSON), `repos/reports.ts` | Tasks 6, 7, 8 (Decision 6 narrows `BackupTarget`) |
| §2 LayerChart for reports, `@vite-pwa/sveltekit` | Tasks 9, 10 |
| §2 switching budgets closes and reopens the DB in the worker | Tasks 4, 5 |
| §5 bottom nav Budget · Accounts · Reports · Settings | Task 9 |
| §5 Reports: spending bar chart + table with drill-down; net worth split into assets and debts | Tasks 8, 9 |
| §5 Settings → Budget files (create, rename, switch, delete with confirm) | Tasks 4, 5 |
| §5 Settings → Budget details (currency, locale) | Task 5 |
| §5 Settings → Backup (export, restore replace/new with confirm, CSV, JSON, last backup date, 14-day reminder) | Tasks 6, 7 |
| §5 Settings → Storage (persistence granted, space used) | Task 7 |
| §6 restore validation in order, current file replaced only after all checks | Tasks 3, 4 |
| §6 domain errors mapped to i18n messages | Tasks 3, 5 |
| §7 migrations in a transaction; timestamped copy before migrating, last 3 kept | Tasks 1, 2 |
| §8 everything precached, offline after first load | Task 10 |
| §8 prompt to update; reload waits for in-flight RPCs and closes the DB | Task 10 |
| §8 manifest with standard and maskable icons | Task 10 |
| §9 integration: export/restore round-trip and restore validation | Tasks 3, 4 |
| §9 e2e: export then restore; offline after reload | Tasks 7, 10 |
| Plan 1 follow-ups for Plan 3 (pre-migration backup and pool capacity, FK-off migrations, performance, budget files UI) | Tasks 1, 2, 4, 5, 11 |

Every v1 requirement is now covered across Plans 1–3. The spec's "out of scope" list (file import, scheduled transactions, cloud backup, …) stays out.
