# Moneta Plan 2: App UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Moneta's app UI on top of the Plan 1 core, in English and Brazilian Portuguese. It covers single-tab startup, onboarding, the budget screen (assigning, quick-assign, category management), accounts and the register, and the transaction form, and it resolves the Plan 1 follow-ups for Plan 2.

**Architecture:** The root layout's `Boot` component claims single-tab ownership (Web Locks), starts the SQLite worker and opens the last budget through Plan 1's RPC client. It then renders onboarding, a full-screen startup message, or the app shell. Screens read with `useLive`, a `liveQuery` that re-runs when a write touches its tables, and write through `runAction`, which turns domain errors into translated inline messages. The rules live in pure TypeScript modules (`client/`, `budget/`, `accounts/`, `transactions/`) with unit tests. The Svelte components stay thin and are covered by Playwright tests against the production build.

**Tech Stack:** SvelteKit 2, Svelte 5 (runes), TypeScript (strict), Tailwind CSS 4, shadcn-svelte 1.7 (bits-ui 2), Paraglide JS 2, mode-watcher, svelte-sonner, @lucide/svelte, Vitest 4, Playwright, and Plan 1's sqlite-wasm worker.

**Spec:** `docs/superpowers/specs/2026-09-19-moneta-v1-design.md`. Read it together with the Plan 1 follow-ups (`docs/superpowers/plans/2026-09-19-moneta-plan-1-followups.md`), whose Plan 2 section this plan resolves. Plan 1 (`2026-09-19-moneta-plan-1-core.md`) built the modules this plan calls.

**Plan series:** This is Plan 2 of 3. Plan 3 covers reports, backup/export/restore, pre-migration backups, the rest of Settings (budget files, budget details, backup, storage), the PWA manifest and service worker, and the remaining E2E flows (export/restore, offline).

**How this plan was checked:** every task was applied in order to a fresh clone of the repo. After each task, the formatter, ESLint, svelte-check and the unit tests ran clean, and so did the e2e tests where the task runs them. Each "verify it fails" step failed as described. The code blocks are the files that produced those runs. Copy them exactly, and apply the "replace … with …" edits to the file as it stands at that task.

## Decisions made for this plan

The Plan 1 follow-ups left four product questions open. The first two were decided with the project owner:

1. **Ready to Assign can't be used on credit card accounts** (`CATEGORY_NOT_ALLOWED`), whether on the transaction, a split line, or the card leg of an off-budget → card transfer. Income on a card would pay down debt without adding cash, so the engine charged it back as overspending the next month. Record income in a cash account and pay the card. (Task 2; the form hides the option in Task 14.)
2. **The system groups keep their place.** Income, which the budget grid doesn't show, and then Credit Card Payments always come first, whatever order is saved (Task 2). They can't be dragged, and categories never move into or out of them (Task 11).
3. **Loan and investment accounts default to off-budget**, in onboarding and when adding accounts. The switch stays visible (Task 7).
4. **Transfers show as "Transfer to/from ‹account›"** in the register, linking to that account. In the payee field they appear as "Transfer: ‹account›" (Tasks 12, 14).

Other choices, each recorded in the spec or follow-ups by Task 16:

- **Closing a credit card** also requires its payment category's available to be 0 (`CC_PAYMENT_NOT_EMPTY`), as the follow-ups asked.
- **The budget registry** lives in localStorage and isn't mirrored to an OPFS JSON file. It is a cache, rebuilt from the worker's file list and each file's `meta` name.
- **Onboarding** is rendered by `Boot` when no budget exists, instead of living at an `/onboarding` route.
- **Tab takeover:** the waiting tab queues for the Web Lock, then asks over a `BroadcastChannel`. The owner calls `system.release()` (close the DB, pause the SAH pool), terminates its worker and releases the lock.
- **The register** pages in 100 rows at a time and uses `content-visibility: auto` instead of a virtualization library.
- **The payee combobox** is a native `<input list>` with a `<datalist>`. It supports create-on-type and works well on phones.
- **The dev smoke route** from Plan 1 is removed. It would start a second worker in the same tab, and the new e2e tests cover what it checked. That also resolves its Plan 3 follow-up.

## Global Constraints

- Amounts are integer minor units everywhere. Display them with `session.format(minor)`, parse typed text with `session.parse(text)` (budget currency and locale, arithmetic allowed), and prefill inputs with `formatAmountInput`. Never use floats for money.
- The main thread never imports `$lib/db/repos/*`, `$lib/db/connection` (types excepted) or `@sqlite.org/sqlite-wasm`. All data goes through the RPC client (Plan 1 rule).
- Every user-facing string comes from Paraglide (`m.<key>()` from `$lib/paraglide/messages`). The only exception is the language names in Settings, which stay in their own language. `en.json` and `pt-BR.json` keep identical keys and placeholders. System rows stored in English are shown through `$lib/i18n/labels`.
- Links and navigation use `resolve()` from `$app/paths` with a route id, e.g. `resolve('/budget/[month]', { month })`. ESLint's `svelte/no-navigation-without-resolve` enforces it outside `src/lib/components/ui/`.
- Phone layout is the default. The `md:` breakpoint (768px) switches to desktop: sidebar instead of bottom nav, dialogs instead of bottom sheets, and the Assigned column shown.
- Svelte 5 runes only (`$props`, `$state`, `$derived`, `$effect`). Call `useLive` during component initialization. The RPC client snapshots state proxies itself (Task 3), so pass `$state` values to `session.api` directly.
- Form writes go through `runAction`, which returns `null` or an inline message and also toasts unexpected errors. Read failures show `errorMessage(error)` inline.
- `data-testid` is used only where a test needs it. Each task's Produces lists the ids it adds.
- Formatting is Prettier (tabs, single quotes; the Tailwind plugin sorts classes). `pnpm lint`, `pnpm check` and `pnpm test` stay clean at every commit. Run `pnpm test:e2e` whenever a task says to.
- `pnpm test:e2e` builds the app and serves it with `vite preview` first (about 10 s). Chromium must be installed (`pnpm exec playwright install chromium`; see the README).
- The first Paraglide compile downloads its plugins from jsDelivr (cached in `project.inlang/cache/`), so it needs network access once.
- Scaffolding CLIs are pinned: `sv@0.17.0` and `shadcn-svelte@1.7.0`. The libraries they add are recorded in `package.json` and `pnpm-lock.yaml`.
- Each commit message ends with a blank line followed by `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`. The commit commands below pass it as a second `-m`.
- sqlite-wasm prints `sqlite3_step() rc= …` lines when a statement fails on purpose in tests. That output is harmless.

## File Structure

```
src/lib/domain/money.ts, month.ts        # Task 1: stricter parsing, formatAmountInput, month range
src/lib/domain/errors.ts                 # Task 2: ERROR_CODES const array (+ CC_PAYMENT_NOT_EMPTY, WORKER_FAILED)
src/lib/db/repos/*.ts                    # Task 2: card rulings, pinned system groups
src/lib/db/api.ts, dispatcher.ts, worker.ts  # Task 3: system.release, pool retry
src/lib/client/
  transferable.svelte.ts   # $state.snapshot for RPC arguments               (Task 3)
  rpc.ts, db.ts            # failure paths, onFatal, DbWorker                 (Task 3)
  registry.ts              # budget file registry (localStorage cache)        (Task 5)
  tab-lock.ts              # Web Locks ownership + takeover                   (Task 6)
  session.ts               # openLastBudget, createBudget, startupError       (Task 7)
  testing.ts               # memoryStore, createTestClient (tests only)       (Tasks 5, 7)
  app-state.svelte.ts      # BootState, AppState, BudgetSession, useSession   (Task 8)
  notify.ts                # runAction, notifyError                           (Task 8)
  live.svelte.ts           # useLive                                          (Task 9)
src/lib/i18n/
  messages/en.json, pt-BR.json  # every UI string                             (Task 4)
  errors.ts, labels.ts, defaults.ts, formats.ts                               (Task 4)
src/lib/accounts/account-form.ts   # account defaults and sections           (Task 7)
src/lib/accounts/register.ts       # register display helpers                (Task 12)
src/lib/budget/view.ts             # grid model, pill tone                   (Task 9)
src/lib/budget/order.ts            # edit-order moves                        (Task 11)
src/lib/transactions/form.ts       # transaction form rules                  (Task 14)
src/lib/components/
  ui/                      # shadcn-svelte primitives (generated)            (Task 4)
  ResponsiveDialog.svelte  # dialog on desktop, bottom sheet on phones       (Task 10)
  app/        Boot, StartupScreen, Onboarding (Task 8), AppShell (Tasks 13, 15)
  budget/     MonthPicker, RtaCard, AvailablePill, BudgetGrid (Task 9), AssignedInput,
              QuickAssignButtons, CategorySheet, GroupSheet (Task 10), CategorySettings,
              AddGroupDialog, OrderEditor (Task 11)
  accounts/   AccountFields (Task 8), AccountList, AddAccountDialog, AccountSettingsDialog (Task 13),
              RegisterRow (Task 12)
  transactions/  TransactionForm, TransactionDialog                          (Task 15)
src/routes/
  +layout.svelte           # css, theme, toasts, Boot                        (Tasks 4, 8)
  +page.ts                 # / → current month                               (Task 9)
  budget/[month]/          # budget screen                                   (Tasks 9-11)
  accounts/, accounts/[id]/  # accounts page, register                       (Tasks 12, 13, 15)
  settings/                # language and theme                              (Task 13)
e2e/                       # Playwright tests and helpers                    (Tasks 8-15)
```

Unit tests sit next to their modules (`*.test.ts`). Playwright tests live in `e2e/` (`*.e2e.ts`, matched by the existing `playwright.config.ts`).

---

### Task 1: Harden month and amount input

Plan 1 follow-ups: months get the same 1900–2199 year range as dates, and `parseAmount` stops guessing. It rejects inconsistent separators, more decimals than the currency has, and stray letters, but still accepts the budget currency's own symbol or code. `formatAmountInput` gives the editable text for an existing amount; the inputs in later tasks prefill with it.

**Files:**
- Modify: `src/lib/domain/month.ts`
- Modify: `src/lib/domain/money.ts`
- Test: `src/lib/domain/month.test.ts`
- Test: `src/lib/domain/money.test.ts`

**Interfaces:**
- Consumes: Plan 1's `month.ts` and `money.ts`.
- Produces:
  - `isMonth(value)` is false outside the years 1900–2199
  - `parseAmount(input: string, fmt: MoneyFormat): number | null`, stricter as described above
  - `formatAmountInput(minor: number, fmt: MoneyFormat): string`: no symbol, no grouping, Latin digits, ASCII minus, e.g. `"1234,50"` in pt-BR; `parseAmount` reads it back exactly

- [ ] **Step 1: Write the failing tests**

In `src/lib/domain/month.test.ts`, replace:

```ts
		expect(isMonth('2026-13')).toBe(false);
		expect(isMonth('2026-9')).toBe(false);
	});

```

with:

```ts
		expect(isMonth('2026-13')).toBe(false);
		expect(isMonth('2026-9')).toBe(false);
	});

	it('only accepts months in the years 1900 to 2199', () => {
		expect(isMonth('1899-12')).toBe(false);
		expect(isMonth('1900-01')).toBe(true);
		expect(isMonth('2199-12')).toBe(true);
		expect(isMonth('2200-01')).toBe(false);
		expect(isMonth('9999-01')).toBe(false);
	});

```

Replace `src/lib/domain/money.test.ts` (`-12.345` in USD moves from the accepted list to the rejected one):

```ts
import { describe, it, expect } from 'vitest';
import { currencyDigits, formatAmountInput, formatMoney, parseAmount } from './money';

const BRL = { currency: 'BRL', locale: 'pt-BR' };
const USD = { currency: 'USD', locale: 'en-US' };
const JPY = { currency: 'JPY', locale: 'ja-JP' };
const norm = (s: string) => s.replace(/\s/g, ' ');

describe('currencyDigits', () => {
	it('knows minor unit digits', () => {
		expect(currencyDigits('BRL')).toBe(2);
		expect(currencyDigits('JPY')).toBe(0);
	});

	it('rejects unknown and malformed currencies', () => {
		expect(() => currencyDigits('XYZ')).toThrow(RangeError);
		expect(() => currencyDigits('AB')).toThrow(RangeError);
	});
});

describe('formatMoney', () => {
	it('formats minor units in the budget locale', () => {
		expect(norm(formatMoney(123456, BRL))).toBe('R$ 1.234,56');
		expect(formatMoney(-123450, USD)).toBe('-$1,234.50');
		expect(formatMoney(1234, JPY)).toBe('￥1,234');
	});
});

describe('parseAmount', () => {
	it.each([
		['1.234,56', BRL, 123456],
		['12,5', BRL, 1250],
		['12.50', BRL, 1250],
		['1.234', BRL, 123400],
		['1,234.56', USD, 123456],
		['12.5', USD, 1250],
		['1,234', USD, 123400],
		['R$ 10', BRL, 1000],
		['R$1.234,56', BRL, 123456],
		['BRL 10', BRL, 1000],
		['$12.50', USD, 1250],
		['1.234.567', BRL, 123456700],
		['120+35', USD, 15500],
		['100 - 20,5', BRL, 7950],
		['3*1.10', USD, 330],
		['(10+5)/2', USD, 750],
		['-12.34', USD, -1234],
		['\u221212,34', BRL, -1234],
		['.5', USD, 50],
		['1500', JPY, 1500],
		['0', USD, 0]
	])('parses %s', (input, fmt, expected) => {
		expect(parseAmount(input, fmt)).toBe(expected);
	});

	it.each(['', 'abc', '1+', '(1', '1/0', '1..2.3,4'])('rejects %s', (input) => {
		expect(parseAmount(input, USD)).toBeNull();
	});

	it.each([
		['1e5', USD],
		['12a3', USD],
		['US$ 5', BRL],
		['1.234,567', USD],
		['-12.345', USD],
		['1,23,456', USD],
		['1.234.56', BRL],
		['1.2,34', BRL],
		['12.5', JPY]
	])('rejects ambiguous or mistyped %s', (input, fmt) => {
		expect(parseAmount(input, fmt)).toBeNull();
	});
});

describe('formatAmountInput', () => {
	it.each([
		[123456, BRL, '1234,56'],
		[-1250, USD, '-12.50'],
		[1500, JPY, '1500'],
		[-1250, { currency: 'SEK', locale: 'sv-SE' }, '-12,50']
	])('formats %i for editing and parses back', (minor, fmt, text) => {
		expect(formatAmountInput(minor, fmt)).toBe(text);
		expect(parseAmount(text, fmt)).toBe(minor);
	});
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test src/lib/domain`

Expected: FAIL. `formatAmountInput` is not exported, `isMonth('9999-01')` is true, and inputs like `1e5` still parse.

- [ ] **Step 3: Implement**

In `src/lib/domain/month.ts`, replace:

```ts
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isMonth(value: string): boolean {
	return MONTH_RE.test(value);
}

```

with:

```ts
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

// A typo year (e.g. 9999) would make the budget engine walk far too many months.
const MIN_YEAR = 1900;
const MAX_YEAR = 2199;

function inYearRange(year: number): boolean {
	return year >= MIN_YEAR && year <= MAX_YEAR;
}

export function isMonth(value: string): boolean {
	return MONTH_RE.test(value) && inYearRange(Number(value.slice(0, 4)));
}

```

Then replace:

```ts
	if (!m) return false;
	const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
	if (y < 1900 || y > 2199) return false; // a typo year would make the engine walk far too many months
	const date = new Date(Date.UTC(y, mo - 1, d));
	return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
```

with:

```ts
	if (!m) return false;
	const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
	if (!inYearRange(y)) return false;
	const date = new Date(Date.UTC(y, mo - 1, d));
	return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
```

Replace `src/lib/domain/money.ts`:

```ts
export interface MoneyFormat {
	currency: string; // ISO 4217, e.g. 'BRL'
	locale: string; // BCP 47, e.g. 'pt-BR'
}

const SUPPORTED_CURRENCIES = new Set(Intl.supportedValuesOf('currency'));

export function currencyDigits(currency: string): number {
	if (!SUPPORTED_CURRENCIES.has(currency)) throw new RangeError(`Unknown currency ${currency}`);
	return (
		new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions()
			.maximumFractionDigits ?? 2
	);
}

export function formatMoney(minor: number, fmt: MoneyFormat): string {
	const digits = currencyDigits(fmt.currency);
	return new Intl.NumberFormat(fmt.locale, { style: 'currency', currency: fmt.currency }).format(
		minor / 10 ** digits
	);
}

/** The editable text for an amount: no currency symbol and no grouping, e.g. "1234,50" in pt-BR. */
export function formatAmountInput(minor: number, fmt: MoneyFormat): string {
	const digits = currencyDigits(fmt.currency);
	return new Intl.NumberFormat(fmt.locale, {
		minimumFractionDigits: digits,
		maximumFractionDigits: digits,
		useGrouping: false,
		numberingSystem: 'latn'
	})
		.format(minor / 10 ** digits)
		.replace('\u2212', '-');
}

function decimalSeparator(locale: string): string {
	const part = new Intl.NumberFormat(locale).formatToParts(1.5).find((p) => p.type === 'decimal');
	return part?.value ?? '.';
}

/**
 * Reads one number such as "1.234,56", "1,234.56", "12.5" or ".5".
 * - When both '.' and ',' appear, the last one is the decimal separator and the other groups thousands.
 * - A lone separator is decimal when it is the locale's decimal separator or is not followed by exactly 3 digits.
 * - A grouped integer part is 1–3 digits and then groups of exactly 3, all with the same separator.
 * - More decimals than the currency has are ambiguous ("1.234,567", "12.345" in USD) and rejected.
 */
function parseNumberToken(token: string, decimalSep: string, maxDecimals: number): number | null {
	if (/[.,]{2}|[.,]$/.test(token)) return null;
	const separators = token.replace(/\d/g, '');
	if (separators === '') return Number(token);
	const lastIndex = Math.max(token.lastIndexOf('.'), token.lastIndexOf(','));
	const mixed = separators.includes('.') && separators.includes(',');
	const loneDecimal =
		separators.length === 1 &&
		(token[lastIndex] === decimalSep || token.length - lastIndex - 1 !== 3);
	const decimalIndex = mixed || loneDecimal ? lastIndex : -1;
	const intPart = decimalIndex === -1 ? token : token.slice(0, decimalIndex);
	const fraction = decimalIndex === -1 ? '' : token.slice(decimalIndex + 1);
	if (fraction.length > maxDecimals) return null;
	const groups = intPart.split(/[.,]/);
	if (groups.length > 1) {
		const groupSeparators = new Set(intPart.replace(/\d/g, ''));
		if (
			groupSeparators.size > 1 ||
			(decimalIndex !== -1 && groupSeparators.has(token[decimalIndex]))
		)
			return null;
		if (groups[0].length < 1 || groups[0].length > 3) return null;
		if (groups.slice(1).some((g) => g.length !== 3)) return null;
	}
	return Number(`${groups.join('') || '0'}.${fraction || '0'}`);
}

/** The strings that may stand for the budget currency in typed input, longest first. */
function currencySymbols(fmt: MoneyFormat): string[] {
	const symbols = new Set([fmt.currency]);
	for (const currencyDisplay of ['symbol', 'narrowSymbol'] as const) {
		const part = new Intl.NumberFormat(fmt.locale, {
			style: 'currency',
			currency: fmt.currency,
			currencyDisplay
		})
			.formatToParts(1)
			.find((p) => p.type === 'currency');
		if (part) symbols.add(part.value);
	}
	return [...symbols].sort((a, b) => b.length - a.length);
}

type Token = { kind: 'num'; value: number } | { kind: 'op'; value: string };

function tokenize(input: string, decimalSep: string, maxDecimals: number): Token[] | null {
	const tokens: Token[] = [];
	const re = /\s*(?:([\d.,]+)|([-+*/()]))/y;
	let pos = 0;
	if (/[^\d.,+\-*/()\s]/.test(input)) return null; // letters and other symbols are typos
	const trimmed = input.trim();
	while (pos < trimmed.length) {
		re.lastIndex = pos;
		const m = re.exec(trimmed);
		if (!m) return null;
		if (m[1] !== undefined) {
			const value = parseNumberToken(m[1], decimalSep, maxDecimals);
			if (value === null) return null;
			tokens.push({ kind: 'num', value });
		} else {
			tokens.push({ kind: 'op', value: m[2] });
		}
		pos = re.lastIndex;
	}
	return tokens;
}

// Grammar: expr := term (('+'|'-') term)* ; term := factor (('*'|'/') factor)* ;
// factor := ('-'|'+') factor | number | '(' expr ')'
function evaluate(tokens: Token[]): number | null {
	let i = 0;
	const peek = () => tokens[i];
	const isOp = (v: string) => peek()?.kind === 'op' && peek()!.value === v;

	function factor(): number | null {
		if (isOp('-')) {
			i++;
			const v = factor();
			return v === null ? null : -v;
		}
		if (isOp('+')) {
			i++;
			return factor();
		}
		if (isOp('(')) {
			i++;
			const v = expr();
			if (!isOp(')')) return null;
			i++;
			return v;
		}
		const t = peek();
		if (t?.kind === 'num') {
			i++;
			return t.value;
		}
		return null;
	}

	function term(): number | null {
		let left = factor();
		while (left !== null && (isOp('*') || isOp('/'))) {
			const op = tokens[i++].value;
			const right = factor();
			if (right === null) return null;
			if (op === '/' && right === 0) return null;
			left = op === '*' ? left * right : left / right;
		}
		return left;
	}

	function expr(): number | null {
		let left = term();
		while (left !== null && (isOp('+') || isOp('-'))) {
			const op = tokens[i++].value;
			const right = term();
			if (right === null) return null;
			left = op === '+' ? left + right : left - right;
		}
		return left;
	}

	const result = expr();
	return i === tokens.length ? result : null;
}

/**
 * Parses user input like "1.234,56", "R$ 12,50" or "120+35" into integer minor units.
 * Returns null for anything ambiguous or malformed rather than guessing.
 */
export function parseAmount(input: string, fmt: MoneyFormat): number | null {
	let text = input.replace(/\u2212/g, '-'); // some locales format negatives with U+2212
	for (const symbol of currencySymbols(fmt)) text = text.split(symbol).join(' ');
	const digits = currencyDigits(fmt.currency);
	const tokens = tokenize(text, decimalSeparator(fmt.locale), digits);
	if (!tokens || tokens.length === 0) return null;
	const value = evaluate(tokens);
	if (value === null || !Number.isFinite(value)) return null;
	const scaled = value * 10 ** digits;
	const rounded = Math.sign(scaled) * Math.round(Math.abs(scaled));
	return rounded === 0 ? 0 : rounded;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test src/lib/domain`

Expected: PASS (all domain tests).

- [ ] **Step 5: Format, check and commit**

```bash
pnpm exec prettier --write src/lib/domain/month.ts src/lib/domain/month.test.ts src/lib/domain/money.ts src/lib/domain/money.test.ts
```

Run: `pnpm lint && pnpm check`

Expected: Prettier, ESLint and svelte-check report no problems.

Run: `pnpm test`

Expected: every unit test passes.

```bash
git add src/lib/domain/month.ts src/lib/domain/month.test.ts src/lib/domain/money.ts src/lib/domain/money.test.ts
git commit -m "fix: clamp months to 1900-2199 and reject ambiguous amounts" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```


---


### Task 2: Apply the credit card and category-order rulings in the repos

Three rulings from the Plan 1 follow-ups, enforced where the data lives:

1. Ready to Assign can't be used on a credit card, whether as the transaction's category, a split line, or the card leg of an off-budget → card transfer (`CATEGORY_NOT_ALLOWED`). Income on a card would pay down debt without adding cash, and the engine then showed it as overspending the next month.
2. Closing a credit card also requires its payment category's available to be 0 (`CC_PAYMENT_NOT_EMPTY`). Closing hides that category, so money left in it would drop out of view.
3. `saveCategoryOrder` always puts the system groups first (Income at 0, Credit Card Payments at 1), whatever order the UI sends.

`ErrorCode` becomes a const array, so the UI can check that every code has a message. `WORKER_FAILED` is added now for Task 3.

**Files:**
- Modify: `src/lib/domain/errors.ts`
- Modify: `src/lib/db/repos/transactions.ts`
- Modify: `src/lib/db/repos/accounts.ts`
- Modify: `src/lib/db/repos/categories.ts`
- Test: `src/lib/db/repos/transactions.test.ts`
- Test: `src/lib/db/repos/accounts.test.ts`
- Test: `src/lib/db/repos/categories.test.ts`

**Interfaces:**
- Consumes: `createAccount`, `createTransaction`, `setAssigned`, `saveCategoryOrder`, `readyToAssignCategoryId`, `computeBudget`, `categoryMonth`, `loadEngineInput` from Plan 1.
- Produces:
  - `ERROR_CODES` (readonly array) and `type ErrorCode = (typeof ERROR_CODES)[number]`, now including `CC_PAYMENT_NOT_EMPTY` and `WORKER_FAILED`
  - `closeAccount` throws `CC_PAYMENT_NOT_EMPTY` for a card whose payment category isn't empty
  - Transactions throw `CATEGORY_NOT_ALLOWED` for Ready to Assign on a card
  - `saveCategoryOrder` keeps Income and Credit Card Payments at sort orders 0 and 1

- [ ] **Step 1: Write the failing tests**

In `src/lib/db/repos/transactions.test.ts`, replace:

```ts
} from './transactions';
import { listPayees } from './payees';

const code = (c: string) => expect.objectContaining({ code: c });
```

with:

```ts
} from './transactions';
import { listPayees } from './payees';
import { readyToAssignCategoryId } from './meta';

const code = (c: string) => expect.objectContaining({ code: c });
```

Then replace:

```ts
				categoryId: categoryId(db, 'Visa')
			})
		).toThrow(code('CATEGORY_NOT_ALLOWED'));
	});

	it('validates amount and date', () => {
```

with:

```ts
				categoryId: categoryId(db, 'Visa')
			})
		).toThrow(code('CATEGORY_NOT_ALLOWED'));
	});

	it('refuses Ready to Assign on credit cards, even in splits and transfer legs', () => {
		const rta = readyToAssignCategoryId(db);
		const on = { date: '2026-01-05', amount: 1000 };
		expect(() => createTransaction(db, { ...on, accountId: visa, categoryId: rta })).toThrow(
			code('CATEGORY_NOT_ALLOWED')
		);
		expect(() =>
			createTransaction(db, {
				...on,
				accountId: visa,
				splits: [
					{ categoryId: rta, amount: 500 },
					{ categoryId: food, amount: 500 }
				]
			})
		).toThrow(code('CATEGORY_NOT_ALLOWED'));
		expect(() =>
			createTransaction(db, {
				...on,
				accountId: broker,
				amount: -1000,
				transferAccountId: visa,
				categoryId: rta
			})
		).toThrow(code('CATEGORY_NOT_ALLOWED'));
		// A refund to a spending category is still fine, and so is income on a cash account.
		expect(() => createTransaction(db, { ...on, accountId: visa, categoryId: food })).not.toThrow();
		expect(() => createTransaction(db, { ...on, accountId: bank, categoryId: rta })).not.toThrow();
	});

	it('validates amount and date', () => {
```

In `src/lib/db/repos/accounts.test.ts`, replace:

```ts
} from './accounts';
import { createTransaction, listTransactions } from './transactions';

const code = (c: string) => expect.objectContaining({ code: c });
```

with:

```ts
} from './accounts';
import { createTransaction, listTransactions } from './transactions';
import { setAssigned } from './budget';
import { currentMonth } from '$lib/domain/month';

const code = (c: string) => expect.objectContaining({ code: c });
```

Then replace:

```ts
	});

	it('deletes only accounts without transactions, removing card categories', async () => {
		const db = await createBudgetDb();
```

with:

```ts
	});

	it('closes a card only when its payment category is empty', async () => {
		const db = await createBudgetDb();
		const card = createAccount(db, acct({ name: 'Visa', type: 'credit_card' }));
		const payment = one<{ id: string }>(db, 'SELECT id FROM categories WHERE cc_account_id = ?', [
			card
		])!.id;
		setAssigned(db, payment, currentMonth(), 5000);
		expect(() => closeAccount(db, card)).toThrow(code('CC_PAYMENT_NOT_EMPTY'));
		setAssigned(db, payment, currentMonth(), 0);
		closeAccount(db, card);
		expect(getAccount(db, card).closed).toBe(true);
	});

	it('deletes only accounts without transactions, removing card categories', async () => {
		const db = await createBudgetDb();
```

In `src/lib/db/repos/categories.test.ts`, replace:

```ts
	});

	it('refuses to move categories into system groups', async () => {
		const db = await createBudgetDb();
```

with:

```ts
	});

	it('keeps the system groups first whatever order is saved', async () => {
		const db = await createBudgetDb();
		const [income, cards, bills, everyday] = listCategoryTree(db);
		saveCategoryOrder(
			db,
			[everyday, cards, bills, income].map((g) => ({
				groupId: g.id,
				categoryIds: g.categories.map((c) => c.id)
			}))
		);
		expect(listCategoryTree(db).map((g) => g.name)).toEqual([
			'Income',
			'Credit Card Payments',
			'Everyday',
			'Bills'
		]);
	});

	it('refuses to move categories into system groups', async () => {
		const db = await createBudgetDb();
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test src/lib/db/repos`

Expected: FAIL in the three new tests. Ready to Assign is accepted on the card, the card closes, and Income ends up last.

- [ ] **Step 3: Implement**

Replace `src/lib/domain/errors.ts`:

```ts
export const ERROR_CODES = [
	'INVALID_INPUT',
	'NOT_FOUND',
	'ALREADY_INITIALIZED',
	'SCHEMA_TOO_NEW',
	'NO_DATABASE_OPEN',
	'UNKNOWN_METHOD',
	'STORAGE_UNAVAILABLE',
	'ACCOUNT_CLOSED',
	'ACCOUNT_HAS_TRANSACTIONS',
	'ACCOUNT_BALANCE_NOT_ZERO',
	'CC_PAYMENT_NOT_EMPTY',
	'CATEGORY_REQUIRED',
	'CATEGORY_NOT_ALLOWED',
	'SYSTEM_ENTITY_READONLY',
	'GROUP_NOT_EMPTY',
	'REASSIGN_REQUIRED',
	'SPLIT_TOO_FEW_LINES',
	'SPLIT_SUM_MISMATCH',
	'TRANSFER_INVALID',
	'WORKER_FAILED',
	'INTERNAL'
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export class DomainError extends Error {
	constructor(
		public readonly code: ErrorCode,
		message: string = code,
		public readonly details?: unknown
	) {
		super(message);
		this.name = 'DomainError';
	}
}
```

`checkUsableCategory` now takes the on-budget account whose rules apply:

In `src/lib/db/repos/transactions.ts`, replace:

```ts
}

/** Categories that transactions may use: anything except card payment categories. */
function checkUsableCategory(db: Db, id: string): void {
	const row = one<{ ccAccountId: string | null }>(
		db,
		'SELECT cc_account_id AS ccAccountId FROM categories WHERE id = ?',
		[id]
	);
```

with:

```ts
}

/**
 * Categories a transaction may use on `account` (the on-budget leg): never card payment
 * categories, and not Ready to Assign on a credit card. Income recorded on a card would pay
 * down debt without adding cash, so it could not be assigned; it belongs in a cash account.
 */
function checkUsableCategory(db: Db, id: string, account: AccountInfo): void {
	const row = one<{ ccAccountId: string | null; system: string | null }>(
		db,
		'SELECT cc_account_id AS ccAccountId, system FROM categories WHERE id = ?',
		[id]
	);
```

Then replace:

```ts
			'Card payment categories are managed automatically'
		);
}

```

with:

```ts
			'Card payment categories are managed automatically'
		);
	if (row.system === 'ready_to_assign' && account.type === 'credit_card')
		throw new DomainError('CATEGORY_NOT_ALLOWED', 'Income cannot be recorded on a credit card');
}

```

Then replace:

```ts
		}
		if (!categoryId) throw new DomainError('CATEGORY_REQUIRED');
		checkUsableCategory(db, categoryId);
		return account.onBudget
			? { mainCategoryId: categoryId, pair: { accountId: other.id, categoryId: null }, splits: [] }
```

with:

```ts
		}
		if (!categoryId) throw new DomainError('CATEGORY_REQUIRED');
		checkUsableCategory(db, categoryId, account.onBudget ? account : other);
		return account.onBudget
			? { mainCategoryId: categoryId, pair: { accountId: other.id, categoryId: null }, splits: [] }
```

Then replace:

```ts
			if (!Number.isSafeInteger(s.amount))
				throw new DomainError('INVALID_INPUT', 'Amount must be an integer');
			checkUsableCategory(db, s.categoryId);
			sum += s.amount;
		}
```

with:

```ts
			if (!Number.isSafeInteger(s.amount))
				throw new DomainError('INVALID_INPUT', 'Amount must be an integer');
			checkUsableCategory(db, s.categoryId, account);
			sum += s.amount;
		}
```

Then replace:

```ts
	}

	if (categoryId) checkUsableCategory(db, categoryId);
	else if (account.type !== 'credit_card') throw new DomainError('CATEGORY_REQUIRED');
	return { mainCategoryId: categoryId, pair: null, splits: [] };
```

with:

```ts
	}

	if (categoryId) checkUsableCategory(db, categoryId, account);
	else if (account.type !== 'credit_card') throw new DomainError('CATEGORY_REQUIRED');
	return { mainCategoryId: categoryId, pair: null, splits: [] };
```

In `src/lib/db/repos/accounts.ts`, replace:

```ts
import { uuidv7 } from 'uuidv7';
import { DomainError } from '$lib/domain/errors';
import { all, nowIso, one, run, tx, type Db } from '../connection';
import { readyToAssignCategoryId, systemGroupId } from './meta';
import { createTransaction } from './transactions';
```

with:

```ts
import { uuidv7 } from 'uuidv7';
import { categoryMonth, computeBudget } from '$lib/domain/budget-engine';
import { DomainError } from '$lib/domain/errors';
import { currentMonth } from '$lib/domain/month';
import { all, nowIso, one, run, tx, type Db } from '../connection';
import { loadEngineInput } from './aggregates';
import { readyToAssignCategoryId, systemGroupId } from './meta';
import { createTransaction } from './transactions';
```

Then replace:

```ts
}

export function closeAccount(db: Db, id: string): void {
	tx(db, () => {
		const account = getAccount(db, id);
		if (account.balance !== 0) throw new DomainError('ACCOUNT_BALANCE_NOT_ZERO');
		run(db, 'UPDATE accounts SET closed = 1 WHERE id = ?', [id]);
		run(db, 'UPDATE categories SET hidden = 1 WHERE cc_account_id = ?', [id]);
```

with:

```ts
}

/** What a card's payment category holds at the end of the budget (this month or the last month with data). */
function cardPaymentAvailable(db: Db, cardId: string): number {
	const category = one<{ id: string }>(db, 'SELECT id FROM categories WHERE cc_account_id = ?', [
		cardId
	]);
	if (!category) return 0;
	const comp = computeBudget(loadEngineInput(db), currentMonth());
	return categoryMonth(comp, comp.last, category.id).available;
}

export function closeAccount(db: Db, id: string): void {
	tx(db, () => {
		const account = getAccount(db, id);
		if (account.balance !== 0) throw new DomainError('ACCOUNT_BALANCE_NOT_ZERO');
		// Closing hides the payment category, so money left there would silently disappear from view.
		if (account.type === 'credit_card' && cardPaymentAvailable(db, id) !== 0)
			throw new DomainError('CC_PAYMENT_NOT_EMPTY');
		run(db, 'UPDATE accounts SET closed = 1 WHERE id = ?', [id]);
		run(db, 'UPDATE categories SET hidden = 1 WHERE cc_account_id = ?', [id]);
```

In `src/lib/db/repos/categories.ts`, replace:

```ts
}

/** Persists drag-and-drop order: group order, category order and group membership. */
export function saveCategoryOrder(
```

with:

```ts
}

/** System groups keep these positions; user groups follow in the order saved. */
const SYSTEM_GROUP_ORDER = { income: 0, credit_card_payments: 1 } as const;

/** Persists drag-and-drop order: group order, category order and group membership. */
export function saveCategoryOrder(
```

Then replace:

```ts
): void {
	tx(db, () => {
		layout.forEach((entry, gi) => {
			const group = getGroup(db, entry.groupId);
			run(db, 'UPDATE category_groups SET sort_order = ? WHERE id = ?', [gi, entry.groupId]);
			entry.categoryIds.forEach((categoryId, ci) => {
				const category = getCategory(db, categoryId);
```

with:

```ts
): void {
	tx(db, () => {
		let nextUserOrder = Object.keys(SYSTEM_GROUP_ORDER).length;
		layout.forEach((entry) => {
			const group = getGroup(db, entry.groupId);
			const order = group.system ? SYSTEM_GROUP_ORDER[group.system] : nextUserOrder++;
			run(db, 'UPDATE category_groups SET sort_order = ? WHERE id = ?', [order, entry.groupId]);
			entry.categoryIds.forEach((categoryId, ci) => {
				const category = getCategory(db, categoryId);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test`

Expected: PASS, including the money-conservation fuzz test. It now sees these operations rejected as `DomainError`s, which it allows.

- [ ] **Step 5: Format, check and commit**

```bash
pnpm exec prettier --write src/lib/domain/errors.ts src/lib/db/repos/transactions.ts src/lib/db/repos/transactions.test.ts src/lib/db/repos/accounts.ts src/lib/db/repos/accounts.test.ts src/lib/db/repos/categories.ts src/lib/db/repos/categories.test.ts
```

Run: `pnpm lint && pnpm check`

Expected: Prettier, ESLint and svelte-check report no problems.

Run: `pnpm test`

Expected: every unit test passes.

```bash
git add src/lib/domain/errors.ts src/lib/db/repos/transactions.ts src/lib/db/repos/transactions.test.ts src/lib/db/repos/accounts.ts src/lib/db/repos/accounts.test.ts src/lib/db/repos/categories.ts src/lib/db/repos/categories.test.ts
git commit -m "feat: block income on cards, guard card closing, pin system groups" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```


---


### Task 3: Harden the RPC client and let the worker hand over

Plan 1 follow-ups for the RPC boundary, plus what the tab takeover (Task 6) needs from the worker:

- Arguments go through `$state.snapshot`, so Svelte state proxies can be posted. A rune can only run in a `.svelte.ts` module, so this is a tiny module of its own.
- If `postMessage` throws (a `DataCloneError`), the call rejects with `INTERNAL` instead of leaking a pending entry.
- A worker `error` or `messageerror` rejects every pending and later call with `WORKER_FAILED`, and `onFatal` listeners hear about it once (spec §6).
- `system.release()` closes the database and pauses the SAH pool, which lets go of the OPFS files. Another tab can then open them.
- The worker retries installing the pool for about 3 s. A tab that just handed over may still be releasing its handles.

**Files:**
- Create: `src/lib/client/transferable.svelte.ts`
- Modify: `src/lib/client/rpc.ts`
- Modify: `src/lib/client/db.ts`
- Modify: `src/lib/db/api.ts`
- Modify: `src/lib/db/dispatcher.ts`
- Modify: `src/lib/db/worker.ts`
- Test: `src/lib/client/rpc.test.ts`
- Test: `src/lib/db/dispatcher.test.ts`

**Interfaces:**
- Consumes: `createRpcClient`, `createDispatcher`, `SystemApi` (Plan 1); `WORKER_FAILED` (Task 2).
- Produces:
  - `interface RpcClient { api; onChange(listener): () => void; onFatal(listener: (error: RpcError) => void): () => void }`
  - `Endpoint.addEventListener(type: 'message' | 'messageerror' | 'error', listener: (event: MessageEvent) => void)`
  - `interface DbWorker extends RpcClient { terminate(): void }`, and `startDbWorker(): DbWorker`
  - `SystemApi.release(): void`, callable as `api.system.release()`
  - `toTransferable<T>(value: T): T` in `src/lib/client/transferable.svelte.ts`

- [ ] **Step 1: Write the failing tests**

In `src/lib/client/rpc.test.ts`, replace:

```ts
import { describe, it, expect, afterEach } from 'vitest';
import { createRpcClient, RpcError } from './rpc';
import { createDispatcher } from '$lib/db/dispatcher';
import { createBudgetDb } from '$lib/db/testing';
```

with:

```ts
import { describe, it, expect, afterEach } from 'vitest';
import { createRpcClient, RpcError, type Endpoint } from './rpc';
import { createDispatcher } from '$lib/db/dispatcher';
import { createBudgetDb } from '$lib/db/testing';
```

Then replace:

```ts
	const dispatch = createDispatcher({
		getDb: () => db,
		system: { open: () => {}, close: () => {}, listFiles: () => [], deleteFile: () => {} }
	});
	channel.port2.onmessage = async (e) => channel.port2.postMessage(await dispatch(e.data));
```

with:

```ts
	const dispatch = createDispatcher({
		getDb: () => db,
		system: {
			open: () => {},
			close: () => {},
			listFiles: () => [],
			deleteFile: () => {},
			release: () => {}
		}
	});
	channel.port2.onmessage = async (e) => channel.port2.postMessage(await dispatch(e.data));
```

Then replace:

```ts
	});
});
```

with:

```ts
	});
});

/** An endpoint that clones messages like a real port but never answers. */
function silentEndpoint() {
	const listeners = new Map<string, ((event: MessageEvent) => void)[]>();
	const sent: unknown[] = [];
	const endpoint: Endpoint = {
		postMessage: (message) => void sent.push(structuredClone(message)),
		addEventListener: (type, listener) =>
			void listeners.set(type, [...(listeners.get(type) ?? []), listener])
	};
	const emit = (type: string) => {
		for (const listener of listeners.get(type) ?? []) listener(new MessageEvent(type));
	};
	return { endpoint, sent, emit };
}

describe('createRpcClient failure paths', () => {
	it('sends reactive proxies by value', async () => {
		const client = connect(await createBudgetDb());
		const input = new Proxy(
			{
				name: 'Bank',
				type: 'checking' as const,
				onBudget: true,
				startingBalance: 0,
				startingDate: '2026-01-01'
			},
			{}
		);
		await client.api.accounts.create(input);
		expect((await client.api.accounts.list()).map((a) => a.name)).toEqual(['Bank']);
	});

	it('rejects, instead of hanging, when a message cannot be sent', async () => {
		const { endpoint, sent } = silentEndpoint();
		const client = createRpcClient(endpoint);
		const notCloneable = (() => 'x') as unknown as string;
		const err = await client.api.accounts.rename('id', notCloneable).catch((e) => e);
		expect(err).toBeInstanceOf(RpcError);
		expect(err.code).toBe('INTERNAL');
		expect(sent).toEqual([]);
	});

	it.each(['error', 'messageerror'])('fails every pending and later call on %s', async (type) => {
		const { endpoint, emit } = silentEndpoint();
		const client = createRpcClient(endpoint);
		const fatal: RpcError[] = [];
		client.onFatal((e) => fatal.push(e));
		const pending = client.api.meta.get().catch((e) => e);
		emit(type);
		emit(type);
		expect(await pending).toMatchObject({ code: 'WORKER_FAILED' });
		expect(await client.api.meta.get().catch((e) => e)).toMatchObject({ code: 'WORKER_FAILED' });
		expect(fatal).toHaveLength(1);
	});
});
```

In `src/lib/db/dispatcher.test.ts`, replace:

```ts
			close: () => {},
			listFiles: () => ['a.sqlite3'],
			deleteFile: () => {}
		}
	};
```

with:

```ts
			close: () => {},
			listFiles: () => ['a.sqlite3'],
			deleteFile: () => {},
			release: () => {}
		}
	};
```

Then replace:

```ts
		});
	});
});
```

with:

```ts
		});
	});

	it('routes release, which changes no tables', async () => {
		const dispatch = createDispatcher({ system: fakeSystem().system, getDb: () => null });
		expect(await dispatch({ id: 9, method: 'system.release', args: [] })).toMatchObject({
			ok: true,
			changed: []
		});
	});
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test src/lib/client/rpc.test.ts src/lib/db/dispatcher.test.ts`

Expected: FAIL. The proxy argument throws `DataCloneError`, the unsendable call rejects with a plain `DataCloneError` instead of an `RpcError`, error events are ignored, and `system.release` is `UNKNOWN_METHOD`.

- [ ] **Step 3: Implement the client side**

Create `src/lib/client/transferable.svelte.ts`:

```ts
/**
 * Copies Svelte state proxies into plain values that postMessage can clone.
 * This lives in a .svelte.ts module because $state.snapshot is a rune.
 */
export function toTransferable<T>(value: T): T {
	return $state.snapshot(value) as T;
}
```

Replace `src/lib/client/rpc.ts`:

```ts
import type { Table } from '$lib/db/connection';
import type { ClientApi } from '$lib/db/api';
import type { CallRequest, CallResponse } from '$lib/db/protocol';
import { toTransferable } from './transferable.svelte';

/** Anything that can exchange messages with the DB worker (a Worker or a MessagePort). */
export interface Endpoint {
	postMessage(message: unknown): void;
	addEventListener(
		type: 'message' | 'messageerror' | 'error',
		listener: (event: MessageEvent) => void
	): void;
	start?(): void;
}

export class RpcError extends Error {
	constructor(
		public readonly code: string,
		message: string,
		public readonly details?: unknown
	) {
		super(message);
		this.name = 'RpcError';
	}
}

export type ChangeListener = (tables: Table[]) => void;
export type FatalListener = (error: RpcError) => void;

export interface RpcClient {
	api: ClientApi;
	onChange(listener: ChangeListener): () => void;
	/** Called once if the worker dies or a reply cannot be read. Every later call rejects. */
	onFatal(listener: FatalListener): () => void;
}

export function createRpcClient(endpoint: Endpoint): RpcClient {
	let nextId = 1;
	let fatal: RpcError | null = null;
	const pending = new Map<
		number,
		{ resolve: (v: unknown) => void; reject: (e: unknown) => void }
	>();
	const listeners = new Set<ChangeListener>();
	const fatalListeners = new Set<FatalListener>();

	function fail(message: string): void {
		if (fatal) return;
		fatal = new RpcError('WORKER_FAILED', message);
		for (const entry of pending.values()) entry.reject(fatal);
		pending.clear();
		for (const l of fatalListeners) l(fatal);
	}

	endpoint.addEventListener('message', (event: MessageEvent) => {
		const res = event.data as CallResponse;
		const entry = pending.get(res.id);
		if (!entry) return;
		pending.delete(res.id);
		if (res.ok) {
			entry.resolve(res.data);
			if (res.changed.length > 0) for (const l of listeners) l(res.changed);
		} else {
			entry.reject(new RpcError(res.error.code, res.error.message, res.error.details));
		}
	});
	endpoint.addEventListener('error', (event) => {
		const message = (event as { message?: unknown }).message;
		fail(typeof message === 'string' && message ? message : 'The database worker stopped');
	});
	endpoint.addEventListener('messageerror', () => fail('A database reply could not be read'));
	endpoint.start?.();

	function call(method: string, args: unknown[]): Promise<unknown> {
		if (fatal) return Promise.reject(fatal);
		const id = nextId++;
		return new Promise((resolve, reject) => {
			const req: CallRequest = { id, method, args: toTransferable(args) };
			try {
				endpoint.postMessage(req);
			} catch (err) {
				// e.g. a DataCloneError: the arguments hold something that cannot be sent.
				reject(new RpcError('INTERNAL', err instanceof Error ? err.message : String(err)));
				return;
			}
			pending.set(id, { resolve, reject });
		});
	}

	const api = new Proxy({} as ClientApi, {
		get(_, ns) {
			if (typeof ns !== 'string' || ns === 'then') return undefined;
			return new Proxy(
				{},
				{
					get(_, name) {
						if (typeof name !== 'string' || name === 'then') return undefined;
						return (...args: unknown[]) => call(`${ns}.${name}`, args);
					}
				}
			);
		}
	});

	return {
		api,
		onChange(listener) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		onFatal(listener) {
			fatalListeners.add(listener);
			return () => fatalListeners.delete(listener);
		}
	};
}
```

Replace `src/lib/client/db.ts`:

```ts
import { createRpcClient, type RpcClient } from './rpc';

export interface DbWorker extends RpcClient {
	/** Stops the worker. Call `api.system.release()` first so OPFS handles are let go cleanly. */
	terminate(): void;
}

/** Starts the SQLite worker. Only the tab that holds the tab lock may call this. */
export function startDbWorker(): DbWorker {
	const worker = new Worker(new URL('../db/worker.ts', import.meta.url), { type: 'module' });
	return { ...createRpcClient(worker), terminate: () => worker.terminate() };
}
```

- [ ] **Step 4: Implement the worker side**

In `src/lib/db/api.ts`, replace:

```ts
	listFiles(): string[];
	deleteFile(fileName: string): void;
}

```

with:

```ts
	listFiles(): string[];
	deleteFile(fileName: string): void;
	/** Closes the database and lets go of the OPFS files so another tab can open them. */
	release(): void;
}

```

In `src/lib/db/dispatcher.ts`, replace:

```ts
	close: ALL_TABLES,
	listFiles: [],
	deleteFile: []
} as const;

```

with:

```ts
	close: ALL_TABLES,
	listFiles: [],
	deleteFile: [],
	release: []
} as const;

```

In `src/lib/db/worker.ts`, replace:

```ts
}

async function initPool(): Promise<SAHPoolUtil> {
	try {
		const sqlite3 = await sqlite3InitModule();
		return await sqlite3.installOpfsSAHPoolVfs({ name: 'moneta', initialCapacity: 12 });
	} catch (err) {
		throw new DomainError(
			'STORAGE_UNAVAILABLE',
			err instanceof Error ? err.message : 'OPFS is not available'
		);
	}
}

```

with:

```ts
}

const POOL_ATTEMPTS = 5;

async function initPool(): Promise<SAHPoolUtil> {
	let lastError: unknown;
	try {
		const sqlite3 = await sqlite3InitModule();
		// A tab that just handed over may still be letting go of its file handles, so retry briefly.
		// `forceReinitIfPreviouslyFailed` is supported by sqlite-wasm but missing from its types.
		const options = { name: 'moneta', initialCapacity: 12, forceReinitIfPreviouslyFailed: true };
		for (let attempt = 1; attempt <= POOL_ATTEMPTS; attempt++) {
			try {
				return await sqlite3.installOpfsSAHPoolVfs(options);
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

```

Then replace:

```ts
			if (openName === fileName) closeDb();
			pool.unlink(path);
		}
	};
```

with:

```ts
			if (openName === fileName) closeDb();
			pool.unlink(path);
		},
		release() {
			closeDb();
			if (!pool.isPaused()) pool.pauseVfs();
		}
	};
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm test src/lib/client/rpc.test.ts src/lib/db/dispatcher.test.ts`

Expected: PASS.

- [ ] **Step 6: Format, check and commit**

```bash
pnpm exec prettier --write src/lib/client/transferable.svelte.ts src/lib/client/rpc.ts src/lib/client/rpc.test.ts src/lib/client/db.ts src/lib/db/api.ts src/lib/db/dispatcher.ts src/lib/db/dispatcher.test.ts src/lib/db/worker.ts
```

Run: `pnpm lint && pnpm check`

Expected: Prettier, ESLint and svelte-check report no problems.

Run: `pnpm test`

Expected: every unit test passes.

```bash
git add src/lib/client/transferable.svelte.ts src/lib/client/rpc.ts src/lib/client/rpc.test.ts src/lib/client/db.ts src/lib/db/api.ts src/lib/db/dispatcher.ts src/lib/db/dispatcher.test.ts src/lib/db/worker.ts
git commit -m "fix: reject unsendable and orphaned RPC calls; let the worker release OPFS" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```


---


### Task 4: UI toolkit: Tailwind, shadcn-svelte and Paraglide i18n

Scaffolds the UI stack and the translation layer that every later screen uses. The message catalogs hold every string Plan 2 needs, in English and Brazilian Portuguese, so later tasks only call `m.<key>()`.

Paraglide's SvelteKit add-on assumes server rendering with the locale in the URL. Moneta is a static SPA, so that setup is replaced: no server hooks, no URL rewriting, and the locale comes from localStorage (set by Settings), then the browser language, then English.

System rows (Income, Ready to Assign, Credit Card Payments, the "Starting Balance" payee) are stored in English by the repos. `labels.ts` shows them in the UI language.

**Files:**
- Scaffold: Tailwind CSS 4 (`@tailwindcss/vite`), Paraglide 2 (`project.inlang/`), shadcn-svelte (`components.json`, `src/lib/utils.ts`, `src/lib/components/ui/*`, `src/routes/layout.css`)
- Create: `src/lib/i18n/messages/en.json`
- Create: `src/lib/i18n/messages/pt-BR.json`
- Create: `src/lib/i18n/errors.ts`
- Create: `src/lib/i18n/labels.ts`
- Create: `src/lib/i18n/defaults.ts`
- Create: `src/lib/i18n/formats.ts`
- Modify: `vite.config.ts`
- Modify: `package.json`
- Modify: `eslint.config.js`
- Modify: `src/app.html`
- Modify: `project.inlang/settings.json`
- Modify: `src/routes/+layout.svelte`
- Delete: `src/hooks.ts`
- Delete: `src/hooks.server.ts`
- Delete: `messages/` (generated by the add-on)
- Test: `src/lib/i18n/catalog.test.ts`
- Test: `src/lib/i18n/errors.test.ts`
- Test: `src/lib/i18n/labels.test.ts`
- Test: `src/lib/i18n/formats.test.ts`

**Interfaces:**
- Consumes: `ERROR_CODES`/`ErrorCode` (Task 2); `RpcError` (Task 3); `AccountType`, `GroupNode`, `CategoryNode` types (Plan 1); `Month` (Plan 1).
- Produces:
  - `m.<key>()` message functions from `$lib/paraglide/messages`; `getLocale()`, `setLocale()`, `locales`, `type Locale` from `$lib/paraglide/runtime`
  - `errorMessage(err: unknown): string`, `isUnexpected(err: unknown): boolean`, `errorDetails(err: unknown): string` in `$lib/i18n/errors`
  - `groupLabel({ name, system })`, `categoryLabel({ name, system })`, `storedCategoryLabel(name)`, `accountTypeLabel(type)` in `$lib/i18n/labels`
  - `defaultCategoryGroups(locale?: Locale): { name: string; categories: string[] }[]` in `$lib/i18n/defaults`
  - `suggestCurrency(locale)`, `currencyChoices(uiLocale)`, `localeChoices(uiLocale, browserLocale?)` returning `Choice[] = { value, label }[]`, and `formatMonth`, `formatMonthLong`, `formatDate` in `$lib/i18n/formats`
  - shadcn-svelte components under `$lib/components/ui/`: alert, badge, button, card, checkbox, collapsible, dialog, input, label, native-select, separator, sheet, sonner, switch
  - `pnpm i18n` script

- [ ] **Step 1: Add Tailwind and Paraglide**

```bash
npx -y sv@0.17.0 add tailwindcss="plugins:none" paraglide="languageTags:en, pt-BR+demo:no" --install pnpm --no-git-check --no-download-check
```

Expected: ends with "You're all set!". It creates `project.inlang/`, `messages/`, `src/hooks.ts`, `src/hooks.server.ts` and `src/routes/layout.css`, and edits `vite.config.ts`, `prettier.config.js`, `src/app.html`, `.gitignore` and `src/routes/+layout.svelte`.

- [ ] **Step 2: Make Paraglide client-only**

Remove the server hooks and the generated sample messages. The real catalogs go in `src/lib/i18n/messages/` (spec §2):

```bash
rm -r messages src/hooks.ts src/hooks.server.ts
```

Replace `project.inlang/settings.json`:

```json
{
	"$schema": "https://inlang.com/schema/project-settings",
	"modules": [
		"https://cdn.jsdelivr.net/npm/@inlang/plugin-message-format@4/dist/index.js",
		"https://cdn.jsdelivr.net/npm/@inlang/plugin-m-function-matcher@2/dist/index.js"
	],
	"plugin.inlang.messageFormat": {
		"pathPattern": "./src/lib/i18n/messages/{locale}.json"
	},
	"baseLocale": "en",
	"locales": ["en", "pt-BR"]
}
```

Replace `vite.config.ts` (the add-on's version plus the `strategy` line):

```ts
import { paraglideVitePlugin } from '@inlang/paraglide-js';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	optimizeDeps: { exclude: ['@sqlite.org/sqlite-wasm'] },
	worker: { format: 'es' },
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter({ fallback: 'index.html' })
		}),
		paraglideVitePlugin({
			project: './project.inlang',
			outdir: './src/lib/paraglide',
			emitTsDeclarations: true,
			// A static SPA: remember the user's choice, else follow the browser, else English.
			strategy: ['localStorage', 'preferredLanguage', 'baseLocale']
		})
	],
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
```

Replace `src/app.html` (the root layout sets `lang` at runtime):

```html
<!doctype html>
<html lang="en">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
		<meta name="text-scale" content="scale" />
		%sveltekit.head%
	</head>
	<body data-sveltekit-preload-data="hover">
		<div style="display: contents">%sveltekit.body%</div>
	</body>
</html>
```

svelte-check reads the generated `$lib/paraglide` modules, which only Vite generates. So compile the messages first:

In `package.json`, replace:

```json
		"check": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json",
		"check:watch": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json --watch",
```

with:

```json
		"i18n": "paraglide-js compile --project ./project.inlang --outdir ./src/lib/paraglide --strategy localStorage preferredLanguage baseLocale --emit-ts-declarations --silent",
		"check": "pnpm i18n && svelte-kit sync && svelte-check --tsconfig ./tsconfig.json",
		"check:watch": "pnpm i18n && svelte-kit sync && svelte-check --tsconfig ./tsconfig.json --watch",
```

The vendored shadcn components pass `href` props through unchanged, which trips `svelte/no-navigation-without-resolve`. Our own code always calls `resolve()`:

In `eslint.config.js`, replace:

```js
	},
	{
		// Override or add rule settings here, such as:
		// 'svelte/button-has-type': 'error'
		rules: {}
	}
);
```

with:

```js
	},
	{
		// Vendored shadcn-svelte components pass caller-provided hrefs through unchanged.
		files: ['src/lib/components/ui/**'],
		rules: { 'svelte/no-navigation-without-resolve': 'off' }
	}
);
```

- [ ] **Step 3: Add shadcn-svelte and its components**

```bash
# init asks one question even with every flag set ("Updates to your src/routes/layout.css
# are required ... Continue?"). `script` gives it a terminal and the repeated Enter answers Yes.
# (On macOS: script -q /dev/null <command>. Interactively, just run the npx command and answer Yes.)
# The preset code bIkeymG is shadcn-svelte's "vega" style with the neutral base color and Inter.
(for i in $(seq 1 45); do sleep 2; printf '\r'; done) | script -qfec \
  "npx -y shadcn-svelte@1.7.0 init --preset bIkeymG --css src/routes/layout.css \
   --components-alias '\$lib/components' --lib-alias '\$lib' --utils-alias '\$lib/utils' \
   --hooks-alias '\$lib/hooks' --ui-alias '\$lib/components/ui'" /dev/null
```

Expected: ends with "Success! Project initialization completed." It creates `components.json` and `src/lib/utils.ts`, and writes the theme tokens into `src/routes/layout.css`.

```bash
npx -y shadcn-svelte@1.7.0 add -y alert badge button card checkbox collapsible dialog input label native-select separator sheet sonner switch
```

Expected: ends with "Success! Components added." The components are in `src/lib/components/ui/`, and `bits-ui`, `mode-watcher`, `svelte-sonner`, `@lucide/svelte` and friends are in `package.json`.

- [ ] **Step 4: Write the message catalogs**

Each language has the same keys. `{name}`-style placeholders must match between languages (the catalog test checks this).

Create `src/lib/i18n/messages/en.json`:

```json
{
	"$schema": "https://inlang.com/schema/inlang-message-format",
	"app_name": "Moneta",
	"nav_label": "Main",
	"nav_budget": "Budget",
	"nav_accounts": "Accounts",
	"nav_settings": "Settings",
	"add_transaction": "Transaction",
	"save": "Save",
	"cancel": "Cancel",
	"close": "Close",
	"add": "Add",
	"delete": "Delete",
	"confirm_delete": "Tap again to delete",
	"copy_details": "Copy details",
	"startup_loading": "Opening your budget…",
	"startup_blocked_title": "Moneta is open in another tab",
	"startup_blocked_body": "Your budget can only be open in one tab at a time.",
	"startup_blocked_take_over": "Use Moneta here",
	"startup_reload": "Reload",
	"startup_storage_unavailable_title": "Storage isn't available",
	"startup_storage_unavailable_body": "Moneta keeps your budget in this browser's private storage, which isn't available here. Private windows and some older browsers block it.",
	"startup_quota_title": "Storage is full",
	"startup_quota_body": "The browser has no space left for your budget. Free up space on this device and reload.",
	"startup_schema_title": "This budget needs a newer Moneta",
	"startup_schema_body": "It was saved by a newer version of the app. Reload to update.",
	"startup_worker_title": "The database stopped",
	"startup_worker_body": "Something went wrong in the background. Reload to continue; your data is safe.",
	"startup_internal_title": "Moneta couldn't start",
	"startup_internal_body": "An unexpected error happened while opening your budget.",
	"error_invalid_input": "Some of the values aren't valid.",
	"error_not_found": "That item no longer exists.",
	"error_already_initialized": "This budget is already set up.",
	"error_schema_too_new": "This budget was saved by a newer version of Moneta.",
	"error_no_database_open": "No budget is open.",
	"error_storage_unavailable": "The browser's storage isn't available.",
	"error_account_closed": "This account is closed. Reopen it to make changes.",
	"error_account_has_transactions": "Accounts with transactions can't be deleted. Close it instead.",
	"error_account_balance_not_zero": "Only accounts with a zero balance can be closed.",
	"error_cc_payment_not_empty": "Move the money out of this card's payment category before closing it.",
	"error_category_required": "Choose a category.",
	"error_category_not_allowed": "That category can't be used here.",
	"error_system_entity_readonly": "Built-in groups and categories can't be changed.",
	"error_group_not_empty": "Move or delete this group's categories first.",
	"error_reassign_required": "This category is in use. Choose where its transactions and money go.",
	"error_split_too_few_lines": "A split needs at least two lines.",
	"error_split_sum_mismatch": "The split lines must add up to the amount.",
	"error_transfer_invalid": "Choose another account to transfer to.",
	"error_worker_failed": "The database stopped. Reload to continue.",
	"error_internal": "Something went wrong.",
	"form_error_account_required": "Choose an account.",
	"form_error_date_invalid": "Enter a valid date.",
	"form_error_amount_invalid": "Enter a valid amount, like 12.50 or 10+5.",
	"form_error_split_line_invalid": "Every split line needs a category and an amount.",
	"ready_to_assign": "Ready to Assign",
	"group_income": "Income",
	"group_cc_payments": "Credit Card Payments",
	"onboarding_title": "Welcome to Moneta",
	"onboarding_intro": "Give every unit of money a job. Your budget stays on this device.",
	"onboarding_budget_section": "Your budget",
	"onboarding_budget_name": "Budget name",
	"onboarding_default_budget_name": "My Budget",
	"onboarding_locale": "Number and date format",
	"onboarding_currency": "Currency",
	"onboarding_account_section": "Your first account",
	"onboarding_default_account_name": "Checking",
	"onboarding_create": "Create budget",
	"default_group_bills": "Bills",
	"default_group_everyday": "Everyday",
	"default_group_goals": "Goals",
	"default_group_fun": "Fun",
	"default_category_rent": "Rent or Mortgage",
	"default_category_utilities": "Utilities",
	"default_category_phone_internet": "Phone & Internet",
	"default_category_insurance": "Insurance",
	"default_category_groceries": "Groceries",
	"default_category_transport": "Transportation",
	"default_category_dining_out": "Dining Out",
	"default_category_household": "Household",
	"default_category_emergency_fund": "Emergency Fund",
	"default_category_vacation": "Vacation",
	"default_category_entertainment": "Entertainment",
	"default_category_hobbies": "Hobbies",
	"accounts_on_budget": "On budget",
	"accounts_off_budget": "Tracking",
	"accounts_closed": "Closed",
	"accounts_add": "Add account",
	"accounts_empty": "No accounts yet.",
	"account_name": "Account name",
	"account_type": "Type",
	"account_type_checking": "Checking",
	"account_type_savings": "Savings",
	"account_type_cash": "Cash",
	"account_type_credit_card": "Credit card",
	"account_type_investment": "Investment",
	"account_type_loan": "Loan",
	"account_type_other": "Other",
	"account_on_budget": "On budget",
	"account_on_budget_hint": "Its money is budgeted in categories.",
	"account_off_budget_hint": "Tracked for net worth only, not budgeted.",
	"account_starting_balance": "Current balance",
	"account_amount_owed": "Amount owed",
	"account_balance_date": "As of",
	"account_settings_for": "Settings for {name}",
	"account_close": "Close account",
	"account_close_hint": "Closing needs a zero balance. Closed accounts keep their history.",
	"account_reopen": "Reopen account",
	"account_delete": "Delete account",
	"account_delete_hint": "Only accounts without transactions can be deleted.",
	"budget_previous_month": "Previous month",
	"budget_next_month": "Next month",
	"budget_this_month": "Today",
	"budget_ready_to_assign": "Ready to Assign",
	"budget_funds_available": "Funds available",
	"budget_overspent_last_month": "Overspent last month",
	"budget_assigned_this_month": "Assigned this month",
	"budget_future_negative_title": "A future month is over-assigned",
	"budget_future_negative_body": "Ready to Assign goes negative in {month}. Assign less in future months.",
	"budget_categories": "Categories",
	"budget_category": "Category",
	"budget_assigned": "Assigned",
	"budget_activity": "Activity",
	"budget_available": "Available",
	"budget_assigned_for": "Assigned to {name}",
	"budget_hidden_categories": "Hidden categories ({count})",
	"budget_add_group": "Add group",
	"budget_edit_order": "Edit order",
	"budget_move_money": "Move money",
	"budget_move_to": "Move to…",
	"budget_move_from": "Take from…",
	"budget_move_other": "Other category",
	"budget_move_amount": "Amount to move",
	"budget_move": "Move",
	"budget_move_choose_category": "Choose the other category.",
	"quick_assign_title": "Quick assign",
	"quick_assign_last_month": "Same as last month",
	"quick_assign_average": "Average spent ({months} mo.)",
	"quick_assign_cover": "Cover overspending",
	"quick_assign_clear": "Clear",
	"category_settings": "Category settings",
	"category_name": "Name",
	"category_group": "Group",
	"category_hidden": "Hidden",
	"category_carryover": "Roll overspending over",
	"category_carryover_hint": "Keep a negative balance in this category next month instead of taking it from Ready to Assign.",
	"category_card_payment_note": "This category follows its credit card: rename or close the card instead.",
	"category_delete_reassign": "Move its transactions and money to",
	"category_delete_no_reassign": "Nowhere (only if unused)",
	"category_delete": "Delete category",
	"group_settings": "Group settings",
	"group_name": "Group name",
	"group_hidden": "Hidden",
	"group_add_category": "New category",
	"group_delete": "Delete group",
	"group_system_note": "This group is managed by Moneta.",
	"order_hint": "Use the arrows, or drag categories on a computer.",
	"order_move_up": "Move {name} up",
	"order_move_down": "Move {name} down",
	"register_search": "Search payee, category or memo",
	"register_from": "From",
	"register_to": "To",
	"register_transactions": "Transactions",
	"register_empty": "No transactions.",
	"register_load_more": "Load more",
	"register_cleared_balance": "Cleared",
	"register_uncleared_balance": "Uncleared",
	"register_total_balance": "Balance",
	"register_cleared": "Cleared",
	"register_transfer_to": "Transfer to {account}",
	"register_transfer_from": "Transfer from {account}",
	"register_open_account": "Open {account}",
	"register_starting_balance": "Starting balance",
	"register_no_payee": "No payee",
	"register_split": "Split ({count})",
	"transaction_add_title": "New transaction",
	"transaction_edit_title": "Edit transaction",
	"transaction_no_accounts": "Add an open account first.",
	"transaction_account": "Account",
	"transaction_date": "Date",
	"transaction_payee": "Payee",
	"transfer_payee": "Transfer: {account}",
	"transaction_amount": "Amount",
	"transaction_direction": "Direction",
	"transaction_outflow": "Outflow",
	"transaction_inflow": "Inflow",
	"transaction_category": "Category",
	"transaction_choose_category": "Choose a category",
	"transaction_no_category": "No category (card debt)",
	"transaction_split": "Split",
	"transaction_split_lines": "Split lines",
	"transaction_split_category": "Category for line {line}",
	"transaction_split_amount": "Amount for line {line}",
	"transaction_split_memo": "Memo for line {line}",
	"transaction_split_remove": "Remove line {line}",
	"transaction_split_add": "Add line",
	"transaction_split_remaining": "Remaining: {amount}",
	"transaction_memo": "Memo",
	"transaction_cleared": "Cleared",
	"settings_app": "App",
	"settings_language": "Language",
	"settings_theme": "Theme",
	"settings_theme_system": "Follow the system",
	"settings_theme_light": "Light",
	"settings_theme_dark": "Dark"
}
```

Create `src/lib/i18n/messages/pt-BR.json`:

```json
{
	"$schema": "https://inlang.com/schema/inlang-message-format",
	"app_name": "Moneta",
	"nav_label": "Principal",
	"nav_budget": "Orçamento",
	"nav_accounts": "Contas",
	"nav_settings": "Configurações",
	"add_transaction": "Transação",
	"save": "Salvar",
	"cancel": "Cancelar",
	"close": "Fechar",
	"add": "Adicionar",
	"delete": "Excluir",
	"confirm_delete": "Toque de novo para excluir",
	"copy_details": "Copiar detalhes",
	"startup_loading": "Abrindo seu orçamento…",
	"startup_blocked_title": "O Moneta está aberto em outra aba",
	"startup_blocked_body": "Seu orçamento só pode ficar aberto em uma aba por vez.",
	"startup_blocked_take_over": "Usar o Moneta aqui",
	"startup_reload": "Recarregar",
	"startup_storage_unavailable_title": "O armazenamento não está disponível",
	"startup_storage_unavailable_body": "O Moneta guarda seu orçamento no armazenamento privado deste navegador, que não está disponível aqui. Janelas anônimas e alguns navegadores antigos o bloqueiam.",
	"startup_quota_title": "O armazenamento está cheio",
	"startup_quota_body": "O navegador não tem mais espaço para o seu orçamento. Libere espaço neste dispositivo e recarregue.",
	"startup_schema_title": "Este orçamento precisa de um Moneta mais novo",
	"startup_schema_body": "Ele foi salvo por uma versão mais nova do app. Recarregue para atualizar.",
	"startup_worker_title": "O banco de dados parou",
	"startup_worker_body": "Algo deu errado em segundo plano. Recarregue para continuar; seus dados estão seguros.",
	"startup_internal_title": "O Moneta não conseguiu iniciar",
	"startup_internal_body": "Aconteceu um erro inesperado ao abrir seu orçamento.",
	"error_invalid_input": "Alguns valores não são válidos.",
	"error_not_found": "Esse item não existe mais.",
	"error_already_initialized": "Este orçamento já está configurado.",
	"error_schema_too_new": "Este orçamento foi salvo por uma versão mais nova do Moneta.",
	"error_no_database_open": "Nenhum orçamento está aberto.",
	"error_storage_unavailable": "O armazenamento do navegador não está disponível.",
	"error_account_closed": "Esta conta está encerrada. Reabra-a para fazer alterações.",
	"error_account_has_transactions": "Contas com transações não podem ser excluídas. Encerre a conta.",
	"error_account_balance_not_zero": "Só contas com saldo zero podem ser encerradas.",
	"error_cc_payment_not_empty": "Tire o dinheiro da categoria de pagamento deste cartão antes de encerrá-lo.",
	"error_category_required": "Escolha uma categoria.",
	"error_category_not_allowed": "Essa categoria não pode ser usada aqui.",
	"error_system_entity_readonly": "Grupos e categorias do sistema não podem ser alterados.",
	"error_group_not_empty": "Mova ou exclua as categorias deste grupo primeiro.",
	"error_reassign_required": "Esta categoria está em uso. Escolha para onde vão as transações e o dinheiro dela.",
	"error_split_too_few_lines": "Uma divisão precisa de pelo menos duas linhas.",
	"error_split_sum_mismatch": "As linhas da divisão precisam somar o valor.",
	"error_transfer_invalid": "Escolha outra conta para a transferência.",
	"error_worker_failed": "O banco de dados parou. Recarregue para continuar.",
	"error_internal": "Algo deu errado.",
	"form_error_account_required": "Escolha uma conta.",
	"form_error_date_invalid": "Informe uma data válida.",
	"form_error_amount_invalid": "Informe um valor válido, como 12,50 ou 10+5.",
	"form_error_split_line_invalid": "Cada linha da divisão precisa de uma categoria e um valor.",
	"ready_to_assign": "Pronto para atribuir",
	"group_income": "Receitas",
	"group_cc_payments": "Pagamentos de cartão",
	"onboarding_title": "Boas-vindas ao Moneta",
	"onboarding_intro": "Dê uma função a cada centavo. Seu orçamento fica neste dispositivo.",
	"onboarding_budget_section": "Seu orçamento",
	"onboarding_budget_name": "Nome do orçamento",
	"onboarding_default_budget_name": "Meu orçamento",
	"onboarding_locale": "Formato de números e datas",
	"onboarding_currency": "Moeda",
	"onboarding_account_section": "Sua primeira conta",
	"onboarding_default_account_name": "Conta corrente",
	"onboarding_create": "Criar orçamento",
	"default_group_bills": "Contas fixas",
	"default_group_everyday": "Dia a dia",
	"default_group_goals": "Metas",
	"default_group_fun": "Lazer",
	"default_category_rent": "Aluguel ou financiamento",
	"default_category_utilities": "Água, luz e gás",
	"default_category_phone_internet": "Telefone e internet",
	"default_category_insurance": "Seguros",
	"default_category_groceries": "Mercado",
	"default_category_transport": "Transporte",
	"default_category_dining_out": "Restaurantes",
	"default_category_household": "Casa",
	"default_category_emergency_fund": "Reserva de emergência",
	"default_category_vacation": "Viagens",
	"default_category_entertainment": "Entretenimento",
	"default_category_hobbies": "Hobbies",
	"accounts_on_budget": "No orçamento",
	"accounts_off_budget": "Acompanhamento",
	"accounts_closed": "Encerradas",
	"accounts_add": "Adicionar conta",
	"accounts_empty": "Nenhuma conta ainda.",
	"account_name": "Nome da conta",
	"account_type": "Tipo",
	"account_type_checking": "Conta corrente",
	"account_type_savings": "Poupança",
	"account_type_cash": "Dinheiro",
	"account_type_credit_card": "Cartão de crédito",
	"account_type_investment": "Investimento",
	"account_type_loan": "Empréstimo",
	"account_type_other": "Outra",
	"account_on_budget": "No orçamento",
	"account_on_budget_hint": "O dinheiro dela é orçado em categorias.",
	"account_off_budget_hint": "Só acompanhada no patrimônio, sem orçamento.",
	"account_starting_balance": "Saldo atual",
	"account_amount_owed": "Valor devido",
	"account_balance_date": "Em",
	"account_settings_for": "Configurações de {name}",
	"account_close": "Encerrar conta",
	"account_close_hint": "Encerrar exige saldo zero. Contas encerradas mantêm o histórico.",
	"account_reopen": "Reabrir conta",
	"account_delete": "Excluir conta",
	"account_delete_hint": "Só contas sem transações podem ser excluídas.",
	"budget_previous_month": "Mês anterior",
	"budget_next_month": "Próximo mês",
	"budget_this_month": "Hoje",
	"budget_ready_to_assign": "Pronto para atribuir",
	"budget_funds_available": "Dinheiro disponível",
	"budget_overspent_last_month": "Gasto a mais no mês passado",
	"budget_assigned_this_month": "Atribuído neste mês",
	"budget_future_negative_title": "Um mês futuro tem atribuição demais",
	"budget_future_negative_body": "O Pronto para atribuir fica negativo em {month}. Atribua menos nos meses futuros.",
	"budget_categories": "Categorias",
	"budget_category": "Categoria",
	"budget_assigned": "Atribuído",
	"budget_activity": "Movimento",
	"budget_available": "Disponível",
	"budget_assigned_for": "Atribuído a {name}",
	"budget_hidden_categories": "Categorias ocultas ({count})",
	"budget_add_group": "Adicionar grupo",
	"budget_edit_order": "Reordenar",
	"budget_move_money": "Mover dinheiro",
	"budget_move_to": "Mover para…",
	"budget_move_from": "Tirar de…",
	"budget_move_other": "Outra categoria",
	"budget_move_amount": "Valor a mover",
	"budget_move": "Mover",
	"budget_move_choose_category": "Escolha a outra categoria.",
	"quick_assign_title": "Atribuição rápida",
	"quick_assign_last_month": "Igual ao mês passado",
	"quick_assign_average": "Média gasta ({months} meses)",
	"quick_assign_cover": "Cobrir gasto a mais",
	"quick_assign_clear": "Zerar",
	"category_settings": "Configurações da categoria",
	"category_name": "Nome",
	"category_group": "Grupo",
	"category_hidden": "Oculta",
	"category_carryover": "Levar gasto a mais adiante",
	"category_carryover_hint": "Mantém o saldo negativo nesta categoria no mês seguinte em vez de tirá-lo do Pronto para atribuir.",
	"category_card_payment_note": "Esta categoria acompanha o cartão: renomeie ou encerre o cartão.",
	"category_delete_reassign": "Mover transações e dinheiro para",
	"category_delete_no_reassign": "Nenhuma (só se não usada)",
	"category_delete": "Excluir categoria",
	"group_settings": "Configurações do grupo",
	"group_name": "Nome do grupo",
	"group_hidden": "Oculto",
	"group_add_category": "Nova categoria",
	"group_delete": "Excluir grupo",
	"group_system_note": "Este grupo é gerenciado pelo Moneta.",
	"order_hint": "Use as setas ou, no computador, arraste as categorias.",
	"order_move_up": "Mover {name} para cima",
	"order_move_down": "Mover {name} para baixo",
	"register_search": "Buscar favorecido, categoria ou memorando",
	"register_from": "De",
	"register_to": "Até",
	"register_transactions": "Transações",
	"register_empty": "Nenhuma transação.",
	"register_load_more": "Carregar mais",
	"register_cleared_balance": "Compensado",
	"register_uncleared_balance": "Não compensado",
	"register_total_balance": "Saldo",
	"register_cleared": "Compensada",
	"register_transfer_to": "Transferência para {account}",
	"register_transfer_from": "Transferência de {account}",
	"register_open_account": "Abrir {account}",
	"register_starting_balance": "Saldo inicial",
	"register_no_payee": "Sem favorecido",
	"register_split": "Dividida ({count})",
	"transaction_add_title": "Nova transação",
	"transaction_edit_title": "Editar transação",
	"transaction_no_accounts": "Adicione uma conta aberta primeiro.",
	"transaction_account": "Conta",
	"transaction_date": "Data",
	"transaction_payee": "Favorecido",
	"transfer_payee": "Transferência: {account}",
	"transaction_amount": "Valor",
	"transaction_direction": "Sentido",
	"transaction_outflow": "Saída",
	"transaction_inflow": "Entrada",
	"transaction_category": "Categoria",
	"transaction_choose_category": "Escolha uma categoria",
	"transaction_no_category": "Sem categoria (dívida no cartão)",
	"transaction_split": "Dividir",
	"transaction_split_lines": "Linhas da divisão",
	"transaction_split_category": "Categoria da linha {line}",
	"transaction_split_amount": "Valor da linha {line}",
	"transaction_split_memo": "Memorando da linha {line}",
	"transaction_split_remove": "Remover a linha {line}",
	"transaction_split_add": "Adicionar linha",
	"transaction_split_remaining": "Falta: {amount}",
	"transaction_memo": "Memorando",
	"transaction_cleared": "Compensada",
	"settings_app": "Aplicativo",
	"settings_language": "Idioma",
	"settings_theme": "Tema",
	"settings_theme_system": "Seguir o sistema",
	"settings_theme_light": "Claro",
	"settings_theme_dark": "Escuro"
}
```

- [ ] **Step 5: Write the failing i18n tests**

Create `src/lib/i18n/catalog.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import en from './messages/en.json';
import pt from './messages/pt-BR.json';

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('message catalogs', () => {
	it('have the same keys in every language', () => {
		expect(Object.keys(pt).sort()).toEqual(Object.keys(en).sort());
	});

	it('have no empty messages', () => {
		for (const catalog of [en, pt])
			for (const [key, text] of Object.entries(catalog)) expect(text.trim(), key).not.toBe('');
	});

	it('use the same placeholders in every language', () => {
		for (const [key, text] of Object.entries(en))
			expect(placeholders(pt[key as keyof typeof pt]), key).toEqual(placeholders(text));
	});
});
```

Create `src/lib/i18n/errors.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { RpcError } from '$lib/client/rpc';
import { DomainError, ERROR_CODES } from '$lib/domain/errors';
import { m } from '$lib/paraglide/messages';
import { errorDetails, errorMessage, isUnexpected } from './errors';

describe('errorMessage', () => {
	it('translates every error code', () => {
		for (const code of ERROR_CODES) {
			const text = errorMessage(new RpcError(code, 'raw'));
			expect(text, code).not.toBe('raw');
			expect(text, code).not.toBe(code);
		}
	});

	it('works for domain errors and falls back for anything else', () => {
		expect(errorMessage(new DomainError('SPLIT_SUM_MISMATCH'))).toBe(m.error_split_sum_mismatch());
		expect(errorMessage(new RpcError('NOPE', 'x'))).toBe(m.error_internal());
		expect(errorMessage(new TypeError('boom'))).toBe(m.error_internal());
		expect(errorMessage(null)).toBe(m.error_internal());
	});
});

describe('isUnexpected', () => {
	it('separates user-fixable errors from bugs', () => {
		expect(isUnexpected(new RpcError('ACCOUNT_BALANCE_NOT_ZERO', 'x'))).toBe(false);
		expect(isUnexpected(new RpcError('INTERNAL', 'x'))).toBe(true);
		expect(isUnexpected(new RpcError('WORKER_FAILED', 'x'))).toBe(true);
		expect(isUnexpected(new Error('boom'))).toBe(true);
	});
});

describe('errorDetails', () => {
	it('includes the code, message and details', () => {
		const text = errorDetails(new RpcError('SPLIT_SUM_MISMATCH', 'Mismatch', { expected: 1 }));
		expect(JSON.parse(text)).toMatchObject({
			code: 'SPLIT_SUM_MISMATCH',
			message: 'Mismatch',
			details: { expected: 1 }
		});
		expect(errorDetails('plain')).toBe('plain');
	});
});
```

Create `src/lib/i18n/labels.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { m } from '$lib/paraglide/messages';
import { defaultCategoryGroups } from './defaults';
import { accountTypeLabel, categoryLabel, groupLabel, storedCategoryLabel } from './labels';

describe('labels', () => {
	it('translates system groups and categories, and leaves user names alone', () => {
		expect(groupLabel({ name: 'Income', system: 'income' })).toBe(m.group_income());
		expect(groupLabel({ name: 'Credit Card Payments', system: 'credit_card_payments' })).toBe(
			m.group_cc_payments()
		);
		expect(groupLabel({ name: 'Bills', system: null })).toBe('Bills');
		expect(categoryLabel({ name: 'Ready to Assign', system: 'ready_to_assign' })).toBe(
			m.ready_to_assign()
		);
		expect(categoryLabel({ name: 'Food', system: null })).toBe('Food');
		expect(storedCategoryLabel('Ready to Assign')).toBe(m.ready_to_assign());
		expect(storedCategoryLabel('Food')).toBe('Food');
	});

	it('names account types', () => {
		expect(accountTypeLabel('credit_card')).toBe(m.account_type_credit_card());
		expect(accountTypeLabel('checking')).toBe(m.account_type_checking());
	});
});

describe('defaultCategoryGroups', () => {
	it('offers the starter categories in each language', () => {
		const en = defaultCategoryGroups('en');
		const pt = defaultCategoryGroups('pt-BR');
		expect(en[1]).toEqual({
			name: 'Everyday',
			categories: ['Groceries', 'Transportation', 'Dining Out', 'Household']
		});
		expect(pt[1].name).toBe('Dia a dia');
		expect(pt.map((g) => g.categories.length)).toEqual(en.map((g) => g.categories.length));
	});
});
```

Create `src/lib/i18n/formats.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
	currencyChoices,
	formatDate,
	formatMonth,
	formatMonthLong,
	localeChoices,
	suggestCurrency
} from './formats';

describe('suggestCurrency', () => {
	it.each([
		['pt-BR', 'BRL'],
		['en-US', 'USD'],
		['en', 'USD'],
		['de-DE', 'EUR'],
		['pt-PT', 'EUR'],
		['ja-JP', 'JPY'],
		['en-GB', 'GBP'],
		['not a locale', 'USD']
	])('suggests a currency for %s', (locale, currency) => {
		expect(suggestCurrency(locale)).toBe(currency);
	});
});

describe('choices', () => {
	it('labels currencies in the UI language', () => {
		expect(currencyChoices('en')).toContainEqual({ value: 'BRL', label: 'Brazilian Real (BRL)' });
		expect(currencyChoices('pt-BR')).toContainEqual({
			value: 'USD',
			label: 'Dólar americano (USD)'
		});
	});

	it('offers common locales plus the browser one', () => {
		const values = localeChoices('en', 'nl-NL').map((c) => c.value);
		expect(values[0]).toBe('nl-NL');
		expect(values).toContain('pt-BR');
		expect(localeChoices('en', 'pt-BR').filter((c) => c.value === 'pt-BR')).toHaveLength(1);
	});
});

describe('dates', () => {
	it('formats months and dates in the UI language without time zone drift', () => {
		expect(formatMonth('2026-09', 'en')).toBe('Sep 2026');
		expect(formatMonth('2026-09', 'pt-BR')).toBe('set. de 2026');
		expect(formatMonthLong('2026-09', 'pt-BR')).toBe('setembro de 2026');
		expect(formatDate('2026-09-05', 'en')).toBe('Sep 5, 2026');
		expect(formatDate('2026-01-01', 'pt-BR')).toBe('1 de jan. de 2026');
	});
});
```

- [ ] **Step 6: Run the tests to verify they fail**

Run: `pnpm test src/lib/i18n`

Expected: FAIL. `./errors`, `./labels`, `./defaults` and `./formats` do not exist yet (the catalog test passes).

- [ ] **Step 7: Implement the i18n helpers**

Create `src/lib/i18n/errors.ts`:

```ts
import type { ErrorCode } from '$lib/domain/errors';
import { m } from '$lib/paraglide/messages';

/** Every error code the worker or the client can report, in the UI language. */
const MESSAGES: Record<ErrorCode, () => string> = {
	INVALID_INPUT: m.error_invalid_input,
	NOT_FOUND: m.error_not_found,
	ALREADY_INITIALIZED: m.error_already_initialized,
	SCHEMA_TOO_NEW: m.error_schema_too_new,
	NO_DATABASE_OPEN: m.error_no_database_open,
	UNKNOWN_METHOD: m.error_internal,
	STORAGE_UNAVAILABLE: m.error_storage_unavailable,
	ACCOUNT_CLOSED: m.error_account_closed,
	ACCOUNT_HAS_TRANSACTIONS: m.error_account_has_transactions,
	ACCOUNT_BALANCE_NOT_ZERO: m.error_account_balance_not_zero,
	CC_PAYMENT_NOT_EMPTY: m.error_cc_payment_not_empty,
	CATEGORY_REQUIRED: m.error_category_required,
	CATEGORY_NOT_ALLOWED: m.error_category_not_allowed,
	SYSTEM_ENTITY_READONLY: m.error_system_entity_readonly,
	GROUP_NOT_EMPTY: m.error_group_not_empty,
	REASSIGN_REQUIRED: m.error_reassign_required,
	SPLIT_TOO_FEW_LINES: m.error_split_too_few_lines,
	SPLIT_SUM_MISMATCH: m.error_split_sum_mismatch,
	TRANSFER_INVALID: m.error_transfer_invalid,
	WORKER_FAILED: m.error_worker_failed,
	INTERNAL: m.error_internal
};

/** Codes that point at a bug or a broken worker rather than at something the user can fix. */
const UNEXPECTED = new Set<string>([
	'INTERNAL',
	'UNKNOWN_METHOD',
	'NO_DATABASE_OPEN',
	'WORKER_FAILED'
]);

function codeOf(err: unknown): string | undefined {
	const code = (err as { code?: unknown } | null)?.code;
	return typeof code === 'string' ? code : undefined;
}

function isKnown(code: string | undefined): code is ErrorCode {
	return code !== undefined && Object.hasOwn(MESSAGES, code);
}

/** A translated message for any thrown value (RpcError, DomainError or anything else). */
export function errorMessage(err: unknown): string {
	const code = codeOf(err);
	return isKnown(code) ? MESSAGES[code]() : m.error_internal();
}

export function isUnexpected(err: unknown): boolean {
	const code = codeOf(err);
	return !isKnown(code) || UNEXPECTED.has(code);
}

/** Everything useful for a bug report, for the "copy details" action. */
export function errorDetails(err: unknown): string {
	if (!(err instanceof Error)) return String(err);
	const { details } = err as { details?: unknown };
	return JSON.stringify(
		{ name: err.name, code: codeOf(err), message: err.message, details, stack: err.stack },
		null,
		2
	);
}
```

Create `src/lib/i18n/labels.ts`:

```ts
import type { AccountType } from '$lib/db/repos/accounts';
import type { CategoryNode, GroupNode } from '$lib/db/repos/categories';
import { m } from '$lib/paraglide/messages';

/** The repos store system names in English; these show them in the UI language. */
const STORED_READY_TO_ASSIGN = 'Ready to Assign';

export function groupLabel(group: { name: string; system: GroupNode['system'] }): string {
	if (group.system === 'income') return m.group_income();
	if (group.system === 'credit_card_payments') return m.group_cc_payments();
	return group.name;
}

export function categoryLabel(category: { name: string; system: CategoryNode['system'] }): string {
	return category.system === 'ready_to_assign' ? m.ready_to_assign() : category.name;
}

/** For transaction rows and split lines, which only carry the category's stored name. */
export function storedCategoryLabel(name: string): string {
	return name === STORED_READY_TO_ASSIGN ? m.ready_to_assign() : name;
}

const ACCOUNT_TYPE_LABELS: Record<AccountType, () => string> = {
	checking: m.account_type_checking,
	savings: m.account_type_savings,
	cash: m.account_type_cash,
	credit_card: m.account_type_credit_card,
	investment: m.account_type_investment,
	loan: m.account_type_loan,
	other: m.account_type_other
};

export function accountTypeLabel(type: AccountType): string {
	return ACCOUNT_TYPE_LABELS[type]();
}
```

Create `src/lib/i18n/defaults.ts`:

```ts
import { m } from '$lib/paraglide/messages';
import type { Locale } from '$lib/paraglide/runtime';

/** The starter category groups offered during onboarding, in `locale` (default: the UI language). */
export function defaultCategoryGroups(locale?: Locale): { name: string; categories: string[] }[] {
	const o = locale ? { locale } : {};
	return [
		{
			name: m.default_group_bills({}, o),
			categories: [
				m.default_category_rent({}, o),
				m.default_category_utilities({}, o),
				m.default_category_phone_internet({}, o),
				m.default_category_insurance({}, o)
			]
		},
		{
			name: m.default_group_everyday({}, o),
			categories: [
				m.default_category_groceries({}, o),
				m.default_category_transport({}, o),
				m.default_category_dining_out({}, o),
				m.default_category_household({}, o)
			]
		},
		{
			name: m.default_group_goals({}, o),
			categories: [m.default_category_emergency_fund({}, o), m.default_category_vacation({}, o)]
		},
		{
			name: m.default_group_fun({}, o),
			categories: [m.default_category_entertainment({}, o), m.default_category_hobbies({}, o)]
		}
	];
}
```

Create `src/lib/i18n/formats.ts`:

```ts
import type { Month } from '$lib/domain/month';

const EURO_REGIONS = new Set(
	'AT BE CY DE EE ES FI FR GR HR IE IT LT LU LV MT NL PT SI SK'.split(' ')
);
const REGION_CURRENCY: Record<string, string> = {
	BR: 'BRL',
	US: 'USD',
	GB: 'GBP',
	CA: 'CAD',
	AU: 'AUD',
	NZ: 'NZD',
	JP: 'JPY',
	MX: 'MXN',
	AR: 'ARS',
	CL: 'CLP',
	CO: 'COP',
	PE: 'PEN',
	UY: 'UYU',
	IN: 'INR',
	CH: 'CHF',
	SE: 'SEK',
	NO: 'NOK',
	DK: 'DKK',
	PL: 'PLN',
	ZA: 'ZAR',
	AO: 'AOA',
	MZ: 'MZN'
};

/** A sensible default currency for a locale such as 'pt-BR' or 'de'. Falls back to USD. */
export function suggestCurrency(locale: string): string {
	let region: string | undefined;
	try {
		region = new Intl.Locale(locale).maximize().region;
	} catch {
		return 'USD';
	}
	if (!region) return 'USD';
	return EURO_REGIONS.has(region) ? 'EUR' : (REGION_CURRENCY[region] ?? 'USD');
}

export interface Choice {
	value: string;
	label: string;
}

/** Every currency Intl knows, labelled in the UI language, e.g. "Brazilian Real (BRL)". */
export function currencyChoices(uiLocale: string): Choice[] {
	const names = new Intl.DisplayNames(uiLocale, { type: 'currency' });
	return Intl.supportedValuesOf('currency')
		.map((code) => ({ value: code, label: `${names.of(code) ?? code} (${code})` }))
		.sort((a, b) => a.label.localeCompare(b.label, uiLocale));
}

const COMMON_LOCALES = [
	'pt-BR',
	'pt-PT',
	'en-US',
	'en-GB',
	'es-ES',
	'es-MX',
	'es-AR',
	'fr-FR',
	'de-DE',
	'it-IT',
	'ja-JP'
];

/** Number/date formats to offer for a budget, including the browser's own locale. */
export function localeChoices(uiLocale: string, browserLocale?: string): Choice[] {
	const names = new Intl.DisplayNames(uiLocale, { type: 'language' });
	const values = [...COMMON_LOCALES];
	if (browserLocale && !values.includes(browserLocale)) {
		try {
			values.unshift(Intl.getCanonicalLocales(browserLocale)[0]);
		} catch {
			// ignore an invalid browser locale
		}
	}
	return values.map((value) => ({ value, label: `${names.of(value) ?? value} (${value})` }));
}

function utc(date: string): Date {
	const [y, m, d] = date.split('-').map(Number);
	return new Date(Date.UTC(y, m - 1, d ?? 1));
}

/** "Sep 2026" / "set. de 2026". */
export function formatMonth(month: Month, locale: string): string {
	return new Intl.DateTimeFormat(locale, {
		month: 'short',
		year: 'numeric',
		timeZone: 'UTC'
	}).format(utc(month));
}

/** "September 2026" / "setembro de 2026". */
export function formatMonthLong(month: Month, locale: string): string {
	return new Intl.DateTimeFormat(locale, {
		month: 'long',
		year: 'numeric',
		timeZone: 'UTC'
	}).format(utc(month));
}

/** "Sep 5, 2026" / "5 de set. de 2026". */
export function formatDate(date: string, locale: string): string {
	return new Intl.DateTimeFormat(locale, {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
		timeZone: 'UTC'
	}).format(utc(date));
}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `pnpm test src/lib/i18n`

Expected: PASS.

- [ ] **Step 9: Load the theme, toasts and language in the root layout**

Replace `src/routes/+layout.svelte`:

```svelte
<script lang="ts">
	import './layout.css';
	import type { Snippet } from 'svelte';
	import { ModeWatcher } from 'mode-watcher';
	import favicon from '$lib/assets/favicon.svg';
	import { Toaster } from '$lib/components/ui/sonner';
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';

	let { children }: { children: Snippet } = $props();

	// The app is a client-only SPA, so the document is always there.
	document.documentElement.lang = getLocale();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>{m.app_name()}</title>
</svelte:head>

<ModeWatcher />
<Toaster richColors closeButton />
{@render children()}
```

- [ ] **Step 10: Format, check, build and commit**

Prettier reformats the vendored components to the project style (tabs, single quotes).

```bash
pnpm exec prettier --write .
```

Run: `pnpm lint && pnpm check`

Expected: no problems.

Run: `pnpm test && pnpm build`

Expected: all unit tests pass and the build succeeds.

```bash
git add -A
git commit -m "feat: add Tailwind, shadcn-svelte and Paraglide i18n (en, pt-BR)" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```


---


### Task 5: Budget registry

The list of budget files (`budget-<uuid>.sqlite3`) and the one opened last, kept in localStorage. It is only a cache. File names come from the worker's OPFS pool and budget names from each file's `meta`, so a lost registry is rebuilt (Task 7). That is why it isn't mirrored to an OPFS JSON file as the spec first suggested; Task 16 updates the spec. Files that aren't budgets, such as the Plan 1 smoke test's, are ignored.

**Files:**
- Create: `src/lib/client/registry.ts`
- Create: `src/lib/client/testing.ts`
- Test: `src/lib/client/registry.test.ts`

**Interfaces:**
- Consumes: `uuidv7`.
- Produces:
  - `interface BudgetEntry { file: string; name: string }`, `interface Registry { budgets: BudgetEntry[]; lastOpened: string | null }`
  - `interface KeyValueStore { getItem(key): string | null; setItem(key, value): void }` (localStorage fits)
  - `REGISTRY_KEY = 'moneta.registry'`, `newBudgetFile(id?): string`, `isBudgetFile(file): boolean`
  - `loadRegistry(store): Registry` (never throws), `saveRegistry(store, registry): void` (never throws)
  - `reconcile(registry, files: string[]): { registry: Registry; unnamed: string[] }`
  - `pickBudget(registry): string | null`, `upsertBudget(registry, entry): Registry`, `markOpened(registry, file): Registry`
  - `memoryStore(registry?: string): KeyValueStore & { data: Map<string, string> }` in `src/lib/client/testing.ts` (test-only)

- [ ] **Step 1: Write the failing test and its helper**

Create `src/lib/client/testing.ts` (Task 7 extends it):

```ts
import { REGISTRY_KEY, type KeyValueStore } from './registry';

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
```

Create `src/lib/client/registry.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
	isBudgetFile,
	loadRegistry,
	markOpened,
	newBudgetFile,
	pickBudget,
	reconcile,
	saveRegistry,
	upsertBudget,
	type KeyValueStore
} from './registry';
import { memoryStore } from './testing';

const A = 'budget-0190a000-0000-7000-8000-000000000001.sqlite3';
const B = 'budget-0190a000-0000-7000-8000-000000000002.sqlite3';
const C = 'budget-0190a000-0000-7000-8000-000000000003.sqlite3';

describe('budget files', () => {
	it('names new files so the worker accepts them', () => {
		const file = newBudgetFile();
		expect(file).toMatch(/^budget-[0-9a-f-]{36}\.sqlite3$/);
		expect(isBudgetFile(file)).toBe(true);
		expect(isBudgetFile('smoke.sqlite3')).toBe(false);
	});
});

describe('loadRegistry / saveRegistry', () => {
	it('round-trips through the store', () => {
		const store = memoryStore();
		saveRegistry(store, { budgets: [{ file: A, name: 'Home' }], lastOpened: A });
		expect(loadRegistry(store)).toEqual({ budgets: [{ file: A, name: 'Home' }], lastOpened: A });
	});

	it('tolerates a missing, corrupt or foreign value', () => {
		expect(loadRegistry(memoryStore())).toEqual({ budgets: [], lastOpened: null });
		expect(loadRegistry(memoryStore('{nope'))).toEqual({ budgets: [], lastOpened: null });
		expect(
			loadRegistry(memoryStore(JSON.stringify({ budgets: [{ file: 'x.db', name: 1 }] })))
		).toEqual({ budgets: [], lastOpened: null });
	});

	it('ignores a store that refuses writes', () => {
		const store: KeyValueStore = {
			getItem: () => null,
			setItem: () => {
				throw new Error('QuotaExceededError');
			}
		};
		expect(() => saveRegistry(store, { budgets: [], lastOpened: null })).not.toThrow();
	});
});

describe('reconcile', () => {
	it('drops missing files, lists unknown budget files and ignores other files', () => {
		const registry = {
			budgets: [
				{ file: A, name: 'Home' },
				{ file: B, name: 'Gone' }
			],
			lastOpened: B
		};
		expect(reconcile(registry, [C, A, 'smoke.sqlite3'])).toEqual({
			registry: { budgets: [{ file: A, name: 'Home' }], lastOpened: null },
			unnamed: [C]
		});
	});
});

describe('pickBudget', () => {
	it('prefers the last opened budget, then the first one', () => {
		const budgets = [
			{ file: A, name: 'Home' },
			{ file: B, name: 'Work' }
		];
		expect(pickBudget({ budgets, lastOpened: B })).toBe(B);
		expect(pickBudget({ budgets, lastOpened: C })).toBe(A);
		expect(pickBudget({ budgets: [], lastOpened: null })).toBeNull();
	});
});

describe('upsertBudget / markOpened', () => {
	it('adds or renames entries and records the last opened file', () => {
		let registry = upsertBudget({ budgets: [], lastOpened: null }, { file: A, name: 'Home' });
		registry = upsertBudget(registry, { file: A, name: 'House' });
		registry = markOpened(upsertBudget(registry, { file: B, name: 'Work' }), B);
		expect(registry).toEqual({
			budgets: [
				{ file: A, name: 'House' },
				{ file: B, name: 'Work' }
			],
			lastOpened: B
		});
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test src/lib/client/registry.test.ts`

Expected: FAIL. `./registry` does not exist.

- [ ] **Step 3: Implement**

Create `src/lib/client/registry.ts`:

```ts
import { uuidv7 } from 'uuidv7';

/**
 * The list of budget files and the one opened last. It is a cache: file names come from the
 * worker's OPFS pool and budget names from each file's meta, so it can always be rebuilt.
 */
export interface BudgetEntry {
	file: string;
	name: string;
}

export interface Registry {
	budgets: BudgetEntry[];
	lastOpened: string | null;
}

/** The subset of Storage the registry needs (localStorage in the app, a Map-backed fake in tests). */
export interface KeyValueStore {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
}

export const REGISTRY_KEY = 'moneta.registry';
const BUDGET_FILE = /^budget-[0-9a-f-]+\.sqlite3$/;

export function newBudgetFile(id: string = uuidv7()): string {
	return `budget-${id}.sqlite3`;
}

export function isBudgetFile(file: string): boolean {
	return BUDGET_FILE.test(file);
}

const EMPTY: Registry = { budgets: [], lastOpened: null };

export function loadRegistry(store: KeyValueStore): Registry {
	try {
		const raw = JSON.parse(store.getItem(REGISTRY_KEY) ?? 'null') as Partial<Registry> | null;
		const budgets = Array.isArray(raw?.budgets)
			? raw.budgets.filter(
					(b): b is BudgetEntry =>
						typeof b?.file === 'string' && typeof b?.name === 'string' && isBudgetFile(b.file)
				)
			: [];
		const lastOpened = typeof raw?.lastOpened === 'string' ? raw.lastOpened : null;
		return { budgets, lastOpened };
	} catch {
		return EMPTY;
	}
}

export function saveRegistry(store: KeyValueStore, registry: Registry): void {
	try {
		store.setItem(REGISTRY_KEY, JSON.stringify(registry));
	} catch {
		// Storage can be full or blocked; the registry is rebuilt from the files next time.
	}
}

/**
 * Drops entries whose file no longer exists and lists budget files the registry doesn't know
 * (they need their name read from the file). Files that aren't budgets are ignored.
 */
export function reconcile(
	registry: Registry,
	files: string[]
): { registry: Registry; unnamed: string[] } {
	const existing = new Set(files.filter(isBudgetFile));
	const budgets = registry.budgets.filter((b) => existing.has(b.file));
	const known = new Set(budgets.map((b) => b.file));
	const lastOpened =
		registry.lastOpened && existing.has(registry.lastOpened) ? registry.lastOpened : null;
	return {
		registry: { budgets, lastOpened },
		unnamed: [...existing].filter((f) => !known.has(f)).sort()
	};
}

/** The budget to open: the last one used if it still exists, else the first listed. */
export function pickBudget(registry: Registry): string | null {
	if (registry.lastOpened && registry.budgets.some((b) => b.file === registry.lastOpened))
		return registry.lastOpened;
	return registry.budgets[0]?.file ?? null;
}

export function upsertBudget(registry: Registry, entry: BudgetEntry): Registry {
	const found = registry.budgets.some((b) => b.file === entry.file);
	return {
		...registry,
		budgets: found
			? registry.budgets.map((b) => (b.file === entry.file ? entry : b))
			: [...registry.budgets, entry]
	};
}

export function markOpened(registry: Registry, file: string): Registry {
	return { ...registry, lastOpened: file };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test src/lib/client/registry.test.ts`

Expected: PASS (7 tests).

- [ ] **Step 5: Format, check and commit**

```bash
pnpm exec prettier --write src/lib/client/registry.ts src/lib/client/registry.test.ts src/lib/client/testing.ts
```

Run: `pnpm lint && pnpm check`

Expected: Prettier, ESLint and svelte-check report no problems.

Run: `pnpm test`

Expected: every unit test passes.

```bash
git add src/lib/client/registry.ts src/lib/client/registry.test.ts src/lib/client/testing.ts
git commit -m "feat: add the budget registry" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```


---


### Task 6: Tab lock with takeover

The SAH-pool VFS allows one connection, so one tab owns the database (spec §2). The owner holds a Web Lock (`navigator.locks`) for as long as it runs. A blocked tab can take over. It first queues for the lock, then broadcasts a request on a `BroadcastChannel`. The owner shuts its database down (Task 8 wires `release()` and `terminate()`) and then lets go of the lock, which passes to the queued tab.

The module depends only on small interfaces, so the tests use an in-memory lock manager and channel.

**Files:**
- Create: `src/lib/client/tab-lock.ts`
- Test: `src/lib/client/tab-lock.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `interface LockManagerLike`, `interface ChannelLike` (`navigator.locks` and `BroadcastChannel` fit)
  - `createTabLock(deps: { locks: LockManagerLike; channel: ChannelLike; name?: string }): TabLock`
  - `interface TabLock { tryAcquire(): Promise<boolean>; takeOver(): Promise<void>; onLost(handler: () => Promise<void>): void }`
  - `TAB_LOCK_NAME = 'moneta-db'`

- [ ] **Step 1: Write the failing test**

Create `src/lib/client/tab-lock.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createTabLock, type ChannelLike, type LockManagerLike } from './tab-lock';

/** An in-memory Web Locks manager: one holder per name, FIFO waiters. */
function fakeLocks(): LockManagerLike {
	const held = new Set<string>();
	const waiting = new Map<string, (() => void)[]>();
	const grant = (name: string, callback: (lock: unknown) => Promise<void> | void) => {
		held.add(name);
		return Promise.resolve(callback({ name })).finally(() => {
			held.delete(name);
			waiting.get(name)?.shift()?.();
		});
	};
	return {
		request(name, options, callback) {
			if (!held.has(name)) return grant(name, callback);
			if (options.ifAvailable) return Promise.resolve(callback(null));
			return new Promise((resolve) => {
				const queue = waiting.get(name) ?? [];
				queue.push(() => resolve(grant(name, callback)));
				waiting.set(name, queue);
			});
		}
	};
}

/** BroadcastChannel semantics: messages reach every other channel on the bus, asynchronously. */
function fakeBus(): () => ChannelLike {
	const members: ((data: unknown) => void)[] = [];
	return () => {
		const listeners: ((event: MessageEvent) => void)[] = [];
		const deliver = (data: unknown) => {
			for (const l of listeners) l({ data } as MessageEvent);
		};
		members.push(deliver);
		return {
			postMessage(data) {
				for (const member of members) if (member !== deliver) queueMicrotask(() => member(data));
			},
			addEventListener(_type, listener) {
				listeners.push(listener);
			}
		};
	};
}

describe('createTabLock', () => {
	it('lets only one tab own the database', async () => {
		const locks = fakeLocks();
		const channel = fakeBus();
		const first = createTabLock({ locks, channel: channel() });
		const second = createTabLock({ locks, channel: channel() });
		expect(await first.tryAcquire()).toBe(true);
		expect(await second.tryAcquire()).toBe(false);
	});

	it('hands over after the owner has shut down', async () => {
		const locks = fakeLocks();
		const channel = fakeBus();
		const first = createTabLock({ locks, channel: channel() });
		const second = createTabLock({ locks, channel: channel() });
		const events: string[] = [];
		first.onLost(async () => {
			events.push('first shut down');
		});
		await first.tryAcquire();
		await second.takeOver();
		events.push('second owns it');
		expect(events).toEqual(['first shut down', 'second owns it']);
		expect(await first.tryAcquire()).toBe(false);
	});

	it('can take the lock back', async () => {
		const locks = fakeLocks();
		const channel = fakeBus();
		const first = createTabLock({ locks, channel: channel() });
		const second = createTabLock({ locks, channel: channel() });
		let firstLost = 0;
		let secondLost = 0;
		first.onLost(async () => void firstLost++);
		second.onLost(async () => void secondLost++);
		await first.tryAcquire();
		await second.takeOver();
		await first.takeOver();
		expect([firstLost, secondLost]).toEqual([1, 1]);
		expect(await second.tryAcquire()).toBe(false);
	});

	it('releases the lock even if shutting down fails', async () => {
		const locks = fakeLocks();
		const channel = fakeBus();
		const first = createTabLock({ locks, channel: channel() });
		const second = createTabLock({ locks, channel: channel() });
		first.onLost(() => Promise.reject(new Error('close failed')));
		await first.tryAcquire();
		await expect(second.takeOver()).resolves.toBeUndefined();
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test src/lib/client/tab-lock.test.ts`

Expected: FAIL. `./tab-lock` does not exist.

- [ ] **Step 3: Implement**

Create `src/lib/client/tab-lock.ts`:

```ts
/**
 * Single-tab ownership of the database (the OPFS SAH-pool allows one connection).
 * The owner holds a Web Lock for as long as it runs. Another tab can ask to take over:
 * it queues for the lock and broadcasts a request, the owner shuts its database down and
 * releases the lock, and the queued tab gets it.
 */

/** The part of `navigator.locks` this module uses. */
export interface LockManagerLike {
	request(
		name: string,
		options: { ifAvailable?: boolean },
		callback: (lock: unknown) => Promise<void> | void
	): Promise<unknown>;
}

/** The part of BroadcastChannel this module uses. */
export interface ChannelLike {
	postMessage(message: unknown): void;
	addEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
}

export interface TabLock {
	/** Takes the lock if no other tab holds it. */
	tryAcquire(): Promise<boolean>;
	/** Asks the owner to hand over and resolves once this tab holds the lock. */
	takeOver(): Promise<void>;
	/** Runs when another tab takes over. The lock is released after `handler` settles. */
	onLost(handler: () => Promise<void>): void;
}

export const TAB_LOCK_NAME = 'moneta-db';
const TAKEOVER = 'moneta:takeover';

export function createTabLock(deps: {
	locks: LockManagerLike;
	channel: ChannelLike;
	name?: string;
}): TabLock {
	const name = deps.name ?? TAB_LOCK_NAME;
	let release: (() => void) | null = null;
	let lostHandler: () => Promise<void> = async () => {};

	/** Holds the lock until `release` is called. */
	const hold = () =>
		new Promise<void>((resolve) => {
			release = resolve;
		});

	deps.channel.addEventListener('message', (event) => {
		if ((event.data as { type?: unknown } | null)?.type !== TAKEOVER || !release) return;
		const letGo = release;
		release = null;
		// Release the lock even if shutting down fails, or the other tab would wait forever.
		void lostHandler().then(letGo, letGo);
	});

	return {
		tryAcquire() {
			return new Promise<boolean>((resolve) => {
				void deps.locks.request(name, { ifAvailable: true }, (lock) => {
					resolve(lock !== null);
					return lock !== null ? hold() : undefined;
				});
			});
		},
		takeOver() {
			return new Promise<void>((resolve) => {
				void deps.locks.request(name, {}, () => {
					resolve();
					return hold();
				});
				deps.channel.postMessage({ type: TAKEOVER });
			});
		},
		onLost(handler) {
			lostHandler = handler;
		}
	};
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test src/lib/client/tab-lock.test.ts`

Expected: PASS (4 tests), with no unhandled rejections reported.

- [ ] **Step 5: Format, check and commit**

```bash
pnpm exec prettier --write src/lib/client/tab-lock.ts src/lib/client/tab-lock.test.ts
```

Run: `pnpm lint && pnpm check`

Expected: Prettier, ESLint and svelte-check report no problems.

Run: `pnpm test`

Expected: every unit test passes.

```bash
git add src/lib/client/tab-lock.ts src/lib/client/tab-lock.test.ts
git commit -m "feat: add single-tab ownership with takeover" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```


---


### Task 7: Session logic and account defaults

The non-visual half of startup and onboarding:

- `openLastBudget` lists the worker's files and repairs the registry. Unknown files get their name from `meta`, and never-initialized files left by an interrupted onboarding are deleted. It then opens the last budget, or reports that onboarding is needed.
- `createBudget` opens a new file, initializes it with the starter categories, and creates the first account. If any step fails, it deletes the file.
- `startupError` picks the full-screen message for a startup failure (spec §6).
- `account-form.ts` holds the account rules the forms share. Loans and investments default to off-budget (a Plan 1 follow-up ruling). Cards are locked on-budget. Debts are typed as the amount owed.

The tests drive a real dispatcher over a `MessageChannel`, with in-memory databases standing in for OPFS files.

**Files:**
- Create: `src/lib/client/session.ts`
- Create: `src/lib/accounts/account-form.ts`
- Modify: `src/lib/client/testing.ts`
- Test: `src/lib/client/session.test.ts`
- Test: `src/lib/accounts/account-form.test.ts`

**Interfaces:**
- Consumes: `ClientApi`, `CreateAccountInput`, `InitBudgetInput`, `BudgetMeta`, `Account`, `AccountType` (Plan 1); registry functions and `memoryStore` (Task 5); `createRpcClient` (Task 3); `createDispatcher`, `createTestDb` (Plan 1).
- Produces:
  - `type SessionApi = Pick<ClientApi, 'system' | 'meta' | 'accounts'>`
  - `openLastBudget(api: SessionApi, store: KeyValueStore): Promise<OpenResult>` where `OpenResult = { kind: 'onboarding' } | { kind: 'ready'; file: string; meta: BudgetMeta }`
  - `interface NewBudget extends InitBudgetInput { account: CreateAccountInput }`, `createBudget(api, store, input: NewBudget, file?): Promise<{ file: string; meta: BudgetMeta }>`
  - `type StartupErrorCode = 'STORAGE_UNAVAILABLE' | 'SCHEMA_TOO_NEW' | 'QUOTA_EXCEEDED' | 'WORKER_FAILED' | 'INTERNAL'`, `startupError(err): { code: StartupErrorCode; message: string }`
  - `ACCOUNT_TYPES`, `defaultOnBudget(type)`, `onBudgetLocked(type)`, `isDebtType(type)`, `signedStartingBalance(type, typed)`, `accountSections(accounts): AccountSection[]` with `AccountSection = { key: 'onBudget' | 'offBudget' | 'closed'; accounts: Account[]; total: number }`
  - `createTestClient(): { client: RpcClient; files: Map<string, Db>; close(): void }` in `src/lib/client/testing.ts` (test-only)

- [ ] **Step 1: Write the failing tests**

Replace `src/lib/client/testing.ts` (adds `createTestClient`):

```ts
import type { Db } from '$lib/db/connection';
import { createDispatcher } from '$lib/db/dispatcher';
import { createTestDb } from '$lib/db/testing';
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
 * An RPC client talking to a real dispatcher over a MessageChannel, like the app talks to the
 * worker. Budget "files" are in-memory databases kept in `files`. Test-only.
 */
export function createTestClient(): { client: RpcClient; files: Map<string, Db>; close(): void } {
	const files = new Map<string, Db>();
	let openName: string | null = null;
	const channel = new MessageChannel();
	const dispatch = createDispatcher({
		getDb: () => (openName ? (files.get(openName) ?? null) : null),
		system: {
			async open(name) {
				if (!files.has(name)) files.set(name, await createTestDb());
				openName = name;
			},
			close() {
				openName = null;
			},
			listFiles: () => [...files.keys()],
			deleteFile(name) {
				if (openName === name) openName = null;
				files.get(name)?.close();
				files.delete(name);
			},
			release() {
				openName = null;
			}
		}
	});
	channel.port2.onmessage = async (e) => channel.port2.postMessage(await dispatch(e.data));
	return {
		client: createRpcClient(channel.port1),
		files,
		close() {
			channel.port1.close();
			channel.port2.close();
			for (const db of files.values()) db.close();
		}
	};
}
```

Create `src/lib/client/session.test.ts`:

```ts
import { describe, it, expect, afterEach } from 'vitest';
import { createTestDb } from '$lib/db/testing';
import { DomainError } from '$lib/domain/errors';
import { loadRegistry, newBudgetFile } from './registry';
import { RpcError } from './rpc';
import { createBudget, openLastBudget, startupError, type NewBudget } from './session';
import { createTestClient, memoryStore } from './testing';

const clients: { close(): void }[] = [];
afterEach(() => {
	for (const c of clients.splice(0)) c.close();
});

function setup() {
	const test = createTestClient();
	clients.push(test);
	return { ...test, api: test.client.api, store: memoryStore() };
}

const HOME: NewBudget = {
	name: 'Home',
	currency: 'BRL',
	locale: 'pt-BR',
	groups: [{ name: 'Everyday', categories: ['Food'] }],
	account: {
		name: 'Checking',
		type: 'checking',
		onBudget: true,
		startingBalance: 150000,
		startingDate: '2026-09-01'
	}
};

describe('openLastBudget', () => {
	it('starts onboarding when there is no budget yet', async () => {
		const { api, store } = setup();
		expect(await openLastBudget(api, store)).toEqual({ kind: 'onboarding' });
	});

	it('reopens the budget created last', async () => {
		const { api, store } = setup();
		const { file } = await createBudget(api, store, HOME);
		await api.system.close();
		const result = await openLastBudget(api, store);
		expect(result).toMatchObject({ kind: 'ready', file, meta: { name: 'Home', currency: 'BRL' } });
		expect(loadRegistry(store)).toEqual({ budgets: [{ file, name: 'Home' }], lastOpened: file });
	});

	it('rebuilds a lost registry from the budget files', async () => {
		const { api, store } = setup();
		const { file } = await createBudget(api, store, HOME);
		const fresh = memoryStore();
		expect(await openLastBudget(api, fresh)).toMatchObject({ kind: 'ready', file });
		expect(loadRegistry(fresh).budgets).toEqual([{ file, name: 'Home' }]);
	});

	it('deletes files left behind by an interrupted onboarding', async () => {
		const { api, store, files } = setup();
		files.set(newBudgetFile(), await createTestDb());
		expect(await openLastBudget(api, store)).toEqual({ kind: 'onboarding' });
		expect(files.size).toBe(0);
	});
});

describe('createBudget', () => {
	it('creates the budget, its categories and its first account', async () => {
		const { api, store } = setup();
		const { file, meta } = await createBudget(api, store, HOME);
		expect(meta.name).toBe('Home');
		expect(loadRegistry(store).lastOpened).toBe(file);
		const [account] = await api.accounts.list();
		expect(account).toMatchObject({ name: 'Checking', balance: 150000 });
		const tree = await api.categories.tree();
		expect(tree.map((g) => g.name)).toContain('Everyday');
	});

	it('removes the new file when setup fails', async () => {
		const { api, store, files } = setup();
		const err = await createBudget(api, store, { ...HOME, currency: 'XYZ' }).catch((e) => e);
		expect(err).toMatchObject({ code: 'INVALID_INPUT' });
		expect(files.size).toBe(0);
		expect(loadRegistry(store).budgets).toEqual([]);
	});
});

describe('startupError', () => {
	it('maps failures to the full-screen startup messages', () => {
		expect(startupError(new RpcError('STORAGE_UNAVAILABLE', 'no OPFS')).code).toBe(
			'STORAGE_UNAVAILABLE'
		);
		expect(startupError(new DomainError('SCHEMA_TOO_NEW')).code).toBe('SCHEMA_TOO_NEW');
		expect(startupError(new RpcError('INTERNAL', 'QuotaExceededError: full')).code).toBe(
			'QUOTA_EXCEEDED'
		);
		expect(startupError(new Error('boom'))).toEqual({ code: 'INTERNAL', message: 'boom' });
	});
});
```

Create `src/lib/accounts/account-form.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type { Account } from '$lib/db/repos/accounts';
import {
	accountSections,
	defaultOnBudget,
	isDebtType,
	onBudgetLocked,
	signedStartingBalance
} from './account-form';

describe('account defaults', () => {
	it('puts loans and investments off-budget by default', () => {
		expect(defaultOnBudget('checking')).toBe(true);
		expect(defaultOnBudget('credit_card')).toBe(true);
		expect(defaultOnBudget('investment')).toBe(false);
		expect(defaultOnBudget('loan')).toBe(false);
	});

	it('locks credit cards on-budget', () => {
		expect(onBudgetLocked('credit_card')).toBe(true);
		expect(onBudgetLocked('loan')).toBe(false);
	});

	it('enters debts as the amount owed', () => {
		expect(isDebtType('credit_card')).toBe(true);
		expect(isDebtType('savings')).toBe(false);
		expect(signedStartingBalance('credit_card', 50000)).toBe(-50000);
		expect(signedStartingBalance('loan', -100)).toBe(100);
		expect(signedStartingBalance('checking', 50000)).toBe(50000);
		expect(Object.is(signedStartingBalance('loan', 0), 0)).toBe(true);
	});
});

describe('accountSections', () => {
	const account = (p: Partial<Account>): Account => ({
		id: p.name ?? 'x',
		name: 'x',
		type: 'checking',
		onBudget: true,
		closed: false,
		sortOrder: 0,
		balance: 0,
		clearedBalance: 0,
		...p
	});

	it('splits accounts into on-budget, off-budget and closed, with totals', () => {
		const sections = accountSections([
			account({ name: 'Bank', balance: 1000 }),
			account({ name: 'Visa', type: 'credit_card', balance: -300 }),
			account({ name: 'Broker', onBudget: false, balance: 5000 }),
			account({ name: 'Old', closed: true })
		]);
		expect(sections.map((s) => [s.key, s.accounts.map((a) => a.name), s.total])).toEqual([
			['onBudget', ['Bank', 'Visa'], 700],
			['offBudget', ['Broker'], 5000],
			['closed', ['Old'], 0]
		]);
	});

	it('leaves out empty sections', () => {
		expect(accountSections([account({ name: 'Bank' })]).map((s) => s.key)).toEqual(['onBudget']);
	});
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test src/lib/client/session.test.ts src/lib/accounts`

Expected: FAIL. `./session` and `./account-form` do not exist.

- [ ] **Step 3: Implement**

Create `src/lib/client/session.ts`:

```ts
import type { ClientApi } from '$lib/db/api';
import type { CreateAccountInput } from '$lib/db/repos/accounts';
import type { BudgetMeta, InitBudgetInput } from '$lib/db/repos/meta';
import {
	loadRegistry,
	markOpened,
	newBudgetFile,
	pickBudget,
	reconcile,
	saveRegistry,
	upsertBudget,
	type KeyValueStore
} from './registry';

export type SessionApi = Pick<ClientApi, 'system' | 'meta' | 'accounts'>;

export type OpenResult = { kind: 'onboarding' } | { kind: 'ready'; file: string; meta: BudgetMeta };

/**
 * Opens the budget used last. The registry is repaired from the files that really exist:
 * unknown files get their name from their meta, and files left behind by an interrupted
 * onboarding (never initialized) are deleted.
 */
export async function openLastBudget(api: SessionApi, store: KeyValueStore): Promise<OpenResult> {
	const reconciled = reconcile(loadRegistry(store), await api.system.listFiles());
	let registry = reconciled.registry;
	for (const file of reconciled.unnamed) {
		await api.system.open(file);
		if (await api.meta.isInitialized()) {
			registry = upsertBudget(registry, { file, name: (await api.meta.get()).name });
		} else {
			await api.system.deleteFile(file);
		}
	}
	const file = pickBudget(registry);
	if (!file) {
		saveRegistry(store, registry);
		await api.system.close();
		return { kind: 'onboarding' };
	}
	await api.system.open(file);
	const meta = await api.meta.get();
	saveRegistry(store, markOpened(upsertBudget(registry, { file, name: meta.name }), file));
	return { kind: 'ready', file, meta };
}

export interface NewBudget extends InitBudgetInput {
	account: CreateAccountInput;
}

/** Creates a budget file with its categories and first account, and leaves it open. */
export async function createBudget(
	api: SessionApi,
	store: KeyValueStore,
	input: NewBudget,
	file: string = newBudgetFile()
): Promise<{ file: string; meta: BudgetMeta }> {
	await api.system.open(file);
	try {
		const { account, ...init } = input;
		await api.meta.init(init);
		await api.accounts.create(account);
	} catch (err) {
		await api.system.deleteFile(file).catch(() => {});
		throw err;
	}
	const meta = await api.meta.get();
	saveRegistry(
		store,
		markOpened(upsertBudget(loadRegistry(store), { file, name: meta.name }), file)
	);
	return { file, meta };
}

export type StartupErrorCode =
	'STORAGE_UNAVAILABLE' | 'SCHEMA_TOO_NEW' | 'QUOTA_EXCEEDED' | 'WORKER_FAILED' | 'INTERNAL';

const STARTUP_CODES = new Set<string>(['STORAGE_UNAVAILABLE', 'SCHEMA_TOO_NEW', 'WORKER_FAILED']);

/** Which full-screen message a failure while opening the database deserves. */
export function startupError(err: unknown): { code: StartupErrorCode; message: string } {
	const code = (err as { code?: unknown } | null)?.code;
	const message = err instanceof Error ? err.message : String(err);
	if (typeof code === 'string' && STARTUP_CODES.has(code))
		return { code: code as StartupErrorCode, message };
	if (/quota/i.test(message)) return { code: 'QUOTA_EXCEEDED', message };
	return { code: 'INTERNAL', message };
}
```

Create `src/lib/accounts/account-form.ts`:

```ts
import type { Account, AccountType } from '$lib/db/repos/accounts';

export const ACCOUNT_TYPES: readonly AccountType[] = [
	'checking',
	'savings',
	'cash',
	'credit_card',
	'investment',
	'loan',
	'other'
];

/**
 * Loans and investments default to off-budget: their balances aren't spendable cash, and an
 * on-budget starting balance would count as Ready to Assign income.
 */
export function defaultOnBudget(type: AccountType): boolean {
	return type !== 'investment' && type !== 'loan';
}

/** Credit cards are always on-budget. */
export function onBudgetLocked(type: AccountType): boolean {
	return type === 'credit_card';
}

/** Debt accounts ask for the amount owed rather than a balance. */
export function isDebtType(type: AccountType): boolean {
	return type === 'credit_card' || type === 'loan';
}

/** Turns what the user typed into a signed balance: an amount owed becomes negative. */
export function signedStartingBalance(type: AccountType, typed: number): number {
	return isDebtType(type) && typed !== 0 ? -typed : typed;
}

export type AccountSectionKey = 'onBudget' | 'offBudget' | 'closed';

export interface AccountSection {
	key: AccountSectionKey;
	accounts: Account[];
	total: number;
}

/** Groups accounts the way the sidebar and the accounts page list them. Empty sections are left out. */
export function accountSections(accounts: Account[]): AccountSection[] {
	const sections: AccountSection[] = [
		{ key: 'onBudget', accounts: accounts.filter((a) => !a.closed && a.onBudget), total: 0 },
		{ key: 'offBudget', accounts: accounts.filter((a) => !a.closed && !a.onBudget), total: 0 },
		{ key: 'closed', accounts: accounts.filter((a) => a.closed), total: 0 }
	];
	for (const s of sections) s.total = s.accounts.reduce((sum, a) => sum + a.balance, 0);
	return sections.filter((s) => s.accounts.length > 0);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test src/lib/client src/lib/accounts`

Expected: PASS.

- [ ] **Step 5: Format, check and commit**

```bash
pnpm exec prettier --write src/lib/client/session.ts src/lib/client/session.test.ts src/lib/client/testing.ts src/lib/accounts/account-form.ts src/lib/accounts/account-form.test.ts
```

Run: `pnpm lint && pnpm check`

Expected: Prettier, ESLint and svelte-check report no problems.

Run: `pnpm test`

Expected: every unit test passes.

```bash
git add src/lib/client/session.ts src/lib/client/session.test.ts src/lib/client/testing.ts src/lib/accounts/account-form.ts src/lib/accounts/account-form.test.ts
git commit -m "feat: open, repair and create budgets; add account defaults" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```


---


### Task 8: Boot, startup screens and onboarding

The root layout now boots the app:

1. Claim the tab lock. If another tab has it, show "Moneta is open in another tab" with a button to take over.
2. Start the worker, then open the last budget.
3. Show the matching screen: onboarding when there is no budget, a full-screen error for a startup failure (spec §6), or the page.

If the worker dies later, `onFatal` switches to the error screen, which offers "Reload". When another tab takes over, this tab releases the pool, terminates its worker and shows the blocked screen.

Onboarding is rendered by `Boot` rather than living at an `/onboarding` route, so there is no redirect loop to manage. It asks for the budget name, number format (locale), currency (suggested from the locale), and the first account. It seeds the translated starter categories and asks the browser to keep storage persistent (`navigator.storage.persist()`, spec §2).

`BudgetSession` wraps the RPC client for the open budget, with money formatting and parsing in the budget's currency and locale. Pages get it with `useSession()`.

The Plan 1 dev smoke route is deleted. It started a second worker in the same tab, which now conflicts with `Boot`, and it created a non-budget file in OPFS (a Plan 3 follow-up). The new e2e tests cover what it checked.

**Files:**
- Create: `src/lib/client/app-state.svelte.ts`
- Create: `src/lib/client/notify.ts`
- Create: `src/lib/components/app/StartupScreen.svelte`
- Create: `src/lib/components/accounts/AccountFields.svelte`
- Create: `src/lib/components/app/Onboarding.svelte`
- Create: `src/lib/components/app/Boot.svelte`
- Create: `e2e/helpers.ts`
- Create: `e2e/boot.e2e.ts`
- Modify: `src/routes/+layout.svelte`
- Delete: `src/routes/dev/`

**Interfaces:**
- Consumes: `startDbWorker`, `DbWorker` (Task 3); `createTabLock` (Task 6); `openLastBudget`, `createBudget`, `startupError`, `SessionApi` (Task 7); `account-form` helpers (Task 7); `errorMessage`, `isUnexpected`, `errorDetails`, `defaultCategoryGroups`, `currencyChoices`, `localeChoices`, `suggestCurrency`, `accountTypeLabel` (Task 4); shadcn components (Task 4).
- Produces:
  - `type BootState = { kind: 'loading' } | { kind: 'blocked' } | { kind: 'error'; code: StartupErrorCode; message: string } | { kind: 'onboarding' } | { kind: 'ready' }`
  - `class BudgetSession { client: RpcClient; file: string; meta: BudgetMeta ($state); api: ClientApi; money: MoneyFormat; format(minor): string; parse(text): number | null; watchMeta(): () => void }`
  - `class AppState { boot: BootState; session: BudgetSession | null }`, `getApp()`, `setApp()`, `useSession(): BudgetSession`
  - `notifyError(err): void` (toast with "copy details"), `runAction(fn): Promise<string | null>` (null on success, else the message to show inline)
  - `<AccountFields bind:name bind:type bind:onBudget bind:balance bind:date idPrefix? />`
  - `onboard(page)` e2e helper

- [ ] **Step 1: Write the failing e2e tests**

Until the budget screen exists (Task 9), a ready app shows Plan 1's placeholder home page, and these tests look for its text.

Create `e2e/helpers.ts`:

```ts
import { expect, type Page } from '@playwright/test';

/** Creates a USD budget with a checking account holding $1,000. */
export async function onboard(page: Page, name = 'Home'): Promise<void> {
	await page.goto('/');
	await page.getByLabel('Budget name').fill(name);
	await page.getByLabel('Number and date format').selectOption('en-US');
	await page.getByLabel('Currency').selectOption('USD');
	await page.getByLabel('Account name').fill('Checking');
	await page.getByLabel('Current balance').fill('1000');
	await page.getByRole('button', { name: 'Create budget' }).click();
	await expect(page.getByRole('heading', { name: 'Welcome to Moneta' })).toBeHidden();
}
```

Create `e2e/boot.e2e.ts`:

```ts
import { expect, test } from '@playwright/test';
import { onboard } from './helpers';

// Until the budget screen exists (next task), an open budget shows the placeholder home page.
const HOME = 'The app shell arrives in Plan 2.';

test('onboarding creates a budget that survives a reload', async ({ page }) => {
	await onboard(page);
	await expect(page.getByText(HOME)).toBeVisible();
	await page.reload();
	await expect(page.getByText(HOME)).toBeVisible();
	const registry = await page.evaluate(() => localStorage.getItem('moneta.registry'));
	expect(JSON.parse(registry ?? '{}').budgets).toEqual([expect.objectContaining({ name: 'Home' })]);
});

test('a second tab waits until it takes over', async ({ context }) => {
	const first = await context.newPage();
	await onboard(first);
	await expect(first.getByText(HOME)).toBeVisible();

	const second = await context.newPage();
	await second.goto('/');
	await expect(second.getByText('Moneta is open in another tab')).toBeVisible();
	await second.getByRole('button', { name: 'Use Moneta here' }).click();
	await expect(second.getByText(HOME)).toBeVisible();
	await expect(first.getByText('Moneta is open in another tab')).toBeVisible();
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm test:e2e e2e/boot.e2e.ts`

Expected: FAIL. There is no onboarding form (the tests time out looking for "Budget name").

- [ ] **Step 3: Add the app state and action helpers**

Create `src/lib/client/app-state.svelte.ts`:

```ts
import { createContext } from 'svelte';
import type { ClientApi } from '$lib/db/api';
import type { BudgetMeta } from '$lib/db/repos/meta';
import { formatMoney, parseAmount, type MoneyFormat } from '$lib/domain/money';
import type { RpcClient } from './rpc';
import type { StartupErrorCode } from './session';

export type BootState =
	| { kind: 'loading' }
	| { kind: 'blocked' }
	| { kind: 'error'; code: StartupErrorCode; message: string }
	| { kind: 'onboarding' }
	| { kind: 'ready' };

/** The open budget: the RPC client, its file, and its meta (kept current by `watchMeta`). */
export class BudgetSession {
	readonly client: RpcClient;
	readonly file: string;
	meta: BudgetMeta;

	constructor(client: RpcClient, file: string, meta: BudgetMeta) {
		this.client = client;
		this.file = file;
		this.meta = $state(meta);
	}

	get api(): ClientApi {
		return this.client.api;
	}

	get money(): MoneyFormat {
		return { currency: this.meta.currency, locale: this.meta.locale };
	}

	format = (minor: number): string => formatMoney(minor, this.money);

	parse = (text: string): number | null => parseAmount(text, this.money);

	/** Re-reads meta whenever a write changes it. Returns the unsubscribe function. */
	watchMeta(): () => void {
		return this.client.onChange((tables) => {
			if (tables.includes('meta')) void this.api.meta.get().then((meta) => (this.meta = meta));
		});
	}
}

export class AppState {
	boot: BootState = $state({ kind: 'loading' });
	session: BudgetSession | null = $state(null);
}

export const [getApp, setApp] = createContext<AppState>();

/** The open budget. Only call it from components that render while the app is ready. */
export function useSession(): BudgetSession {
	const session = getApp().session;
	if (!session) throw new Error('No budget is open');
	return session;
}
```

Create `src/lib/client/notify.ts`:

```ts
import { toast } from 'svelte-sonner';
import { errorDetails, errorMessage, isUnexpected } from '$lib/i18n/errors';
import { m } from '$lib/paraglide/messages';

/** Shows an unexpected error as a toast with a "copy details" action. */
export function notifyError(err: unknown): void {
	toast.error(errorMessage(err), {
		action: {
			label: m.copy_details(),
			onClick: () => void navigator.clipboard?.writeText(errorDetails(err))
		}
	});
}

/**
 * Runs a write for a form. Returns null on success, or the message to show inline.
 * Unexpected errors are also reported with a toast.
 */
export async function runAction(fn: () => Promise<unknown>): Promise<string | null> {
	try {
		await fn();
		return null;
	} catch (err) {
		if (isUnexpected(err)) notifyError(err);
		return errorMessage(err);
	}
}
```

- [ ] **Step 4: Add the startup screens and onboarding**

Create `src/lib/components/app/StartupScreen.svelte`:

```svelte
<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import type { BootState } from '$lib/client/app-state.svelte';
	import type { StartupErrorCode } from '$lib/client/session';
	import { m } from '$lib/paraglide/messages';

	let {
		boot,
		onTakeOver
	}: {
		boot: Extract<BootState, { kind: 'loading' | 'blocked' | 'error' }>;
		onTakeOver: () => void;
	} = $props();

	const ERRORS: Record<StartupErrorCode, { title: () => string; body: () => string }> = {
		STORAGE_UNAVAILABLE: {
			title: m.startup_storage_unavailable_title,
			body: m.startup_storage_unavailable_body
		},
		QUOTA_EXCEEDED: { title: m.startup_quota_title, body: m.startup_quota_body },
		SCHEMA_TOO_NEW: { title: m.startup_schema_title, body: m.startup_schema_body },
		WORKER_FAILED: { title: m.startup_worker_title, body: m.startup_worker_body },
		INTERNAL: { title: m.startup_internal_title, body: m.startup_internal_body }
	};
</script>

<main class="flex min-h-dvh items-center justify-center p-6">
	<div class="flex max-w-md flex-col items-center gap-4 text-center">
		<p class="text-2xl font-semibold">{m.app_name()}</p>
		{#if boot.kind === 'loading'}
			<p class="text-muted-foreground" role="status">{m.startup_loading()}</p>
		{:else if boot.kind === 'blocked'}
			<h1 class="text-lg font-medium">{m.startup_blocked_title()}</h1>
			<p class="text-muted-foreground">{m.startup_blocked_body()}</p>
			<Button onclick={onTakeOver}>{m.startup_blocked_take_over()}</Button>
		{:else}
			<h1 class="text-lg font-medium">{ERRORS[boot.code].title()}</h1>
			<p class="text-muted-foreground">{ERRORS[boot.code].body()}</p>
			<pre
				class="max-w-full overflow-x-auto rounded-md bg-muted p-2 text-left text-xs">{boot.message}</pre>
			<Button onclick={() => location.reload()}>{m.startup_reload()}</Button>
		{/if}
	</div>
</main>
```

Create `src/lib/components/accounts/AccountFields.svelte`:

```svelte
<script lang="ts">
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { NativeSelect, NativeSelectOption } from '$lib/components/ui/native-select';
	import { Switch } from '$lib/components/ui/switch';
	import {
		ACCOUNT_TYPES,
		defaultOnBudget,
		isDebtType,
		onBudgetLocked
	} from '$lib/accounts/account-form';
	import type { AccountType } from '$lib/db/repos/accounts';
	import { accountTypeLabel } from '$lib/i18n/labels';
	import { m } from '$lib/paraglide/messages';

	let {
		name = $bindable(),
		type = $bindable(),
		onBudget = $bindable(),
		balance = $bindable(),
		date = $bindable(),
		idPrefix = 'account'
	}: {
		name: string;
		type: AccountType;
		onBudget: boolean;
		balance: string; // as typed
		date: string;
		idPrefix?: string;
	} = $props();

	function typeChanged() {
		onBudget = defaultOnBudget(type);
	}
</script>

<div class="grid gap-2">
	<Label for="{idPrefix}-name">{m.account_name()}</Label>
	<Input id="{idPrefix}-name" bind:value={name} required autocomplete="off" />
</div>
<div class="grid gap-2">
	<Label for="{idPrefix}-type">{m.account_type()}</Label>
	<NativeSelect id="{idPrefix}-type" class="w-full" bind:value={type} onchange={typeChanged}>
		{#each ACCOUNT_TYPES as t (t)}
			<NativeSelectOption value={t}>{accountTypeLabel(t)}</NativeSelectOption>
		{/each}
	</NativeSelect>
</div>
<div class="flex items-center justify-between gap-4">
	<div class="grid gap-1">
		<Label for="{idPrefix}-on-budget">{m.account_on_budget()}</Label>
		<p class="text-xs text-muted-foreground">
			{onBudget ? m.account_on_budget_hint() : m.account_off_budget_hint()}
		</p>
	</div>
	<Switch id="{idPrefix}-on-budget" bind:checked={onBudget} disabled={onBudgetLocked(type)} />
</div>
<div class="grid grid-cols-2 gap-3">
	<div class="grid gap-2">
		<Label for="{idPrefix}-balance">
			{isDebtType(type) ? m.account_amount_owed() : m.account_starting_balance()}
		</Label>
		<Input
			id="{idPrefix}-balance"
			bind:value={balance}
			inputmode="decimal"
			autocomplete="off"
			placeholder="0"
		/>
	</div>
	<div class="grid gap-2">
		<Label for="{idPrefix}-date">{m.account_balance_date()}</Label>
		<Input id="{idPrefix}-date" type="date" bind:value={date} required />
	</div>
</div>
```

Create `src/lib/components/app/Onboarding.svelte`:

```svelte
<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { NativeSelect, NativeSelectOption } from '$lib/components/ui/native-select';
	import AccountFields from '$lib/components/accounts/AccountFields.svelte';
	import { signedStartingBalance } from '$lib/accounts/account-form';
	import { runAction } from '$lib/client/notify';
	import { createBudget, type SessionApi } from '$lib/client/session';
	import type { AccountType } from '$lib/db/repos/accounts';
	import type { BudgetMeta } from '$lib/db/repos/meta';
	import { parseAmount } from '$lib/domain/money';
	import { todayIso } from '$lib/domain/month';
	import { defaultCategoryGroups } from '$lib/i18n/defaults';
	import { currencyChoices, localeChoices, suggestCurrency } from '$lib/i18n/formats';
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';

	let { api, onCreated }: { api: SessionApi; onCreated: (file: string, meta: BudgetMeta) => void } =
		$props();

	const uiLocale = getLocale();
	const locales = localeChoices(uiLocale, navigator.language);
	const currencies = currencyChoices(uiLocale);

	let name = $state(m.onboarding_default_budget_name());
	let locale = $state(locales[0].value);
	let currency = $state(suggestCurrency(locales[0].value));
	let accountName = $state(m.onboarding_default_account_name());
	let accountType = $state<AccountType>('checking');
	let onBudget = $state(true);
	let balance = $state('');
	let date = $state(todayIso());
	let error = $state<string | null>(null);
	let busy = $state(false);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		const typed = balance.trim() === '' ? 0 : parseAmount(balance, { currency, locale });
		if (typed === null) {
			error = m.form_error_amount_invalid();
			return;
		}
		busy = true;
		let created: { file: string; meta: BudgetMeta } | undefined;
		error = await runAction(async () => {
			created = await createBudget(api, localStorage, {
				name,
				currency,
				locale,
				groups: defaultCategoryGroups(),
				account: {
					name: accountName,
					type: accountType,
					onBudget,
					startingBalance: signedStartingBalance(accountType, typed),
					startingDate: date
				}
			});
		});
		busy = false;
		if (!created) return;
		void navigator.storage?.persist?.();
		onCreated(created.file, created.meta);
	}
</script>

<main class="flex min-h-dvh items-start justify-center p-4 sm:items-center">
	<Card.Root class="w-full max-w-lg">
		<Card.Header>
			<Card.Title class="text-xl">{m.onboarding_title()}</Card.Title>
			<Card.Description>{m.onboarding_intro()}</Card.Description>
		</Card.Header>
		<Card.Content>
			<form class="grid gap-6" onsubmit={submit}>
				<fieldset class="grid gap-4">
					<legend class="mb-2 text-sm font-medium">{m.onboarding_budget_section()}</legend>
					<div class="grid gap-2">
						<Label for="budget-name">{m.onboarding_budget_name()}</Label>
						<Input id="budget-name" bind:value={name} required autocomplete="off" />
					</div>
					<div class="grid gap-2">
						<Label for="budget-locale">{m.onboarding_locale()}</Label>
						<NativeSelect
							id="budget-locale"
							class="w-full"
							bind:value={locale}
							onchange={() => (currency = suggestCurrency(locale))}
						>
							{#each locales as choice (choice.value)}
								<NativeSelectOption value={choice.value}>{choice.label}</NativeSelectOption>
							{/each}
						</NativeSelect>
					</div>
					<div class="grid gap-2">
						<Label for="budget-currency">{m.onboarding_currency()}</Label>
						<NativeSelect id="budget-currency" class="w-full" bind:value={currency}>
							{#each currencies as choice (choice.value)}
								<NativeSelectOption value={choice.value}>{choice.label}</NativeSelectOption>
							{/each}
						</NativeSelect>
					</div>
				</fieldset>
				<fieldset class="grid gap-4">
					<legend class="mb-2 text-sm font-medium">{m.onboarding_account_section()}</legend>
					<AccountFields
						bind:name={accountName}
						bind:type={accountType}
						bind:onBudget
						bind:balance
						bind:date
					/>
				</fieldset>
				{#if error}
					<p class="text-sm text-destructive" role="alert">{error}</p>
				{/if}
				<Button type="submit" disabled={busy}>{m.onboarding_create()}</Button>
			</form>
		</Card.Content>
	</Card.Root>
</main>
```

Create `src/lib/components/app/Boot.svelte` (Tasks 9 and 13 change what it shows once ready):

```svelte
<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { AppState, BudgetSession, setApp } from '$lib/client/app-state.svelte';
	import { startDbWorker, type DbWorker } from '$lib/client/db';
	import { openLastBudget, startupError } from '$lib/client/session';
	import { createTabLock, type TabLock } from '$lib/client/tab-lock';
	import type { BudgetMeta } from '$lib/db/repos/meta';
	import Onboarding from './Onboarding.svelte';
	import StartupScreen from './StartupScreen.svelte';

	let { children }: { children: Snippet } = $props();

	const app = new AppState();
	setApp(app);

	let worker: DbWorker | null = $state.raw(null);
	// Without Web Locks (very old browsers) there is no way to coordinate tabs; run unguarded.
	const lock: TabLock | null =
		'locks' in navigator
			? createTabLock({ locks: navigator.locks, channel: new BroadcastChannel('moneta-tab') })
			: null;

	lock?.onLost(async () => {
		await stopWorker();
		app.boot = { kind: 'blocked' };
	});

	async function stopWorker() {
		const current = worker;
		worker = null;
		app.session = null;
		if (!current) return;
		await current.api.system.release().catch(() => {});
		current.terminate();
	}

	async function start() {
		app.boot = { kind: 'loading' };
		const started = startDbWorker();
		worker = started;
		started.onFatal((err) => {
			app.boot = { kind: 'error', code: 'WORKER_FAILED', message: err.message };
		});
		try {
			const result = await openLastBudget(started.api, localStorage);
			if (result.kind === 'ready') ready(result.file, result.meta);
			else app.boot = { kind: 'onboarding' };
		} catch (err) {
			app.boot = { kind: 'error', ...startupError(err) };
		}
	}

	function ready(file: string, meta: BudgetMeta) {
		if (!worker) return;
		app.session = new BudgetSession(worker, file, meta);
		app.boot = { kind: 'ready' };
	}

	async function takeOver() {
		app.boot = { kind: 'loading' };
		await lock?.takeOver();
		await start();
	}

	onMount(() => {
		void (async () => {
			if (!lock || (await lock.tryAcquire())) await start();
			else app.boot = { kind: 'blocked' };
		})();
	});

	$effect(() => app.session?.watchMeta());
</script>

{#if app.boot.kind === 'ready' && app.session}
	{#key app.session.file}
		{@render children()}
	{/key}
{:else if app.boot.kind === 'onboarding' && worker}
	<Onboarding
		api={worker.api}
		onCreated={(file, meta) => {
			ready(file, meta);
			void goto(resolve('/'));
		}}
	/>
{:else if app.boot.kind === 'loading' || app.boot.kind === 'blocked' || app.boot.kind === 'error'}
	<StartupScreen boot={app.boot} onTakeOver={takeOver} />
{/if}
```

- [ ] **Step 5: Boot from the root layout and drop the dev smoke route**

Replace `src/routes/+layout.svelte`:

```svelte
<script lang="ts">
	import './layout.css';
	import type { Snippet } from 'svelte';
	import { ModeWatcher } from 'mode-watcher';
	import favicon from '$lib/assets/favicon.svg';
	import { Toaster } from '$lib/components/ui/sonner';
	import Boot from '$lib/components/app/Boot.svelte';
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';

	let { children }: { children: Snippet } = $props();

	// The app is a client-only SPA, so the document is always there.
	document.documentElement.lang = getLocale();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>{m.app_name()}</title>
</svelte:head>

<ModeWatcher />
<Toaster richColors closeButton />
<Boot>{@render children()}</Boot>
```

```bash
git rm -r src/routes/dev
```

- [ ] **Step 6: Run the e2e tests to verify they pass**

Run: `pnpm test:e2e`

Expected: PASS (2 tests): the budget survives a reload, and the second tab waits and then takes over.

- [ ] **Step 7: Format, check and commit**

```bash
pnpm exec prettier --write src/lib/client/app-state.svelte.ts src/lib/client/notify.ts src/lib/components/app/StartupScreen.svelte src/lib/components/accounts/AccountFields.svelte src/lib/components/app/Onboarding.svelte src/lib/components/app/Boot.svelte src/routes/+layout.svelte e2e/helpers.ts e2e/boot.e2e.ts
```

Run: `pnpm lint && pnpm check`

Expected: Prettier, ESLint and svelte-check report no problems.

Run: `pnpm test`

Expected: every unit test passes.

```bash
git add src/lib/client/app-state.svelte.ts src/lib/client/notify.ts src/lib/components/app/StartupScreen.svelte src/lib/components/accounts/AccountFields.svelte src/lib/components/app/Onboarding.svelte src/lib/components/app/Boot.svelte src/routes/+layout.svelte e2e/helpers.ts e2e/boot.e2e.ts
git commit -m "feat: boot with tab ownership, startup screens and onboarding" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```


---


### Task 9: Budget screen: month, Ready to Assign and the category grid

The read-only budget screen at `/budget/[month]`. It has the month picker (‹ September 2026 ›, with a "Today" link), the Ready to Assign card, which expands into the spec §4 breakdown, the future-month warning, and the grid of groups and categories. The grid shows Assigned, Activity and an Available pill: green when positive, yellow when card spending isn't covered, and red when cash is overspent. Hidden categories, and everything in a hidden group, go in a collapsible section. The Credit Card Payments group is left out while it has no cards. Below 768px the Assigned column is hidden (spec §5).

`useLive` is the component-friendly `liveQuery`. The query re-runs after writes to the tables it names, and again when reactive values it reads change (here, the month in the URL). `/` and invalid months redirect to the current month.

**Files:**
- Create: `src/lib/client/live.svelte.ts`
- Create: `src/lib/budget/view.ts`
- Create: `src/lib/components/budget/MonthPicker.svelte`
- Create: `src/lib/components/budget/RtaCard.svelte`
- Create: `src/lib/components/budget/AvailablePill.svelte`
- Create: `src/lib/components/budget/BudgetGrid.svelte`
- Create: `src/routes/+page.ts`
- Create: `src/routes/budget/[month]/+page.ts`
- Create: `src/routes/budget/[month]/+page.svelte`
- Create: `src/lib/budget/view.test.ts`
- Modify: `src/lib/components/app/Boot.svelte`
- Modify: `src/routes/+page.svelte`
- Modify: `e2e/helpers.ts`
- Modify: `e2e/boot.e2e.ts`
- Test: `e2e/budget.e2e.ts`

**Interfaces:**
- Consumes: `liveQuery`, `LiveState` (Plan 1); `useSession` (Task 8); `BudgetMonthView`, `BudgetGroupView`, `BudgetCategoryView` (Plan 1); `groupLabel`, `formatMonthLong` (Task 4).
- Produces:
  - `useLive<T>(client, tables, fetch): LiveState<T>` in `src/lib/client/live.svelte.ts` (call during component init)
  - `BUDGET_TABLES`, `availableTone(category): 'positive' | 'zero' | 'credit' | 'overspent'`, `gridModel(view): GridModel` with `GridModel = { groups: BudgetGroupView[]; hidden: { group; category }[] }`, `moveTargets(model, exceptId): CategoryChoice[]` with `CategoryChoice = { id; name; group: { name; system } }`
  - `<MonthPicker month />`, `<RtaCard view />`, `<AvailablePill category />`, `<BudgetGrid model />` (Task 10 adds props)
  - test ids: `rta-amount`, `category-row`, `group-row`, `available`, `activity`, `assigned`, `month-label`
  - `categoryRow(page, name)` e2e helper

- [ ] **Step 1: Write the failing tests**

Create `src/lib/budget/view.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type { BudgetCategoryView, BudgetGroupView, BudgetMonthView } from '$lib/db/repos/budget';
import { availableTone, gridModel, moveTargets } from './view';

const cat = (id: string, p: Partial<BudgetCategoryView> = {}): BudgetCategoryView => ({
	id,
	name: id,
	hidden: false,
	carryoverOverspending: false,
	ccAccountId: null,
	carryover: 0,
	assigned: 0,
	activity: 0,
	available: 0,
	cashOverspent: 0,
	creditOverspent: 0,
	...p
});

const group = (
	id: string,
	categories: BudgetCategoryView[],
	p: Partial<BudgetGroupView> = {}
): BudgetGroupView => ({
	id,
	name: id,
	hidden: false,
	system: null,
	assigned: 0,
	activity: 0,
	available: 0,
	categories,
	...p
});

const month = (groups: BudgetGroupView[]): BudgetMonthView => ({
	month: '2026-09',
	readyToAssign: 0,
	availableFunds: 0,
	overspentLastMonth: 0,
	assignedThisMonth: 0,
	futureNegativeMonth: null,
	groups
});

describe('availableTone', () => {
	it('is green, neutral, yellow for uncovered card spending, and red for cash overspending', () => {
		expect(availableTone({ available: 100, cashOverspent: 0 })).toBe('positive');
		expect(availableTone({ available: 0, cashOverspent: 0 })).toBe('zero');
		expect(availableTone({ available: -100, cashOverspent: 0 })).toBe('credit');
		expect(availableTone({ available: -100, cashOverspent: 40 })).toBe('overspent');
	});
});

describe('gridModel', () => {
	it('moves hidden categories and hidden groups into the hidden section', () => {
		const model = gridModel(
			month([
				group('Bills', [cat('Rent'), cat('Old', { hidden: true })]),
				group('Archive', [cat('Gym')], { hidden: true })
			])
		);
		expect(model.groups.map((g) => [g.name, g.categories.map((c) => c.name)])).toEqual([
			['Bills', ['Rent']]
		]);
		expect(model.hidden.map((h) => `${h.group.name}/${h.category.name}`)).toEqual([
			'Bills/Old',
			'Archive/Gym'
		]);
	});

	it('shows empty user groups but not an empty card payments group', () => {
		const model = gridModel(
			month([group('Cards', [], { system: 'credit_card_payments' }), group('New', [])])
		);
		expect(model.groups.map((g) => g.name)).toEqual(['New']);
	});
});

describe('moveTargets', () => {
	it('lists the other visible categories with their group', () => {
		const model = gridModel(month([group('Bills', [cat('Rent'), cat('Power')])]));
		expect(moveTargets(model, 'Rent')).toEqual([
			{ id: 'Power', name: 'Power', group: { name: 'Bills', system: null } }
		]);
	});
});
```

Replace `e2e/helpers.ts` (onboarding now lands on the budget):

```ts
import { expect, type Page } from '@playwright/test';

/** Creates a USD budget with a checking account holding $1,000 and lands on the budget screen. */
export async function onboard(page: Page, name = 'Home'): Promise<void> {
	await page.goto('/');
	await page.getByLabel('Budget name').fill(name);
	await page.getByLabel('Number and date format').selectOption('en-US');
	await page.getByLabel('Currency').selectOption('USD');
	await page.getByLabel('Account name').fill('Checking');
	await page.getByLabel('Current balance').fill('1000');
	await page.getByRole('button', { name: 'Create budget' }).click();
	await expect(page.getByTestId('rta-amount')).toHaveText('$1,000.00');
}

export function categoryRow(page: Page, name: string) {
	return page.getByTestId('category-row').filter({ hasText: name });
}
```

Replace `e2e/boot.e2e.ts`:

```ts
import { expect, test } from '@playwright/test';
import { onboard } from './helpers';

test('onboarding creates a budget that survives a reload', async ({ page }) => {
	await onboard(page);
	await page.reload();
	await expect(page.getByTestId('rta-amount')).toHaveText('$1,000.00');
	await expect(page.getByTestId('category-row').filter({ hasText: 'Groceries' })).toBeVisible();
});

test('a second tab waits until it takes over', async ({ context }) => {
	const first = await context.newPage();
	await onboard(first);

	const second = await context.newPage();
	await second.goto('/');
	await expect(second.getByText('Moneta is open in another tab')).toBeVisible();
	await second.getByRole('button', { name: 'Use Moneta here' }).click();
	await expect(second.getByTestId('rta-amount')).toHaveText('$1,000.00');
	await expect(first.getByText('Moneta is open in another tab')).toBeVisible();
});
```

Create `e2e/budget.e2e.ts`:

```ts
import { expect, test } from '@playwright/test';
import { categoryRow, onboard } from './helpers';

test('shows the month with Ready to Assign and the starter categories', async ({ page }) => {
	await onboard(page);
	await expect(page).toHaveURL(/\/budget\/\d{4}-\d{2}$/);
	await expect(categoryRow(page, 'Groceries').getByTestId('available')).toHaveText('$0.00');
	await page.getByTestId('rta-amount').click();
	await expect(page.getByText('Funds available')).toBeVisible();
});

test('sends invalid months to the current one', async ({ page }) => {
	await onboard(page);
	const current = page.url();
	await page.goto('/budget/9999-01');
	await expect(page).toHaveURL(current);
});
```

- [ ] **Step 2: Run the unit test to verify it fails**

Run: `pnpm test src/lib/budget`

Expected: FAIL. `./view` does not exist.

- [ ] **Step 3: Implement the grid model**

Create `src/lib/budget/view.ts`:

```ts
import type { Table } from '$lib/db/connection';
import type { BudgetCategoryView, BudgetGroupView, BudgetMonthView } from '$lib/db/repos/budget';

/** Every table a budget month depends on. */
export const BUDGET_TABLES: readonly Table[] = [
	'budget_assignments',
	'transactions',
	'transaction_splits',
	'categories',
	'category_groups',
	'accounts'
];

/** The Available pill's color: green, neutral, yellow (card spending not covered) or red. */
export type AvailableTone = 'positive' | 'zero' | 'credit' | 'overspent';

export function availableTone(
	category: Pick<BudgetCategoryView, 'available' | 'cashOverspent'>
): AvailableTone {
	if (category.available > 0) return 'positive';
	if (category.available === 0) return 'zero';
	return category.cashOverspent > 0 ? 'overspent' : 'credit';
}

export interface HiddenCategory {
	group: BudgetGroupView;
	category: BudgetCategoryView;
}

export interface GridModel {
	groups: BudgetGroupView[];
	hidden: HiddenCategory[];
}

/**
 * Splits the month view into what the grid shows and the collapsible hidden section.
 * A hidden group hides all its categories. The card payments group is left out while empty.
 */
export function gridModel(view: BudgetMonthView): GridModel {
	const groups: BudgetGroupView[] = [];
	const hidden: HiddenCategory[] = [];
	for (const group of view.groups) {
		const visible = group.categories.filter((c) => !group.hidden && !c.hidden);
		for (const category of group.categories)
			if (group.hidden || category.hidden) hidden.push({ group, category });
		if (group.hidden || (group.system && visible.length === 0)) continue;
		groups.push({ ...group, categories: visible });
	}
	return { groups, hidden };
}

export interface CategoryChoice {
	id: string;
	name: string;
	group: Pick<BudgetGroupView, 'name' | 'system'>;
}

/** Visible categories to move money to or from, excluding `exceptId`. */
export function moveTargets(model: GridModel, exceptId: string): CategoryChoice[] {
	return model.groups.flatMap((g) =>
		g.categories
			.filter((c) => c.id !== exceptId)
			.map((c) => ({ id: c.id, name: c.name, group: { name: g.name, system: g.system } }))
	);
}
```

- [ ] **Step 4: Run the unit test to verify it passes**

Run: `pnpm test src/lib/budget`

Expected: PASS.

- [ ] **Step 5: Add the live-query helper and the budget components**

Create `src/lib/client/live.svelte.ts`:

```ts
import { untrack } from 'svelte';
import type { Table } from '$lib/db/connection';
import { liveQuery, type LiveState } from './live';
import type { RpcClient } from './rpc';

/**
 * Component-friendly liveQuery. `fetch` runs now and again after every write that touches
 * `tables`. Reactive values that `fetch` reads before its first `await` are tracked, so the
 * query restarts when they change (e.g. the month in the URL). While a restarted query loads,
 * the previous data stays visible.
 */
export function useLive<T>(
	client: Pick<RpcClient, 'onChange'>,
	tables: readonly Table[],
	fetch: () => Promise<T>
): LiveState<T> {
	let state = $state<LiveState<T>>({ data: undefined, error: undefined, loading: true });
	$effect(() => {
		const store = liveQuery(client, tables, fetch);
		return store.subscribe((next) => {
			untrack(() => {
				state = next.data === undefined && next.loading ? { ...next, data: state.data } : next;
			});
		});
	});
	return {
		get data() {
			return state.data;
		},
		get error() {
			return state.error;
		},
		get loading() {
			return state.loading;
		}
	};
}
```

Create `src/lib/components/budget/MonthPicker.svelte`:

```svelte
<script lang="ts">
	import { resolve } from '$app/paths';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import { Button } from '$lib/components/ui/button';
	import { addMonths, currentMonth, type Month } from '$lib/domain/month';
	import { formatMonthLong } from '$lib/i18n/formats';
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';

	let { month }: { month: Month } = $props();
	const today = currentMonth();
</script>

<div class="flex items-center gap-1">
	<Button
		variant="ghost"
		size="icon"
		href={resolve('/budget/[month]', { month: addMonths(month, -1) })}
		aria-label={m.budget_previous_month()}
	>
		<ChevronLeftIcon />
	</Button>
	<h1 class="min-w-40 text-center text-lg font-semibold capitalize" data-testid="month-label">
		{formatMonthLong(month, getLocale())}
	</h1>
	<Button
		variant="ghost"
		size="icon"
		href={resolve('/budget/[month]', { month: addMonths(month, 1) })}
		aria-label={m.budget_next_month()}
	>
		<ChevronRightIcon />
	</Button>
	{#if month !== today}
		<Button variant="outline" size="sm" href={resolve('/budget/[month]', { month: today })}>
			{m.budget_this_month()}
		</Button>
	{/if}
</div>
```

Create `src/lib/components/budget/RtaCard.svelte`:

```svelte
<script lang="ts">
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import { useSession } from '$lib/client/app-state.svelte';
	import type { BudgetMonthView } from '$lib/db/repos/budget';
	import { m } from '$lib/paraglide/messages';

	let { view }: { view: BudgetMonthView } = $props();
	const session = useSession();
	let expanded = $state(false);

	const tone = $derived(
		view.readyToAssign > 0
			? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200'
			: view.readyToAssign < 0
				? 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200'
				: 'bg-muted text-foreground'
	);
</script>

<div class="rounded-xl {tone}">
	<button
		type="button"
		class="flex w-full items-center justify-between gap-4 px-4 py-3 text-left"
		aria-expanded={expanded}
		onclick={() => (expanded = !expanded)}
	>
		<span>
			<span class="block text-2xl font-semibold tabular-nums" data-testid="rta-amount">
				{session.format(view.readyToAssign)}
			</span>
			<span class="text-sm">{m.budget_ready_to_assign()}</span>
		</span>
		<ChevronDownIcon class="size-5 transition-transform {expanded ? 'rotate-180' : ''}" />
	</button>
	{#if expanded}
		<dl class="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 px-4 pb-3 text-sm">
			<dt>{m.budget_funds_available()}</dt>
			<dd class="text-right tabular-nums">{session.format(view.availableFunds)}</dd>
			<dt>{m.budget_overspent_last_month()}</dt>
			<dd class="text-right tabular-nums">{session.format(-view.overspentLastMonth)}</dd>
			<dt>{m.budget_assigned_this_month()}</dt>
			<dd class="text-right tabular-nums">{session.format(-view.assignedThisMonth)}</dd>
			<dt class="font-medium">{m.budget_ready_to_assign()}</dt>
			<dd class="text-right font-medium tabular-nums">{session.format(view.readyToAssign)}</dd>
		</dl>
	{/if}
</div>
```

Create `src/lib/components/budget/AvailablePill.svelte`:

```svelte
<script lang="ts">
	import { useSession } from '$lib/client/app-state.svelte';
	import { availableTone, type AvailableTone } from '$lib/budget/view';
	import type { BudgetCategoryView } from '$lib/db/repos/budget';

	let { category }: { category: Pick<BudgetCategoryView, 'available' | 'cashOverspent'> } =
		$props();
	const session = useSession();

	const TONES: Record<AvailableTone, string> = {
		positive: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
		zero: 'bg-muted text-muted-foreground',
		credit: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
		overspent: 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200'
	};
	const tone = $derived(availableTone(category));
</script>

<span
	class="inline-block rounded-full px-2 py-0.5 text-sm font-medium tabular-nums {TONES[tone]}"
	data-testid="available"
	data-tone={tone}
>
	{session.format(category.available)}
</span>
```

Create `src/lib/components/budget/BudgetGrid.svelte` (read-only for now; Task 10 makes it editable):

```svelte
<script lang="ts">
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import * as Collapsible from '$lib/components/ui/collapsible';
	import { useSession } from '$lib/client/app-state.svelte';
	import type { GridModel } from '$lib/budget/view';
	import type { BudgetCategoryView } from '$lib/db/repos/budget';
	import { groupLabel } from '$lib/i18n/labels';
	import { m } from '$lib/paraglide/messages';
	import AvailablePill from './AvailablePill.svelte';

	let { model }: { model: GridModel } = $props();

	const session = useSession();
	const COLUMNS =
		'grid grid-cols-[1fr_auto_auto] items-center gap-2 md:grid-cols-[1fr_9rem_8rem_9rem]';
</script>

{#snippet categoryRow(category: BudgetCategoryView)}
	<div class="{COLUMNS} border-b px-3 py-1.5" data-testid="category-row">
		<span class="truncate">{category.name}</span>
		<span class="hidden text-right tabular-nums md:block" data-testid="assigned">
			{session.format(category.assigned)}
		</span>
		<span class="text-right text-sm text-muted-foreground tabular-nums" data-testid="activity">
			{session.format(category.activity)}
		</span>
		<span class="text-right"><AvailablePill {category} /></span>
	</div>
{/snippet}

<section aria-label={m.budget_categories()}>
	<div
		class="{COLUMNS} sticky top-0 z-10 border-b bg-background px-3 py-2 text-xs font-medium text-muted-foreground uppercase"
	>
		<span>{m.budget_category()}</span>
		<span class="hidden text-right md:block">{m.budget_assigned()}</span>
		<span class="text-right">{m.budget_activity()}</span>
		<span class="text-right">{m.budget_available()}</span>
	</div>
	{#each model.groups as group (group.id)}
		<div class="{COLUMNS} border-b bg-muted/60 px-3 py-2 font-medium" data-testid="group-row">
			<span class="truncate">{groupLabel(group)}</span>
			<span class="hidden text-right tabular-nums md:block">{session.format(group.assigned)}</span>
			<span class="text-right text-sm tabular-nums">{session.format(group.activity)}</span>
			<span class="text-right tabular-nums">{session.format(group.available)}</span>
		</div>
		{#each group.categories as category (category.id)}
			{@render categoryRow(category)}
		{/each}
	{/each}
</section>

{#if model.hidden.length > 0}
	<Collapsible.Root class="mt-4">
		<Collapsible.Trigger
			class="group flex items-center gap-1 px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
		>
			<ChevronRightIcon class="size-4 transition-transform group-data-[state=open]:rotate-90" />
			{m.budget_hidden_categories({ count: model.hidden.length })}
		</Collapsible.Trigger>
		<Collapsible.Content>
			{#each model.hidden as { category } (category.id)}
				{@render categoryRow(category)}
			{/each}
		</Collapsible.Content>
	</Collapsible.Root>
{/if}
```

- [ ] **Step 6: Add the routes**

Create `src/routes/+page.ts`:

```ts
import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { currentMonth } from '$lib/domain/month';

export function load() {
	redirect(307, resolve('/budget/[month]', { month: currentMonth() }));
}
```

Replace `src/routes/+page.svelte`:

```svelte
<!-- `/` redirects to the current month's budget (see +page.ts). -->
```

Create `src/routes/budget/[month]/+page.ts`:

```ts
import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { currentMonth, isMonth } from '$lib/domain/month';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ params }) => {
	if (!isMonth(params.month)) redirect(307, resolve('/budget/[month]', { month: currentMonth() }));
	return { month: params.month };
};
```

Create `src/routes/budget/[month]/+page.svelte`:

```svelte
<script lang="ts">
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import * as Alert from '$lib/components/ui/alert';
	import BudgetGrid from '$lib/components/budget/BudgetGrid.svelte';
	import MonthPicker from '$lib/components/budget/MonthPicker.svelte';
	import RtaCard from '$lib/components/budget/RtaCard.svelte';
	import { useSession } from '$lib/client/app-state.svelte';
	import { useLive } from '$lib/client/live.svelte';
	import { BUDGET_TABLES, gridModel } from '$lib/budget/view';
	import { errorMessage } from '$lib/i18n/errors';
	import { formatMonthLong } from '$lib/i18n/formats';
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const session = useSession();
	const view = useLive(session.client, BUDGET_TABLES, () => session.api.budget.month(data.month));
	const model = $derived(view.data ? gridModel(view.data) : null);
</script>

<div class="mx-auto grid max-w-5xl gap-4 p-3 md:p-6">
	<header class="grid gap-3 md:grid-cols-[1fr_20rem] md:items-center">
		<MonthPicker month={data.month} />
		{#if view.data}<RtaCard view={view.data} />{/if}
	</header>

	{#if view.data?.futureNegativeMonth}
		<Alert.Root variant="destructive">
			<TriangleAlertIcon />
			<Alert.Title>{m.budget_future_negative_title()}</Alert.Title>
			<Alert.Description>
				{m.budget_future_negative_body({
					month: formatMonthLong(view.data.futureNegativeMonth, getLocale())
				})}
			</Alert.Description>
		</Alert.Root>
	{/if}

	{#if view.error && !view.data}
		<p class="text-destructive" role="alert">{errorMessage(view.error)}</p>
	{/if}

	{#if view.data && model}
		<BudgetGrid {model} />
	{/if}
</div>

<svelte:head><title>{m.nav_budget()} · {m.app_name()}</title></svelte:head>
```

- [ ] **Step 7: Land on the budget after onboarding**

Replace `src/lib/components/app/Boot.svelte` (imports `currentMonth` and sends a new budget to `/budget/<current month>`):

```svelte
<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { AppState, BudgetSession, setApp } from '$lib/client/app-state.svelte';
	import { startDbWorker, type DbWorker } from '$lib/client/db';
	import { openLastBudget, startupError } from '$lib/client/session';
	import { createTabLock, type TabLock } from '$lib/client/tab-lock';
	import type { BudgetMeta } from '$lib/db/repos/meta';
	import { currentMonth } from '$lib/domain/month';
	import Onboarding from './Onboarding.svelte';
	import StartupScreen from './StartupScreen.svelte';

	let { children }: { children: Snippet } = $props();

	const app = new AppState();
	setApp(app);

	let worker: DbWorker | null = $state.raw(null);
	// Without Web Locks (very old browsers) there is no way to coordinate tabs; run unguarded.
	const lock: TabLock | null =
		'locks' in navigator
			? createTabLock({ locks: navigator.locks, channel: new BroadcastChannel('moneta-tab') })
			: null;

	lock?.onLost(async () => {
		await stopWorker();
		app.boot = { kind: 'blocked' };
	});

	async function stopWorker() {
		const current = worker;
		worker = null;
		app.session = null;
		if (!current) return;
		await current.api.system.release().catch(() => {});
		current.terminate();
	}

	async function start() {
		app.boot = { kind: 'loading' };
		const started = startDbWorker();
		worker = started;
		started.onFatal((err) => {
			app.boot = { kind: 'error', code: 'WORKER_FAILED', message: err.message };
		});
		try {
			const result = await openLastBudget(started.api, localStorage);
			if (result.kind === 'ready') ready(result.file, result.meta);
			else app.boot = { kind: 'onboarding' };
		} catch (err) {
			app.boot = { kind: 'error', ...startupError(err) };
		}
	}

	function ready(file: string, meta: BudgetMeta) {
		if (!worker) return;
		app.session = new BudgetSession(worker, file, meta);
		app.boot = { kind: 'ready' };
	}

	async function takeOver() {
		app.boot = { kind: 'loading' };
		await lock?.takeOver();
		await start();
	}

	onMount(() => {
		void (async () => {
			if (!lock || (await lock.tryAcquire())) await start();
			else app.boot = { kind: 'blocked' };
		})();
	});

	$effect(() => app.session?.watchMeta());
</script>

{#if app.boot.kind === 'ready' && app.session}
	{#key app.session.file}
		{@render children()}
	{/key}
{:else if app.boot.kind === 'onboarding' && worker}
	<Onboarding
		api={worker.api}
		onCreated={(file, meta) => {
			ready(file, meta);
			void goto(resolve('/budget/[month]', { month: currentMonth() }));
		}}
	/>
{:else if app.boot.kind === 'loading' || app.boot.kind === 'blocked' || app.boot.kind === 'error'}
	<StartupScreen boot={app.boot} onTakeOver={takeOver} />
{/if}
```

- [ ] **Step 8: Run the e2e tests to verify they pass**

Run: `pnpm test:e2e`

Expected: PASS (4 tests).

- [ ] **Step 9: Format, check and commit**

```bash
pnpm exec prettier --write src/lib/client/live.svelte.ts src/lib/budget/view.ts src/lib/components/budget/MonthPicker.svelte src/lib/components/budget/RtaCard.svelte src/lib/components/budget/AvailablePill.svelte src/lib/components/budget/BudgetGrid.svelte src/routes/+page.ts 'src/routes/budget/[month]/+page.ts' 'src/routes/budget/[month]/+page.svelte' src/lib/budget/view.test.ts src/lib/components/app/Boot.svelte src/routes/+page.svelte e2e/helpers.ts e2e/boot.e2e.ts e2e/budget.e2e.ts
```

Run: `pnpm lint && pnpm check`

Expected: Prettier, ESLint and svelte-check report no problems.

Run: `pnpm test`

Expected: every unit test passes.

```bash
git add src/lib/client/live.svelte.ts src/lib/budget/view.ts src/lib/components/budget/MonthPicker.svelte src/lib/components/budget/RtaCard.svelte src/lib/components/budget/AvailablePill.svelte src/lib/components/budget/BudgetGrid.svelte src/routes/+page.ts 'src/routes/budget/[month]/+page.ts' 'src/routes/budget/[month]/+page.svelte' src/lib/budget/view.test.ts src/lib/components/app/Boot.svelte src/routes/+page.svelte e2e/helpers.ts e2e/boot.e2e.ts e2e/budget.e2e.ts
git commit -m "feat: add the budget screen with Ready to Assign and the category grid" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```


---


### Task 10: Assigning: inline edits, the category sheet and quick-assign

Makes the budget editable (spec §5):

- **Desktop:** each Assigned cell is an input. It shows the formatted amount and edits as plain text. Enter or blur saves, Escape cancels. Arithmetic like `120+35` works, since `parseAmount` evaluates it.
- **Everywhere:** tapping a category name opens a sheet (a dialog on desktop). There you can set Assigned, move money to or from another category, or quick-assign: same as last month, the 3/6/12-month average, cover overspending, or clear. Tapping a group name opens quick-assign for the whole group.

`ResponsiveDialog` is a bottom sheet below 768px and a dialog above. The page looks the selected category up in the live month view, so an open sheet shows fresh numbers after each write.

**Files:**
- Create: `src/lib/components/ResponsiveDialog.svelte`
- Create: `src/lib/components/budget/AssignedInput.svelte`
- Create: `src/lib/components/budget/QuickAssignButtons.svelte`
- Create: `src/lib/components/budget/CategorySheet.svelte`
- Create: `src/lib/components/budget/GroupSheet.svelte`
- Modify: `src/lib/components/budget/BudgetGrid.svelte`
- Modify: `src/routes/budget/[month]/+page.svelte`
- Test: `e2e/budget.e2e.ts`

**Interfaces:**
- Consumes: `useSession`, `runAction` (Task 8); `useLive`, `gridModel`, `moveTargets` (Task 9); `formatAmountInput` (Task 1); `api.budget.setAssigned/moveMoney/quickAssign`, `QuickAssignStrategy` (Plan 1).
- Produces:
  - `<ResponsiveDialog bind:open title description?>…</ResponsiveDialog>`
  - `<BudgetGrid model month onSelectCategory={(id) => …} onSelectGroup={(id) => …} />`
  - `<CategorySheet bind:open category month model />` (Task 11 adds `groups`), `<GroupSheet bind:open group month />`, `<QuickAssignButtons categoryIds month onDone />`

- [ ] **Step 1: Write the failing e2e tests**

Replace `e2e/budget.e2e.ts` (adds the desktop and phone assigning tests):

```ts
import { expect, test } from '@playwright/test';
import { categoryRow, onboard } from './helpers';

test('shows the month with Ready to Assign and the starter categories', async ({ page }) => {
	await onboard(page);
	await expect(page).toHaveURL(/\/budget\/\d{4}-\d{2}$/);
	await expect(categoryRow(page, 'Groceries').getByTestId('available')).toHaveText('$0.00');
	await page.getByTestId('rta-amount').click();
	await expect(page.getByText('Funds available')).toBeVisible();
});

test('sends invalid months to the current one', async ({ page }) => {
	await onboard(page);
	const current = page.url();
	await page.goto('/budget/9999-01');
	await expect(page).toHaveURL(current);
});

test('assigns inline with arithmetic on desktop', async ({ page }) => {
	await onboard(page);
	const groceries = categoryRow(page, 'Groceries');
	await groceries.getByTestId('assigned').fill('250+50');
	await groceries.getByTestId('assigned').press('Enter');
	await expect(page.getByTestId('rta-amount')).toHaveText('$700.00');
	await expect(groceries.getByTestId('available')).toHaveText('$300.00');
});

test.describe('on a phone', () => {
	test.use({ viewport: { width: 390, height: 844 } });

	test('assigns and moves money from the category sheet', async ({ page }) => {
		await onboard(page);
		await categoryRow(page, 'Groceries').getByRole('button', { name: 'Groceries' }).click();
		const sheet = page.getByRole('dialog');
		await sheet.getByLabel('Assigned this month').fill('120+35');
		await sheet.getByRole('button', { name: 'Save' }).first().click();
		await expect(categoryRow(page, 'Groceries').getByTestId('available')).toHaveText('$155.00');

		await categoryRow(page, 'Groceries').getByRole('button', { name: 'Groceries' }).click();
		await sheet.getByLabel('Other category').selectOption({ label: 'Everyday · Household' });
		await sheet.getByLabel('Amount to move').fill('55');
		await sheet.getByRole('button', { name: 'Move', exact: true }).click();
		await expect(categoryRow(page, 'Groceries').getByTestId('available')).toHaveText('$100.00');
		await expect(categoryRow(page, 'Household').getByTestId('available')).toHaveText('$55.00');
	});
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm test:e2e e2e/budget.e2e.ts`

Expected: FAIL. The Assigned cell is plain text, and category names aren't buttons.

- [ ] **Step 3: Add the dialog and the editing components**

Create `src/lib/components/ResponsiveDialog.svelte`:

```svelte
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { MediaQuery } from 'svelte/reactivity';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Sheet from '$lib/components/ui/sheet';

	/** A dialog on desktop and a bottom sheet on phones (below 768px). */
	let {
		open = $bindable(false),
		title,
		description,
		children
	}: { open: boolean; title: string; description?: string; children: Snippet } = $props();

	const desktop = new MediaQuery('min-width: 768px');
</script>

{#if desktop.current}
	<Dialog.Root bind:open>
		<Dialog.Content class="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
			<Dialog.Header>
				<Dialog.Title>{title}</Dialog.Title>
				{#if description}<Dialog.Description>{description}</Dialog.Description>{/if}
			</Dialog.Header>
			{@render children()}
		</Dialog.Content>
	</Dialog.Root>
{:else}
	<Sheet.Root bind:open>
		<Sheet.Content side="bottom" class="max-h-[90dvh] overflow-y-auto">
			<Sheet.Header>
				<Sheet.Title>{title}</Sheet.Title>
				{#if description}<Sheet.Description>{description}</Sheet.Description>{/if}
			</Sheet.Header>
			<div class="px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{@render children()}</div>
		</Sheet.Content>
	</Sheet.Root>
{/if}
```

Create `src/lib/components/budget/AssignedInput.svelte`:

```svelte
<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { useSession } from '$lib/client/app-state.svelte';
	import { runAction } from '$lib/client/notify';
	import { formatAmountInput } from '$lib/domain/money';
	import type { Month } from '$lib/domain/month';
	import { m } from '$lib/paraglide/messages';

	/** Inline "Assigned" cell: shows the amount, edits as plain text, accepts arithmetic like 120+35. */
	let {
		categoryId,
		month,
		assigned,
		label
	}: { categoryId: string; month: Month; assigned: number; label: string } = $props();

	const session = useSession();
	let editing = $state(false);
	let text = $state('');

	function focus(event: FocusEvent) {
		text = assigned === 0 ? '' : formatAmountInput(assigned, session.money);
		editing = true;
		queueMicrotask(() => (event.target as HTMLInputElement).select());
	}

	async function commit() {
		if (!editing) return;
		editing = false;
		const value = text.trim() === '' ? 0 : session.parse(text);
		if (value === null) {
			toast.error(m.form_error_amount_invalid());
			return;
		}
		if (value === assigned) return;
		const error = await runAction(() => session.api.budget.setAssigned(categoryId, month, value));
		if (error) toast.error(error);
	}

	function keydown(event: KeyboardEvent) {
		const input = event.target as HTMLInputElement;
		if (event.key === 'Enter') input.blur();
		if (event.key === 'Escape') {
			editing = false;
			input.blur();
		}
	}
</script>

<input
	class="w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-right tabular-nums hover:border-input focus:border-ring focus:outline-none"
	inputmode="decimal"
	autocomplete="off"
	aria-label={label}
	data-testid="assigned"
	value={editing ? text : session.format(assigned)}
	oninput={(e) => (text = e.currentTarget.value)}
	onfocus={focus}
	onblur={commit}
	onkeydown={keydown}
/>
```

Create `src/lib/components/budget/QuickAssignButtons.svelte`:

```svelte
<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { useSession } from '$lib/client/app-state.svelte';
	import { runAction } from '$lib/client/notify';
	import type { Month } from '$lib/domain/month';
	import type { QuickAssignStrategy } from '$lib/domain/quick-assign';
	import { m } from '$lib/paraglide/messages';

	let { categoryIds, month, onDone }: { categoryIds: string[]; month: Month; onDone: () => void } =
		$props();

	const session = useSession();
	let error = $state<string | null>(null);

	const STRATEGIES: { strategy: QuickAssignStrategy; label: () => string }[] = [
		{ strategy: 'last-month', label: m.quick_assign_last_month },
		{ strategy: 'avg-3', label: () => m.quick_assign_average({ months: 3 }) },
		{ strategy: 'avg-6', label: () => m.quick_assign_average({ months: 6 }) },
		{ strategy: 'avg-12', label: () => m.quick_assign_average({ months: 12 }) },
		{ strategy: 'cover-overspending', label: m.quick_assign_cover },
		{ strategy: 'clear', label: m.quick_assign_clear }
	];

	async function apply(strategy: QuickAssignStrategy) {
		error = await runAction(() => session.api.budget.quickAssign({ month, categoryIds, strategy }));
		if (!error) onDone();
	}
</script>

<section class="grid gap-2">
	<h3 class="text-sm font-medium">{m.quick_assign_title()}</h3>
	<div class="grid grid-cols-2 gap-2">
		{#each STRATEGIES as { strategy, label } (strategy)}
			<Button variant="outline" size="sm" onclick={() => apply(strategy)}>{label()}</Button>
		{/each}
	</div>
	{#if error}<p class="text-sm text-destructive" role="alert">{error}</p>{/if}
</section>
```

Create `src/lib/components/budget/CategorySheet.svelte` (Task 11 adds category settings to it):

```svelte
<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { NativeSelect, NativeSelectOption } from '$lib/components/ui/native-select';
	import { Separator } from '$lib/components/ui/separator';
	import ResponsiveDialog from '$lib/components/ResponsiveDialog.svelte';
	import { useSession } from '$lib/client/app-state.svelte';
	import { runAction } from '$lib/client/notify';
	import { moveTargets, type GridModel } from '$lib/budget/view';
	import type { BudgetCategoryView } from '$lib/db/repos/budget';
	import { formatAmountInput } from '$lib/domain/money';
	import type { Month } from '$lib/domain/month';
	import { groupLabel } from '$lib/i18n/labels';
	import { m } from '$lib/paraglide/messages';
	import AvailablePill from './AvailablePill.svelte';
	import QuickAssignButtons from './QuickAssignButtons.svelte';

	let {
		open = $bindable(false),
		category,
		month,
		model
	}: {
		open: boolean;
		category: BudgetCategoryView;
		month: Month;
		model: GridModel;
	} = $props();

	const session = useSession();

	let assignedText = $state('');
	let moveAmount = $state('');
	let moveDirection = $state<'to' | 'from'>('to');
	let otherId = $state('');
	let error = $state<string | null>(null);

	const targets = $derived(moveTargets(model, category.id));

	// Reset the form each time the sheet opens for a category.
	$effect(() => {
		if (!open) return;
		assignedText = formatAmountInput(category.assigned, session.money);
		moveAmount = '';
		otherId = '';
		error = null;
	});

	async function saveAssigned(event: SubmitEvent) {
		event.preventDefault();
		const value = assignedText.trim() === '' ? 0 : session.parse(assignedText);
		if (value === null) {
			error = m.form_error_amount_invalid();
			return;
		}
		error = await runAction(() => session.api.budget.setAssigned(category.id, month, value));
		if (!error) open = false;
	}

	async function move(event: SubmitEvent) {
		event.preventDefault();
		const amount = session.parse(moveAmount);
		if (amount === null || amount <= 0) {
			error = m.form_error_amount_invalid();
			return;
		}
		if (!otherId) {
			error = m.budget_move_choose_category();
			return;
		}
		const [fromCategoryId, toCategoryId] =
			moveDirection === 'to' ? [category.id, otherId] : [otherId, category.id];
		error = await runAction(() =>
			session.api.budget.moveMoney({ fromCategoryId, toCategoryId, month, amount })
		);
		if (!error) open = false;
	}
</script>

<ResponsiveDialog bind:open title={category.name}>
	<div class="grid gap-5">
		<div class="flex items-center justify-between text-sm">
			<span class="text-muted-foreground">{m.budget_available()}</span>
			<AvailablePill {category} />
		</div>

		<form class="grid gap-2" onsubmit={saveAssigned}>
			<Label for="sheet-assigned">{m.budget_assigned_this_month()}</Label>
			<div class="flex gap-2">
				<Input
					id="sheet-assigned"
					bind:value={assignedText}
					inputmode="decimal"
					autocomplete="off"
				/>
				<Button type="submit">{m.save()}</Button>
			</div>
		</form>

		<Separator />

		<form class="grid gap-2" onsubmit={move}>
			<h3 class="text-sm font-medium">{m.budget_move_money()}</h3>
			<div class="grid grid-cols-2 gap-2">
				<Button
					variant={moveDirection === 'to' ? 'secondary' : 'ghost'}
					aria-pressed={moveDirection === 'to'}
					onclick={() => (moveDirection = 'to')}>{m.budget_move_to()}</Button
				>
				<Button
					variant={moveDirection === 'from' ? 'secondary' : 'ghost'}
					aria-pressed={moveDirection === 'from'}
					onclick={() => (moveDirection = 'from')}>{m.budget_move_from()}</Button
				>
			</div>
			<div class="grid grid-cols-[1fr_8rem] gap-2">
				<NativeSelect class="w-full" bind:value={otherId} aria-label={m.budget_move_other()}>
					<NativeSelectOption value="">{m.budget_move_other()}</NativeSelectOption>
					{#each targets as target (target.id)}
						<NativeSelectOption value={target.id}
							>{groupLabel(target.group)} · {target.name}</NativeSelectOption
						>
					{/each}
				</NativeSelect>
				<Input
					bind:value={moveAmount}
					inputmode="decimal"
					autocomplete="off"
					aria-label={m.budget_move_amount()}
					placeholder="0"
				/>
			</div>
			<Button type="submit" variant="outline">{m.budget_move()}</Button>
		</form>

		{#if error}<p class="text-sm text-destructive" role="alert">{error}</p>{/if}

		<Separator />

		<QuickAssignButtons categoryIds={[category.id]} {month} onDone={() => (open = false)} />
	</div>
</ResponsiveDialog>
```

Create `src/lib/components/budget/GroupSheet.svelte` (Task 11 adds group management to it):

```svelte
<script lang="ts">
	import ResponsiveDialog from '$lib/components/ResponsiveDialog.svelte';
	import type { BudgetGroupView } from '$lib/db/repos/budget';
	import type { Month } from '$lib/domain/month';
	import { groupLabel } from '$lib/i18n/labels';
	import QuickAssignButtons from './QuickAssignButtons.svelte';

	let {
		open = $bindable(false),
		group,
		month
	}: { open: boolean; group: BudgetGroupView; month: Month } = $props();
</script>

<ResponsiveDialog bind:open title={groupLabel(group)}>
	<QuickAssignButtons
		categoryIds={group.categories.map((c) => c.id)}
		{month}
		onDone={() => (open = false)}
	/>
</ResponsiveDialog>
```

- [ ] **Step 4: Make the grid and the page interactive**

Replace `src/lib/components/budget/BudgetGrid.svelte`:

```svelte
<script lang="ts">
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import * as Collapsible from '$lib/components/ui/collapsible';
	import { useSession } from '$lib/client/app-state.svelte';
	import type { GridModel } from '$lib/budget/view';
	import type { BudgetCategoryView } from '$lib/db/repos/budget';
	import type { Month } from '$lib/domain/month';
	import { groupLabel } from '$lib/i18n/labels';
	import { m } from '$lib/paraglide/messages';
	import AssignedInput from './AssignedInput.svelte';
	import AvailablePill from './AvailablePill.svelte';

	let {
		model,
		month,
		onSelectCategory,
		onSelectGroup
	}: {
		model: GridModel;
		month: Month;
		onSelectCategory: (id: string) => void;
		onSelectGroup: (id: string) => void;
	} = $props();

	const session = useSession();
	const COLUMNS =
		'grid grid-cols-[1fr_auto_auto] items-center gap-2 md:grid-cols-[1fr_9rem_8rem_9rem]';
</script>

{#snippet categoryRow(category: BudgetCategoryView)}
	<div class="{COLUMNS} border-b px-3 py-1.5" data-testid="category-row">
		<button
			type="button"
			class="truncate text-left hover:underline"
			onclick={() => onSelectCategory(category.id)}>{category.name}</button
		>
		<div class="hidden md:block">
			<AssignedInput
				categoryId={category.id}
				{month}
				assigned={category.assigned}
				label={m.budget_assigned_for({ name: category.name })}
			/>
		</div>
		<span class="text-right text-sm text-muted-foreground tabular-nums" data-testid="activity">
			{session.format(category.activity)}
		</span>
		<span class="text-right"><AvailablePill {category} /></span>
	</div>
{/snippet}

<section aria-label={m.budget_categories()}>
	<div
		class="{COLUMNS} sticky top-0 z-10 border-b bg-background px-3 py-2 text-xs font-medium text-muted-foreground uppercase"
	>
		<span>{m.budget_category()}</span>
		<span class="hidden text-right md:block">{m.budget_assigned()}</span>
		<span class="text-right">{m.budget_activity()}</span>
		<span class="text-right">{m.budget_available()}</span>
	</div>
	{#each model.groups as group (group.id)}
		<div class="{COLUMNS} border-b bg-muted/60 px-3 py-2 font-medium" data-testid="group-row">
			<button
				type="button"
				class="truncate text-left hover:underline"
				onclick={() => onSelectGroup(group.id)}>{groupLabel(group)}</button
			>
			<span class="hidden text-right tabular-nums md:block">{session.format(group.assigned)}</span>
			<span class="text-right text-sm tabular-nums">{session.format(group.activity)}</span>
			<span class="text-right tabular-nums">{session.format(group.available)}</span>
		</div>
		{#each group.categories as category (category.id)}
			{@render categoryRow(category)}
		{/each}
	{/each}
</section>

{#if model.hidden.length > 0}
	<Collapsible.Root class="mt-4">
		<Collapsible.Trigger
			class="group flex items-center gap-1 px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
		>
			<ChevronRightIcon class="size-4 transition-transform group-data-[state=open]:rotate-90" />
			{m.budget_hidden_categories({ count: model.hidden.length })}
		</Collapsible.Trigger>
		<Collapsible.Content>
			{#each model.hidden as { category } (category.id)}
				{@render categoryRow(category)}
			{/each}
		</Collapsible.Content>
	</Collapsible.Root>
{/if}
```

Replace `src/routes/budget/[month]/+page.svelte`:

```svelte
<script lang="ts">
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import * as Alert from '$lib/components/ui/alert';
	import BudgetGrid from '$lib/components/budget/BudgetGrid.svelte';
	import CategorySheet from '$lib/components/budget/CategorySheet.svelte';
	import GroupSheet from '$lib/components/budget/GroupSheet.svelte';
	import MonthPicker from '$lib/components/budget/MonthPicker.svelte';
	import RtaCard from '$lib/components/budget/RtaCard.svelte';
	import { useSession } from '$lib/client/app-state.svelte';
	import { useLive } from '$lib/client/live.svelte';
	import { BUDGET_TABLES, gridModel } from '$lib/budget/view';
	import { errorMessage } from '$lib/i18n/errors';
	import { formatMonthLong } from '$lib/i18n/formats';
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const session = useSession();
	const view = useLive(session.client, BUDGET_TABLES, () => session.api.budget.month(data.month));
	const model = $derived(view.data ? gridModel(view.data) : null);

	let categoryId = $state<string | null>(null);
	let groupId = $state<string | null>(null);
	let categoryOpen = $state(false);
	let groupOpen = $state(false);

	// Look selections up in the live view so sheets show fresh numbers after each write.
	const category = $derived(
		view.data?.groups.flatMap((g) => g.categories).find((c) => c.id === categoryId) ?? null
	);
	const group = $derived(view.data?.groups.find((g) => g.id === groupId) ?? null);
</script>

<div class="mx-auto grid max-w-5xl gap-4 p-3 md:p-6">
	<header class="grid gap-3 md:grid-cols-[1fr_20rem] md:items-center">
		<MonthPicker month={data.month} />
		{#if view.data}<RtaCard view={view.data} />{/if}
	</header>

	{#if view.data?.futureNegativeMonth}
		<Alert.Root variant="destructive">
			<TriangleAlertIcon />
			<Alert.Title>{m.budget_future_negative_title()}</Alert.Title>
			<Alert.Description>
				{m.budget_future_negative_body({
					month: formatMonthLong(view.data.futureNegativeMonth, getLocale())
				})}
			</Alert.Description>
		</Alert.Root>
	{/if}

	{#if view.error && !view.data}
		<p class="text-destructive" role="alert">{errorMessage(view.error)}</p>
	{/if}

	{#if view.data && model}
		<BudgetGrid
			{model}
			month={data.month}
			onSelectCategory={(id) => {
				categoryId = id;
				categoryOpen = true;
			}}
			onSelectGroup={(id) => {
				groupId = id;
				groupOpen = true;
			}}
		/>

		{#if category}
			<CategorySheet bind:open={categoryOpen} {category} month={data.month} {model} />
		{/if}
		{#if group}
			<GroupSheet bind:open={groupOpen} {group} month={data.month} />
		{/if}
	{/if}
</div>

<svelte:head><title>{m.nav_budget()} · {m.app_name()}</title></svelte:head>
```

- [ ] **Step 5: Run the e2e tests to verify they pass**

Run: `pnpm test:e2e`

Expected: PASS (6 tests).

- [ ] **Step 6: Format, check and commit**

```bash
pnpm exec prettier --write src/lib/components/ResponsiveDialog.svelte src/lib/components/budget/AssignedInput.svelte src/lib/components/budget/QuickAssignButtons.svelte src/lib/components/budget/CategorySheet.svelte src/lib/components/budget/GroupSheet.svelte src/lib/components/budget/BudgetGrid.svelte 'src/routes/budget/[month]/+page.svelte' e2e/budget.e2e.ts
```

Run: `pnpm lint && pnpm check`

Expected: Prettier, ESLint and svelte-check report no problems.

Run: `pnpm test`

Expected: every unit test passes.

```bash
git add src/lib/components/ResponsiveDialog.svelte src/lib/components/budget/AssignedInput.svelte src/lib/components/budget/QuickAssignButtons.svelte src/lib/components/budget/CategorySheet.svelte src/lib/components/budget/GroupSheet.svelte src/lib/components/budget/BudgetGrid.svelte 'src/routes/budget/[month]/+page.svelte' e2e/budget.e2e.ts
git commit -m "feat: assign inline, in the category sheet and with quick-assign" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```


---


### Task 11: Category management: settings, groups and order

Everything spec §5 lists for editing the category set:

- **Category settings** (in the category sheet): rename, move to another group, hide, and roll overspending over. Delete, choosing where the category's transactions and money go when it's in use (`REASSIGN_REQUIRED`). Card payment categories follow their card, so only the rollover toggle applies to them.
- **Group sheet:** add a category, rename, hide, delete (`GROUP_NOT_EMPTY` when it has categories). The Credit Card Payments group only offers quick-assign.
- **Add group.**
- **Edit order:** arrow buttons move groups and categories on any device. On desktop, categories can also be dragged (HTML5 drag and drop doesn't fire on touch screens). The Credit Card Payments group stays first, and categories never move into or out of it. Save sends the layout to `saveCategoryOrder`, which pins the system groups anyway (Task 2).

**Files:**
- Create: `src/lib/budget/order.ts`
- Create: `src/lib/components/budget/CategorySettings.svelte`
- Create: `src/lib/components/budget/AddGroupDialog.svelte`
- Create: `src/lib/components/budget/OrderEditor.svelte`
- Create: `src/lib/budget/order.test.ts`
- Modify: `src/lib/components/budget/CategorySheet.svelte`
- Modify: `src/lib/components/budget/GroupSheet.svelte`
- Modify: `src/routes/budget/[month]/+page.svelte`
- Test: `e2e/budget.e2e.ts`

**Interfaces:**
- Consumes: `api.categories.update/delete/create/createGroup/updateGroup/deleteGroup/saveOrder` (Plan 1); `moveTargets`, `GridModel` (Task 9); `ResponsiveDialog`, `QuickAssignButtons` (Task 10).
- Produces:
  - `toLayout(groups): OrderLayout`, `toPayload(layout)`, `moveGroup(layout, groupId, delta)`, `moveCategory(layout, categoryId, delta)`, `dropCategory(layout, categoryId, groupId, index)`. Each returns the same layout object when the move isn't allowed.
  - `<CategorySheet bind:open category month model groups />`, `<CategorySettings category groups model onDone />`, `<AddGroupDialog bind:open />`, `<OrderEditor groups onDone />`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/budget/order.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { dropCategory, moveCategory, moveGroup, toPayload, type OrderLayout } from './order';

const layout: OrderLayout = [
	{
		id: 'cards',
		name: 'Cards',
		system: 'credit_card_payments',
		categories: [{ id: 'visa', name: 'Visa' }]
	},
	{
		id: 'bills',
		name: 'Bills',
		system: null,
		categories: [
			{ id: 'rent', name: 'Rent' },
			{ id: 'power', name: 'Power' }
		]
	},
	{ id: 'fun', name: 'Fun', system: null, categories: [{ id: 'games', name: 'Games' }] }
];

const shape = (l: OrderLayout) =>
	l.map((g) => `${g.id}:${g.categories.map((c) => c.id).join(',')}`);

describe('moveGroup', () => {
	it('swaps user groups', () => {
		expect(shape(moveGroup(layout, 'fun', -1))).toEqual([
			'cards:visa',
			'fun:games',
			'bills:rent,power'
		]);
	});

	it('never moves system groups or moves anything above them', () => {
		expect(moveGroup(layout, 'cards', 1)).toBe(layout);
		expect(moveGroup(layout, 'bills', -1)).toBe(layout);
		expect(moveGroup(layout, 'fun', 1)).toBe(layout);
	});
});

describe('moveCategory', () => {
	it('moves within a group', () => {
		expect(shape(moveCategory(layout, 'power', -1))).toEqual([
			'cards:visa',
			'bills:power,rent',
			'fun:games'
		]);
	});

	it('crosses into the neighbouring user group at the edges', () => {
		expect(shape(moveCategory(layout, 'power', 1))).toEqual([
			'cards:visa',
			'bills:rent',
			'fun:power,games'
		]);
		expect(shape(moveCategory(layout, 'games', -1))).toEqual([
			'cards:visa',
			'bills:rent,power,games',
			'fun:'
		]);
	});

	it('never crosses into or out of a system group', () => {
		expect(moveCategory(layout, 'rent', -1)).toBe(layout);
		expect(moveCategory(layout, 'visa', 1)).toBe(layout);
	});
});

describe('dropCategory', () => {
	it('drops at an index, clamped to the group', () => {
		expect(shape(dropCategory(layout, 'rent', 'fun', 99))).toEqual([
			'cards:visa',
			'bills:power',
			'fun:games,rent'
		]);
		expect(dropCategory(layout, 'rent', 'cards', 0)).toBe(layout);
	});

	it('does not change the original layout', () => {
		dropCategory(layout, 'rent', 'fun', 0);
		expect(shape(layout)).toEqual(['cards:visa', 'bills:rent,power', 'fun:games']);
	});
});

describe('toPayload', () => {
	it('lists group ids with their category ids', () => {
		expect(toPayload(layout)[1]).toEqual({ groupId: 'bills', categoryIds: ['rent', 'power'] });
	});
});
```

Replace `e2e/budget.e2e.ts` (adds the group, category and order test):

```ts
import { expect, test } from '@playwright/test';
import { categoryRow, onboard } from './helpers';

test('shows the month with Ready to Assign and the starter categories', async ({ page }) => {
	await onboard(page);
	await expect(page).toHaveURL(/\/budget\/\d{4}-\d{2}$/);
	await expect(categoryRow(page, 'Groceries').getByTestId('available')).toHaveText('$0.00');
	await page.getByTestId('rta-amount').click();
	await expect(page.getByText('Funds available')).toBeVisible();
});

test('sends invalid months to the current one', async ({ page }) => {
	await onboard(page);
	const current = page.url();
	await page.goto('/budget/9999-01');
	await expect(page).toHaveURL(current);
});

test('assigns inline with arithmetic on desktop', async ({ page }) => {
	await onboard(page);
	const groceries = categoryRow(page, 'Groceries');
	await groceries.getByTestId('assigned').fill('250+50');
	await groceries.getByTestId('assigned').press('Enter');
	await expect(page.getByTestId('rta-amount')).toHaveText('$700.00');
	await expect(groceries.getByTestId('available')).toHaveText('$300.00');
});

test.describe('on a phone', () => {
	test.use({ viewport: { width: 390, height: 844 } });

	test('assigns and moves money from the category sheet', async ({ page }) => {
		await onboard(page);
		await categoryRow(page, 'Groceries').getByRole('button', { name: 'Groceries' }).click();
		const sheet = page.getByRole('dialog');
		await sheet.getByLabel('Assigned this month').fill('120+35');
		await sheet.getByRole('button', { name: 'Save' }).first().click();
		await expect(categoryRow(page, 'Groceries').getByTestId('available')).toHaveText('$155.00');

		await categoryRow(page, 'Groceries').getByRole('button', { name: 'Groceries' }).click();
		await sheet.getByLabel('Other category').selectOption({ label: 'Everyday · Household' });
		await sheet.getByLabel('Amount to move').fill('55');
		await sheet.getByRole('button', { name: 'Move', exact: true }).click();
		await expect(categoryRow(page, 'Groceries').getByTestId('available')).toHaveText('$100.00');
		await expect(categoryRow(page, 'Household').getByTestId('available')).toHaveText('$55.00');
	});
});

test('adds a group and a category, and reorders categories', async ({ page }) => {
	await onboard(page);
	await page.getByRole('button', { name: 'Add group' }).click();
	await page.getByRole('dialog').getByLabel('Group name').fill('Pets');
	await page.getByRole('dialog').getByRole('button', { name: 'Add' }).click();
	await page.getByRole('button', { name: 'Pets' }).click();
	await page.getByRole('dialog').getByLabel('New category').fill('Vet');
	await page.getByRole('dialog').getByRole('button', { name: 'Add', exact: true }).click();
	await page.keyboard.press('Escape');
	await expect(categoryRow(page, 'Vet')).toBeVisible();

	await page.getByRole('button', { name: 'Edit order' }).click();
	await page.getByRole('button', { name: 'Move Household up' }).click();
	await page.getByRole('button', { name: 'Save' }).click();
	// Everyday was Groceries, Transportation, Dining Out, Household (rows 5-8 after Bills' four).
	const names = page.getByTestId('category-row').locator(':scope > button');
	await expect(names.nth(6)).toHaveText('Household');
	await expect(names.nth(7)).toHaveText('Dining Out');
});
```

- [ ] **Step 2: Run the unit test to verify it fails**

Run: `pnpm test src/lib/budget/order.test.ts`

Expected: FAIL. `./order` does not exist.

- [ ] **Step 3: Implement the order logic**

Create `src/lib/budget/order.ts`:

```ts
import type { BudgetGroupView } from '$lib/db/repos/budget';

/** The category order being edited: groups (system ones pinned first) and their categories. */
export interface OrderGroup {
	id: string;
	name: string;
	system: BudgetGroupView['system'];
	categories: { id: string; name: string }[];
}

export type OrderLayout = OrderGroup[];

export function toLayout(groups: BudgetGroupView[]): OrderLayout {
	return groups.map((g) => ({
		id: g.id,
		name: g.name,
		system: g.system,
		categories: g.categories.map((c) => ({ id: c.id, name: c.name }))
	}));
}

/** What saveCategoryOrder expects. */
export function toPayload(layout: OrderLayout): { groupId: string; categoryIds: string[] }[] {
	return layout.map((g) => ({ groupId: g.id, categoryIds: g.categories.map((c) => c.id) }));
}

/** Moves a user group up or down among user groups. System groups never move. */
export function moveGroup(layout: OrderLayout, groupId: string, delta: -1 | 1): OrderLayout {
	const from = layout.findIndex((g) => g.id === groupId);
	const to = from + delta;
	if (from === -1 || layout[from].system || !layout[to] || layout[to].system) return layout;
	const next = [...layout];
	[next[from], next[to]] = [next[to], next[from]];
	return next;
}

function locate(layout: OrderLayout, categoryId: string): [number, number] {
	for (let gi = 0; gi < layout.length; gi++) {
		const ci = layout[gi].categories.findIndex((c) => c.id === categoryId);
		if (ci !== -1) return [gi, ci];
	}
	return [-1, -1];
}

/**
 * Places a category at `index` in group `groupId`. Categories never enter or leave a system group,
 * so such moves return the layout unchanged.
 */
export function dropCategory(
	layout: OrderLayout,
	categoryId: string,
	groupId: string,
	index: number
): OrderLayout {
	const [gi, ci] = locate(layout, categoryId);
	const target = layout.findIndex((g) => g.id === groupId);
	if (gi === -1 || target === -1) return layout;
	if (gi !== target && (layout[gi].system || layout[target].system)) return layout;
	const next = layout.map((g) => ({ ...g, categories: [...g.categories] }));
	const [moved] = next[gi].categories.splice(ci, 1);
	const clamped = Math.max(0, Math.min(index, next[target].categories.length));
	next[target].categories.splice(clamped, 0, moved);
	return next;
}

/**
 * Moves a category one step. Past the top or bottom of its group it goes to the end of the
 * previous user group or the start of the next one.
 */
export function moveCategory(layout: OrderLayout, categoryId: string, delta: -1 | 1): OrderLayout {
	const [gi, ci] = locate(layout, categoryId);
	if (gi === -1) return layout;
	const group = layout[gi];
	const index = ci + delta;
	if (index >= 0 && index < group.categories.length)
		return dropCategory(layout, categoryId, group.id, index);
	const neighbor = layout[gi + delta];
	if (!neighbor || neighbor.system || group.system) return layout;
	return dropCategory(
		layout,
		categoryId,
		neighbor.id,
		delta === -1 ? neighbor.categories.length : 0
	);
}
```

- [ ] **Step 4: Run the unit test to verify it passes**

Run: `pnpm test src/lib/budget`

Expected: PASS.

- [ ] **Step 5: Add the management components**

Create `src/lib/components/budget/CategorySettings.svelte`:

```svelte
<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { NativeSelect, NativeSelectOption } from '$lib/components/ui/native-select';
	import { Switch } from '$lib/components/ui/switch';
	import { useSession } from '$lib/client/app-state.svelte';
	import { runAction } from '$lib/client/notify';
	import { moveTargets, type GridModel } from '$lib/budget/view';
	import type { BudgetCategoryView, BudgetGroupView } from '$lib/db/repos/budget';
	import { groupLabel } from '$lib/i18n/labels';
	import { m } from '$lib/paraglide/messages';

	let {
		category,
		groups,
		model,
		onDone
	}: {
		category: BudgetCategoryView;
		groups: BudgetGroupView[];
		model: GridModel;
		onDone: () => void;
	} = $props();

	const session = useSession();
	// Card payment categories follow their card: only the rollover toggle applies to them.
	const isCardPayment = $derived(category.ccAccountId !== null);
	const userGroups = $derived(groups.filter((g) => !g.system));
	const currentGroupId = $derived(
		groups.find((g) => g.categories.some((c) => c.id === category.id))?.id ?? ''
	);

	let name = $state('');
	let groupId = $state('');
	let hidden = $state(false);
	let carryover = $state(false);
	let reassignTo = $state('');
	let confirmDelete = $state(false);
	let error = $state<string | null>(null);

	$effect(() => {
		name = category.name;
		groupId = currentGroupId;
		hidden = category.hidden;
		carryover = category.carryoverOverspending;
		reassignTo = '';
		confirmDelete = false;
		error = null;
	});

	async function save(event: SubmitEvent) {
		event.preventDefault();
		const patch = isCardPayment
			? { carryoverOverspending: carryover }
			: { name, groupId, hidden, carryoverOverspending: carryover };
		error = await runAction(() => session.api.categories.update(category.id, patch));
		if (!error) onDone();
	}

	async function remove() {
		if (!confirmDelete) {
			confirmDelete = true;
			return;
		}
		error = await runAction(() =>
			session.api.categories.delete(category.id, reassignTo || undefined)
		);
		if (!error) onDone();
	}
</script>

<form class="grid gap-3" onsubmit={save}>
	<h3 class="text-sm font-medium">{m.category_settings()}</h3>
	{#if isCardPayment}
		<p class="text-xs text-muted-foreground">{m.category_card_payment_note()}</p>
	{:else}
		<div class="grid gap-2">
			<Label for="category-name">{m.category_name()}</Label>
			<Input id="category-name" bind:value={name} required autocomplete="off" />
		</div>
		<div class="grid gap-2">
			<Label for="category-group">{m.category_group()}</Label>
			<NativeSelect id="category-group" class="w-full" bind:value={groupId}>
				{#each userGroups as group (group.id)}
					<NativeSelectOption value={group.id}>{groupLabel(group)}</NativeSelectOption>
				{/each}
			</NativeSelect>
		</div>
		<div class="flex items-center justify-between gap-4">
			<Label for="category-hidden">{m.category_hidden()}</Label>
			<Switch id="category-hidden" bind:checked={hidden} />
		</div>
	{/if}
	<div class="flex items-center justify-between gap-4">
		<div class="grid gap-1">
			<Label for="category-carryover">{m.category_carryover()}</Label>
			<p class="text-xs text-muted-foreground">{m.category_carryover_hint()}</p>
		</div>
		<Switch id="category-carryover" bind:checked={carryover} />
	</div>
	<Button type="submit" variant="outline">{m.save()}</Button>
</form>

{#if !isCardPayment}
	<div class="grid gap-2">
		<Label for="category-reassign">{m.category_delete_reassign()}</Label>
		<NativeSelect id="category-reassign" class="w-full" bind:value={reassignTo}>
			<NativeSelectOption value="">{m.category_delete_no_reassign()}</NativeSelectOption>
			{#each moveTargets(model, category.id).filter((t) => !t.group.system) as target (target.id)}
				<NativeSelectOption value={target.id}
					>{target.group.name} · {target.name}</NativeSelectOption
				>
			{/each}
		</NativeSelect>
		<Button variant="destructive" onclick={remove}>
			{confirmDelete ? m.confirm_delete() : m.category_delete()}
		</Button>
	</div>
{/if}

{#if error}<p class="text-sm text-destructive" role="alert">{error}</p>{/if}
```

Create `src/lib/components/budget/AddGroupDialog.svelte`:

```svelte
<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import ResponsiveDialog from '$lib/components/ResponsiveDialog.svelte';
	import { useSession } from '$lib/client/app-state.svelte';
	import { runAction } from '$lib/client/notify';
	import { m } from '$lib/paraglide/messages';

	let { open = $bindable(false) }: { open: boolean } = $props();
	const session = useSession();
	let name = $state('');
	let error = $state<string | null>(null);

	$effect(() => {
		if (open) {
			name = '';
			error = null;
		}
	});

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		error = await runAction(() => session.api.categories.createGroup({ name }));
		if (!error) open = false;
	}
</script>

<ResponsiveDialog bind:open title={m.budget_add_group()}>
	<form class="grid gap-3" onsubmit={submit}>
		<div class="grid gap-2">
			<Label for="new-group-name">{m.group_name()}</Label>
			<Input id="new-group-name" bind:value={name} required autocomplete="off" />
		</div>
		{#if error}<p class="text-sm text-destructive" role="alert">{error}</p>{/if}
		<Button type="submit">{m.add()}</Button>
	</form>
</ResponsiveDialog>
```

Create `src/lib/components/budget/OrderEditor.svelte`:

```svelte
<script lang="ts">
	import ArrowDownIcon from '@lucide/svelte/icons/arrow-down';
	import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
	import GripVerticalIcon from '@lucide/svelte/icons/grip-vertical';
	import { Button } from '$lib/components/ui/button';
	import { useSession } from '$lib/client/app-state.svelte';
	import { runAction } from '$lib/client/notify';
	import {
		dropCategory,
		moveCategory,
		moveGroup,
		toLayout,
		toPayload,
		type OrderLayout
	} from '$lib/budget/order';
	import type { BudgetGroupView } from '$lib/db/repos/budget';
	import { groupLabel } from '$lib/i18n/labels';
	import { m } from '$lib/paraglide/messages';

	/**
	 * "Edit order" mode. Arrow buttons work everywhere (the phone path); on desktop, categories
	 * can also be dragged with the mouse (HTML5 drag and drop does not fire on touch screens).
	 */
	let { groups, onDone }: { groups: BudgetGroupView[]; onDone: () => void } = $props();

	const session = useSession();
	// The editor starts from the order at the moment it opens.
	// svelte-ignore state_referenced_locally
	let layout = $state<OrderLayout>(toLayout(groups));
	let dragging = $state<string | null>(null);
	let error = $state<string | null>(null);

	function drop(event: DragEvent, groupId: string, index: number) {
		event.preventDefault();
		if (dragging) layout = dropCategory(layout, dragging, groupId, index);
		dragging = null;
	}

	async function save() {
		error = await runAction(() => session.api.categories.saveOrder(toPayload(layout)));
		if (!error) onDone();
	}
</script>

<div class="grid gap-3 p-3">
	<div class="flex items-center justify-between gap-2">
		<p class="text-sm text-muted-foreground">{m.order_hint()}</p>
		<div class="flex gap-2">
			<Button variant="ghost" onclick={onDone}>{m.cancel()}</Button>
			<Button onclick={save}>{m.save()}</Button>
		</div>
	</div>
	{#if error}<p class="text-sm text-destructive" role="alert">{error}</p>{/if}
	{#each layout as group, gi (group.id)}
		<section
			class="rounded-lg border"
			aria-label={groupLabel(group)}
			ondragover={(e) => e.preventDefault()}
			ondrop={(e) => drop(e, group.id, group.categories.length)}
		>
			<div class="flex items-center gap-2 bg-muted/60 px-3 py-2 font-medium">
				<span class="flex-1 truncate">{groupLabel(group)}</span>
				{#if !group.system}
					<Button
						variant="ghost"
						size="icon-sm"
						aria-label={m.order_move_up({ name: group.name })}
						disabled={gi === 0 || layout[gi - 1].system !== null}
						onclick={() => (layout = moveGroup(layout, group.id, -1))}><ArrowUpIcon /></Button
					>
					<Button
						variant="ghost"
						size="icon-sm"
						aria-label={m.order_move_down({ name: group.name })}
						disabled={gi === layout.length - 1}
						onclick={() => (layout = moveGroup(layout, group.id, 1))}><ArrowDownIcon /></Button
					>
				{/if}
			</div>
			{#each group.categories as category, ci (category.id)}
				<div
					class="flex items-center gap-2 border-t px-3 py-1.5 {dragging === category.id
						? 'opacity-50'
						: ''}"
					role="listitem"
					draggable={!group.system}
					ondragstart={(e) => {
						dragging = category.id;
						e.dataTransfer?.setData('text/plain', category.id);
					}}
					ondragend={() => (dragging = null)}
					ondragover={(e) => e.preventDefault()}
					ondrop={(e) => {
						e.stopPropagation();
						drop(e, group.id, ci);
					}}
				>
					{#if !group.system}
						<GripVerticalIcon class="hidden size-4 cursor-grab text-muted-foreground md:block" />
					{/if}
					<span class="flex-1 truncate">{category.name}</span>
					{#if !group.system}
						<Button
							variant="ghost"
							size="icon-sm"
							aria-label={m.order_move_up({ name: category.name })}
							onclick={() => (layout = moveCategory(layout, category.id, -1))}
							><ArrowUpIcon /></Button
						>
						<Button
							variant="ghost"
							size="icon-sm"
							aria-label={m.order_move_down({ name: category.name })}
							onclick={() => (layout = moveCategory(layout, category.id, 1))}
							><ArrowDownIcon /></Button
						>
					{/if}
				</div>
			{/each}
		</section>
	{/each}
</div>
```

Replace `src/lib/components/budget/CategorySheet.svelte` (takes `groups` and shows the settings):

```svelte
<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { NativeSelect, NativeSelectOption } from '$lib/components/ui/native-select';
	import { Separator } from '$lib/components/ui/separator';
	import ResponsiveDialog from '$lib/components/ResponsiveDialog.svelte';
	import { useSession } from '$lib/client/app-state.svelte';
	import { runAction } from '$lib/client/notify';
	import { moveTargets, type GridModel } from '$lib/budget/view';
	import type { BudgetCategoryView, BudgetGroupView } from '$lib/db/repos/budget';
	import { formatAmountInput } from '$lib/domain/money';
	import type { Month } from '$lib/domain/month';
	import { groupLabel } from '$lib/i18n/labels';
	import { m } from '$lib/paraglide/messages';
	import AvailablePill from './AvailablePill.svelte';
	import CategorySettings from './CategorySettings.svelte';
	import QuickAssignButtons from './QuickAssignButtons.svelte';

	let {
		open = $bindable(false),
		category,
		month,
		model,
		groups
	}: {
		open: boolean;
		category: BudgetCategoryView;
		month: Month;
		model: GridModel;
		groups: BudgetGroupView[];
	} = $props();

	const session = useSession();

	let assignedText = $state('');
	let moveAmount = $state('');
	let moveDirection = $state<'to' | 'from'>('to');
	let otherId = $state('');
	let error = $state<string | null>(null);

	const targets = $derived(moveTargets(model, category.id));

	// Reset the form each time the sheet opens for a category.
	$effect(() => {
		if (!open) return;
		assignedText = formatAmountInput(category.assigned, session.money);
		moveAmount = '';
		otherId = '';
		error = null;
	});

	async function saveAssigned(event: SubmitEvent) {
		event.preventDefault();
		const value = assignedText.trim() === '' ? 0 : session.parse(assignedText);
		if (value === null) {
			error = m.form_error_amount_invalid();
			return;
		}
		error = await runAction(() => session.api.budget.setAssigned(category.id, month, value));
		if (!error) open = false;
	}

	async function move(event: SubmitEvent) {
		event.preventDefault();
		const amount = session.parse(moveAmount);
		if (amount === null || amount <= 0) {
			error = m.form_error_amount_invalid();
			return;
		}
		if (!otherId) {
			error = m.budget_move_choose_category();
			return;
		}
		const [fromCategoryId, toCategoryId] =
			moveDirection === 'to' ? [category.id, otherId] : [otherId, category.id];
		error = await runAction(() =>
			session.api.budget.moveMoney({ fromCategoryId, toCategoryId, month, amount })
		);
		if (!error) open = false;
	}
</script>

<ResponsiveDialog bind:open title={category.name}>
	<div class="grid gap-5">
		<div class="flex items-center justify-between text-sm">
			<span class="text-muted-foreground">{m.budget_available()}</span>
			<AvailablePill {category} />
		</div>

		<form class="grid gap-2" onsubmit={saveAssigned}>
			<Label for="sheet-assigned">{m.budget_assigned_this_month()}</Label>
			<div class="flex gap-2">
				<Input
					id="sheet-assigned"
					bind:value={assignedText}
					inputmode="decimal"
					autocomplete="off"
				/>
				<Button type="submit">{m.save()}</Button>
			</div>
		</form>

		<Separator />

		<form class="grid gap-2" onsubmit={move}>
			<h3 class="text-sm font-medium">{m.budget_move_money()}</h3>
			<div class="grid grid-cols-2 gap-2">
				<Button
					variant={moveDirection === 'to' ? 'secondary' : 'ghost'}
					aria-pressed={moveDirection === 'to'}
					onclick={() => (moveDirection = 'to')}>{m.budget_move_to()}</Button
				>
				<Button
					variant={moveDirection === 'from' ? 'secondary' : 'ghost'}
					aria-pressed={moveDirection === 'from'}
					onclick={() => (moveDirection = 'from')}>{m.budget_move_from()}</Button
				>
			</div>
			<div class="grid grid-cols-[1fr_8rem] gap-2">
				<NativeSelect class="w-full" bind:value={otherId} aria-label={m.budget_move_other()}>
					<NativeSelectOption value="">{m.budget_move_other()}</NativeSelectOption>
					{#each targets as target (target.id)}
						<NativeSelectOption value={target.id}
							>{groupLabel(target.group)} · {target.name}</NativeSelectOption
						>
					{/each}
				</NativeSelect>
				<Input
					bind:value={moveAmount}
					inputmode="decimal"
					autocomplete="off"
					aria-label={m.budget_move_amount()}
					placeholder="0"
				/>
			</div>
			<Button type="submit" variant="outline">{m.budget_move()}</Button>
		</form>

		{#if error}<p class="text-sm text-destructive" role="alert">{error}</p>{/if}

		<Separator />

		<QuickAssignButtons categoryIds={[category.id]} {month} onDone={() => (open = false)} />

		<Separator />

		<CategorySettings {category} {groups} {model} onDone={() => (open = false)} />
	</div>
</ResponsiveDialog>
```

Replace `src/lib/components/budget/GroupSheet.svelte`:

```svelte
<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Separator } from '$lib/components/ui/separator';
	import { Switch } from '$lib/components/ui/switch';
	import ResponsiveDialog from '$lib/components/ResponsiveDialog.svelte';
	import { useSession } from '$lib/client/app-state.svelte';
	import { runAction } from '$lib/client/notify';
	import type { BudgetGroupView } from '$lib/db/repos/budget';
	import type { Month } from '$lib/domain/month';
	import { groupLabel } from '$lib/i18n/labels';
	import { m } from '$lib/paraglide/messages';
	import QuickAssignButtons from './QuickAssignButtons.svelte';

	let {
		open = $bindable(false),
		group,
		month
	}: { open: boolean; group: BudgetGroupView; month: Month } = $props();

	const session = useSession();
	let name = $state('');
	let hidden = $state(false);
	let newCategory = $state('');
	let error = $state<string | null>(null);

	$effect(() => {
		if (!open) return;
		name = group.name;
		hidden = group.hidden;
		newCategory = '';
		error = null;
	});

	async function addCategory(event: SubmitEvent) {
		event.preventDefault();
		error = await runAction(() =>
			session.api.categories.create({ groupId: group.id, name: newCategory })
		);
		if (!error) newCategory = '';
	}

	async function save(event: SubmitEvent) {
		event.preventDefault();
		error = await runAction(() => session.api.categories.updateGroup(group.id, { name, hidden }));
		if (!error) open = false;
	}

	async function remove() {
		error = await runAction(() => session.api.categories.deleteGroup(group.id));
		if (!error) open = false;
	}
</script>

<ResponsiveDialog bind:open title={groupLabel(group)}>
	<div class="grid gap-5">
		<QuickAssignButtons
			categoryIds={group.categories.map((c) => c.id)}
			{month}
			onDone={() => (open = false)}
		/>

		{#if group.system}
			<p class="text-xs text-muted-foreground">{m.group_system_note()}</p>
		{:else}
			<Separator />
			<form class="grid gap-2" onsubmit={addCategory}>
				<Label for="group-new-category">{m.group_add_category()}</Label>
				<div class="flex gap-2">
					<Input id="group-new-category" bind:value={newCategory} required autocomplete="off" />
					<Button type="submit" variant="outline">{m.add()}</Button>
				</div>
			</form>
			<Separator />
			<form class="grid gap-3" onsubmit={save}>
				<h3 class="text-sm font-medium">{m.group_settings()}</h3>
				<div class="grid gap-2">
					<Label for="group-name">{m.group_name()}</Label>
					<Input id="group-name" bind:value={name} required autocomplete="off" />
				</div>
				<div class="flex items-center justify-between gap-4">
					<Label for="group-hidden">{m.group_hidden()}</Label>
					<Switch id="group-hidden" bind:checked={hidden} />
				</div>
				<Button type="submit" variant="outline">{m.save()}</Button>
			</form>
			<Button variant="destructive" onclick={remove}>{m.group_delete()}</Button>
		{/if}

		{#if error}<p class="text-sm text-destructive" role="alert">{error}</p>{/if}
	</div>
</ResponsiveDialog>
```

Replace `src/routes/budget/[month]/+page.svelte`:

```svelte
<script lang="ts">
	import ArrowUpDownIcon from '@lucide/svelte/icons/arrow-up-down';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import * as Alert from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';
	import AddGroupDialog from '$lib/components/budget/AddGroupDialog.svelte';
	import BudgetGrid from '$lib/components/budget/BudgetGrid.svelte';
	import CategorySheet from '$lib/components/budget/CategorySheet.svelte';
	import GroupSheet from '$lib/components/budget/GroupSheet.svelte';
	import MonthPicker from '$lib/components/budget/MonthPicker.svelte';
	import OrderEditor from '$lib/components/budget/OrderEditor.svelte';
	import RtaCard from '$lib/components/budget/RtaCard.svelte';
	import { useSession } from '$lib/client/app-state.svelte';
	import { useLive } from '$lib/client/live.svelte';
	import { BUDGET_TABLES, gridModel } from '$lib/budget/view';
	import { errorMessage } from '$lib/i18n/errors';
	import { formatMonthLong } from '$lib/i18n/formats';
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const session = useSession();
	const view = useLive(session.client, BUDGET_TABLES, () => session.api.budget.month(data.month));
	const model = $derived(view.data ? gridModel(view.data) : null);

	let categoryId = $state<string | null>(null);
	let groupId = $state<string | null>(null);
	let categoryOpen = $state(false);
	let groupOpen = $state(false);
	let addingGroup = $state(false);
	let editingOrder = $state(false);

	// Look selections up in the live view so sheets show fresh numbers after each write.
	const category = $derived(
		view.data?.groups.flatMap((g) => g.categories).find((c) => c.id === categoryId) ?? null
	);
	const group = $derived(view.data?.groups.find((g) => g.id === groupId) ?? null);
</script>

<div class="mx-auto grid max-w-5xl gap-4 p-3 md:p-6">
	<header class="grid gap-3 md:grid-cols-[1fr_20rem] md:items-center">
		<MonthPicker month={data.month} />
		{#if view.data}<RtaCard view={view.data} />{/if}
	</header>

	{#if view.data?.futureNegativeMonth}
		<Alert.Root variant="destructive">
			<TriangleAlertIcon />
			<Alert.Title>{m.budget_future_negative_title()}</Alert.Title>
			<Alert.Description>
				{m.budget_future_negative_body({
					month: formatMonthLong(view.data.futureNegativeMonth, getLocale())
				})}
			</Alert.Description>
		</Alert.Root>
	{/if}

	{#if view.error && !view.data}
		<p class="text-destructive" role="alert">{errorMessage(view.error)}</p>
	{/if}

	{#if view.data && model}
		{#if editingOrder}
			<OrderEditor groups={view.data.groups} onDone={() => (editingOrder = false)} />
		{:else}
			<div class="flex justify-end gap-2">
				<Button variant="outline" size="sm" onclick={() => (addingGroup = true)}>
					<PlusIcon />
					{m.budget_add_group()}
				</Button>
				<Button variant="outline" size="sm" onclick={() => (editingOrder = true)}>
					<ArrowUpDownIcon />
					{m.budget_edit_order()}
				</Button>
			</div>
			<BudgetGrid
				{model}
				month={data.month}
				onSelectCategory={(id) => {
					categoryId = id;
					categoryOpen = true;
				}}
				onSelectGroup={(id) => {
					groupId = id;
					groupOpen = true;
				}}
			/>
		{/if}

		{#if category}
			<CategorySheet
				bind:open={categoryOpen}
				{category}
				month={data.month}
				{model}
				groups={view.data.groups}
			/>
		{/if}
		{#if group}
			<GroupSheet bind:open={groupOpen} {group} month={data.month} />
		{/if}
	{/if}
</div>

<AddGroupDialog bind:open={addingGroup} />
<svelte:head><title>{m.nav_budget()} · {m.app_name()}</title></svelte:head>
```

- [ ] **Step 6: Run the e2e tests to verify they pass**

Run: `pnpm test:e2e`

Expected: PASS (7 tests).

- [ ] **Step 7: Format, check and commit**

```bash
pnpm exec prettier --write src/lib/budget/order.ts src/lib/components/budget/CategorySettings.svelte src/lib/components/budget/AddGroupDialog.svelte src/lib/components/budget/OrderEditor.svelte src/lib/budget/order.test.ts src/lib/components/budget/CategorySheet.svelte src/lib/components/budget/GroupSheet.svelte 'src/routes/budget/[month]/+page.svelte' e2e/budget.e2e.ts
```

Run: `pnpm lint && pnpm check`

Expected: Prettier, ESLint and svelte-check report no problems.

Run: `pnpm test`

Expected: every unit test passes.

```bash
git add src/lib/budget/order.ts src/lib/components/budget/CategorySettings.svelte src/lib/components/budget/AddGroupDialog.svelte src/lib/components/budget/OrderEditor.svelte src/lib/budget/order.test.ts src/lib/components/budget/CategorySheet.svelte src/lib/components/budget/GroupSheet.svelte 'src/routes/budget/[month]/+page.svelte' e2e/budget.e2e.ts
git commit -m "feat: manage categories and groups, and edit their order" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```


---


### Task 12: Account register

The register at `/accounts/[id]` (spec §5) shows date, payee, category, memo, amount and a cleared toggle, with the cleared, uncleared and total balances on top. It has text search (debounced 250 ms) and a date-range filter. Split rows expand to show their lines.

Transfers store no payee (Plan 1 follow-up ruling). They show as "Transfer to ‹account›" for money going out and "Transfer from ‹account›" for money coming in, with a link to that account. The "Starting Balance" payee and the Ready to Assign category are translated.

Spec §5 asks for a virtualized list. The register instead loads 100 rows at a time ("Load more") and marks rows `content-visibility: auto`, so the browser skips rendering off-screen rows. At personal-finance scale that keeps it fast without a virtualization library. Nothing links here yet: the sidebar and the accounts page arrive in Task 13, which also adds the register's e2e test. Editing rows arrives with the transaction form (Task 15).

**Files:**
- Create: `src/lib/accounts/register.ts`
- Create: `src/lib/components/accounts/RegisterRow.svelte`
- Create: `src/routes/accounts/[id]/+page.svelte`
- Test: `src/lib/accounts/register.test.ts`

**Interfaces:**
- Consumes: `api.accounts.get`, `api.transactions.list/setCleared`, `TransactionRow` (Plan 1); `useLive` (Task 9); `formatDate`, `storedCategoryLabel` (Task 4).
- Produces:
  - `payeeDisplay(row): PayeeDisplay` (`transfer` with `direction: 'to' | 'from'`, `starting-balance`, `payee`, `none`), `registerBalances(account): { cleared; uncleared; total }`, `PAGE_SIZE = 100`, `STARTING_BALANCE_PAYEE`
  - `<RegisterRow row onEdit? />`, with test ids `register-row` and `register-amount`; page test ids `register-title` and `register-balance`

- [ ] **Step 1: Write the failing test**

Create `src/lib/accounts/register.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { payeeDisplay, registerBalances } from './register';

const row = { amount: -500, payeeName: null, transferAccountId: null, transferAccountName: null };

describe('payeeDisplay', () => {
	it('shows transfers by direction and other account', () => {
		const transfer = { ...row, transferAccountId: 'sav', transferAccountName: 'Savings' };
		expect(payeeDisplay(transfer)).toEqual({
			kind: 'transfer',
			direction: 'to',
			accountId: 'sav',
			accountName: 'Savings'
		});
		expect(payeeDisplay({ ...transfer, amount: 500 })).toMatchObject({ direction: 'from' });
	});

	it('recognizes starting balances, payees and blanks', () => {
		expect(payeeDisplay({ ...row, payeeName: 'Starting Balance' })).toEqual({
			kind: 'starting-balance'
		});
		expect(payeeDisplay({ ...row, payeeName: 'Mercado' })).toEqual({
			kind: 'payee',
			name: 'Mercado'
		});
		expect(payeeDisplay(row)).toEqual({ kind: 'none' });
	});
});

describe('registerBalances', () => {
	it('derives the uncleared balance', () => {
		expect(registerBalances({ balance: 1000, clearedBalance: 700 })).toEqual({
			cleared: 700,
			uncleared: 300,
			total: 1000
		});
	});
});
```

- [ ] **Step 2: Run the unit test to verify it fails**

Run: `pnpm test src/lib/accounts/register.test.ts`

Expected: FAIL. `./register` does not exist.

- [ ] **Step 3: Implement the register helpers**

Create `src/lib/accounts/register.ts`:

```ts
import type { Account } from '$lib/db/repos/accounts';
import type { TransactionRow } from '$lib/db/repos/transactions';

/** The payee the repos write for starting balances (stored in English, shown translated). */
export const STARTING_BALANCE_PAYEE = 'Starting Balance';

export type PayeeDisplay =
	| { kind: 'transfer'; direction: 'to' | 'from'; accountId: string; accountName: string }
	| { kind: 'starting-balance' }
	| { kind: 'payee'; name: string }
	| { kind: 'none' };

/** Transfers store no payee: they show as "Transfer to/from ‹account›", linking to the other leg. */
export function payeeDisplay(
	row: Pick<TransactionRow, 'amount' | 'payeeName' | 'transferAccountId' | 'transferAccountName'>
): PayeeDisplay {
	if (row.transferAccountId && row.transferAccountName)
		return {
			kind: 'transfer',
			direction: row.amount < 0 ? 'to' : 'from',
			accountId: row.transferAccountId,
			accountName: row.transferAccountName
		};
	if (row.payeeName === STARTING_BALANCE_PAYEE) return { kind: 'starting-balance' };
	return row.payeeName ? { kind: 'payee', name: row.payeeName } : { kind: 'none' };
}

export interface RegisterBalances {
	cleared: number;
	uncleared: number;
	total: number;
}

export function registerBalances(
	account: Pick<Account, 'balance' | 'clearedBalance'>
): RegisterBalances {
	return {
		cleared: account.clearedBalance,
		uncleared: account.balance - account.clearedBalance,
		total: account.balance
	};
}

/** How many rows the register loads at a time. */
export const PAGE_SIZE = 100;
```

- [ ] **Step 4: Run the unit test to verify it passes**

Run: `pnpm test src/lib/accounts`

Expected: PASS.

- [ ] **Step 5: Add the register page**

Create `src/lib/components/accounts/RegisterRow.svelte`:

```svelte
<script lang="ts">
	import { resolve } from '$app/paths';
	import CheckIcon from '@lucide/svelte/icons/check';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import { payeeDisplay } from '$lib/accounts/register';
	import { useSession } from '$lib/client/app-state.svelte';
	import { runAction } from '$lib/client/notify';
	import type { TransactionRow } from '$lib/db/repos/transactions';
	import { formatDate } from '$lib/i18n/formats';
	import { storedCategoryLabel } from '$lib/i18n/labels';
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';
	import { toast } from 'svelte-sonner';

	let { row, onEdit }: { row: TransactionRow; onEdit?: (row: TransactionRow) => void } = $props();

	const session = useSession();
	const payee = $derived(payeeDisplay(row));
	let expanded = $state(false);

	async function toggleCleared() {
		const error = await runAction(() => session.api.transactions.setCleared(row.id, !row.cleared));
		if (error) toast.error(error);
	}
</script>

<div
	class="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 border-b px-3 py-2 [contain-intrinsic-size:auto_3.5rem] [content-visibility:auto] md:grid-cols-[7rem_1fr_1fr_1fr_8rem_auto]"
	data-testid="register-row"
>
	<span
		class="order-3 col-span-2 text-xs text-muted-foreground md:order-none md:col-span-1 md:text-sm"
	>
		{formatDate(row.date, getLocale())}
	</span>
	{#snippet payeeText()}
		{#if payee.kind === 'transfer'}
			{payee.direction === 'to'
				? m.register_transfer_to({ account: payee.accountName })
				: m.register_transfer_from({ account: payee.accountName })}
		{:else if payee.kind === 'starting-balance'}
			{m.register_starting_balance()}
		{:else if payee.kind === 'payee'}
			{payee.name}
		{:else}
			<span class="text-muted-foreground">{m.register_no_payee()}</span>
		{/if}
	{/snippet}
	{#if onEdit}
		<button
			type="button"
			class="min-w-0 truncate text-left font-medium hover:underline"
			onclick={() => onEdit(row)}>{@render payeeText()}</button
		>
	{:else}
		<span class="min-w-0 truncate font-medium">{@render payeeText()}</span>
	{/if}
	<span class="order-4 hidden min-w-0 truncate text-sm md:order-none md:block">
		{#if row.isSplit}
			<button
				type="button"
				class="inline-flex items-center gap-1 hover:underline"
				aria-expanded={expanded}
				onclick={() => (expanded = !expanded)}
			>
				<ChevronRightIcon class="size-3 transition-transform {expanded ? 'rotate-90' : ''}" />
				{m.register_split({ count: row.splits.length })}
			</button>
		{:else if row.categoryName}
			{storedCategoryLabel(row.categoryName)}
		{/if}
	</span>
	<span class="hidden min-w-0 truncate text-sm text-muted-foreground md:block">{row.memo}</span>
	<span
		class="text-right font-medium tabular-nums {row.amount < 0
			? ''
			: 'text-emerald-700 dark:text-emerald-400'}"
		data-testid="register-amount">{session.format(row.amount)}</span
	>
	<button
		type="button"
		class="flex size-6 items-center justify-center rounded-full border {row.cleared
			? 'border-emerald-600 bg-emerald-600 text-white'
			: 'text-transparent'}"
		aria-pressed={row.cleared}
		aria-label={m.register_cleared()}
		onclick={toggleCleared}
	>
		<CheckIcon class="size-4" />
	</button>
	{#if payee.kind === 'transfer'}
		<a
			class="order-5 col-span-full text-xs text-muted-foreground underline md:col-start-2"
			href={resolve('/accounts/[id]', { id: payee.accountId })}
		>
			{m.register_open_account({ account: payee.accountName })}
		</a>
	{/if}
	{#if row.isSplit && expanded}
		<ul class="order-6 col-span-full grid gap-1 py-1 text-sm md:col-start-3">
			{#each row.splits as split (split.id)}
				<li class="flex justify-between gap-2">
					<span class="truncate">
						{storedCategoryLabel(split.categoryName)}
						{#if split.memo}<span class="text-muted-foreground"> · {split.memo}</span>{/if}
					</span>
					<span class="tabular-nums">{session.format(split.amount)}</span>
				</li>
			{/each}
		</ul>
	{/if}
</div>
```

Create `src/routes/accounts/[id]/+page.svelte` (Task 15 adds adding and editing transactions):

```svelte
<script lang="ts">
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import RegisterRow from '$lib/components/accounts/RegisterRow.svelte';
	import { PAGE_SIZE, registerBalances } from '$lib/accounts/register';
	import { useSession } from '$lib/client/app-state.svelte';
	import { useLive } from '$lib/client/live.svelte';
	import { errorMessage } from '$lib/i18n/errors';
	import { m } from '$lib/paraglide/messages';

	const accountId = $derived(page.params.id ?? '');
	const session = useSession();

	let searchInput = $state('');
	let search = $state('');
	let from = $state('');
	let to = $state('');
	let pages = $state(1);

	// Search as the user types, but not on every keystroke.
	$effect(() => {
		const text = searchInput;
		const timer = setTimeout(() => (search = text), 250);
		return () => clearTimeout(timer);
	});

	const account = useLive(session.client, ['accounts', 'transactions'], () =>
		session.api.accounts.get(accountId)
	);
	const rows = useLive(
		session.client,
		['transactions', 'transaction_splits', 'payees', 'categories', 'accounts'],
		() =>
			session.api.transactions.list({
				accountId,
				search: search || undefined,
				from: from || undefined,
				to: to || undefined,
				limit: pages * PAGE_SIZE
			})
	);
	const balances = $derived(account.data ? registerBalances(account.data) : null);
	const hasMore = $derived((rows.data?.length ?? 0) >= pages * PAGE_SIZE);
</script>

<div class="mx-auto grid max-w-6xl gap-4 p-3 md:p-6">
	{#if account.error && !account.data}
		<p class="text-destructive" role="alert">{errorMessage(account.error)}</p>
	{:else if account.data && balances}
		<header class="flex flex-wrap items-end justify-between gap-3">
			<div>
				<h1 class="text-xl font-semibold" data-testid="register-title">{account.data.name}</h1>
				<dl class="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
					<div class="flex gap-1">
						<dt class="text-muted-foreground">{m.register_cleared_balance()}</dt>
						<dd class="tabular-nums">{session.format(balances.cleared)}</dd>
					</div>
					<div class="flex gap-1">
						<dt class="text-muted-foreground">{m.register_uncleared_balance()}</dt>
						<dd class="tabular-nums">{session.format(balances.uncleared)}</dd>
					</div>
					<div class="flex gap-1">
						<dt class="text-muted-foreground">{m.register_total_balance()}</dt>
						<dd class="font-medium tabular-nums" data-testid="register-balance">
							{session.format(balances.total)}
						</dd>
					</div>
				</dl>
			</div>
		</header>

		<div class="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
			<Input
				type="search"
				bind:value={searchInput}
				placeholder={m.register_search()}
				aria-label={m.register_search()}
			/>
			<div class="flex items-center gap-2">
				<Label for="register-from" class="text-sm text-muted-foreground">{m.register_from()}</Label>
				<Input id="register-from" type="date" bind:value={from} />
			</div>
			<div class="flex items-center gap-2">
				<Label for="register-to" class="text-sm text-muted-foreground">{m.register_to()}</Label>
				<Input id="register-to" type="date" bind:value={to} />
			</div>
		</div>

		<section class="rounded-lg border" aria-label={m.register_transactions()}>
			{#each rows.data ?? [] as row (row.id)}
				<RegisterRow {row} />
			{:else}
				{#if rows.data}
					<p class="p-6 text-center text-muted-foreground">{m.register_empty()}</p>
				{/if}
			{/each}
		</section>
		{#if hasMore}
			<Button variant="outline" onclick={() => pages++}>{m.register_load_more()}</Button>
		{/if}
	{/if}
</div>

<svelte:head><title>{account.data?.name ?? m.nav_accounts()} · {m.app_name()}</title></svelte:head>
```

- [ ] **Step 6: Format, check and commit**

```bash
pnpm exec prettier --write src/lib/accounts/register.ts src/lib/accounts/register.test.ts src/lib/components/accounts/RegisterRow.svelte 'src/routes/accounts/[id]/+page.svelte'
```

Run: `pnpm lint && pnpm check`

Expected: Prettier, ESLint and svelte-check report no problems.

Run: `pnpm test`

Expected: every unit test passes.

```bash
git add src/lib/accounts/register.ts src/lib/accounts/register.test.ts src/lib/components/accounts/RegisterRow.svelte 'src/routes/accounts/[id]/+page.svelte'
git commit -m "feat: add the account register" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```


---


### Task 13: App shell, accounts page and settings

The navigation of spec §5. Below 768px there is a bottom nav (Budget · Accounts · Settings). On desktop there is a sidebar with the budget name, the nav, and every account with its balance. Reports joins the nav in Plan 3.

- **Accounts page:** On-budget, Tracking (off-budget) and Closed sections, each with its total. You can add an account (Task 7's defaults apply), and each account has settings: rename, close or reopen, delete. The repo errors, such as `ACCOUNT_BALANCE_NOT_ZERO`, `CC_PAYMENT_NOT_EMPTY` and `ACCOUNT_HAS_TRANSACTIONS`, appear inline.
- **Settings:** the App section only, with UI language (reloads the page, which is how Paraglide switches) and theme (system, light, dark). Plan 3 adds budget files, budget details, backup and storage.

**Files:**
- Create: `src/lib/components/accounts/AccountList.svelte`
- Create: `src/lib/components/app/AppShell.svelte`
- Create: `src/routes/accounts/+page.svelte`
- Create: `src/lib/components/accounts/AddAccountDialog.svelte`
- Create: `src/lib/components/accounts/AccountSettingsDialog.svelte`
- Create: `src/routes/settings/+page.svelte`
- Modify: `src/lib/components/app/Boot.svelte`
- Test: `e2e/shell.e2e.ts`
- Test: `e2e/register.e2e.ts`

**Interfaces:**
- Consumes: `useSession`, `runAction` (Task 8); `useLive` (Task 9); the register route (Task 12); `ResponsiveDialog` (Task 10); `AccountFields` (Task 8); `accountSections`, `signedStartingBalance` (Task 7); `api.accounts.*` (Plan 1); `setMode`, `userPrefersMode` (mode-watcher); `setLocale`, `getLocale`, `locales` (Paraglide).
- Produces:
  - `<AppShell>…</AppShell>` wrapping every page of an open budget (Task 15 adds the + Transaction button)
  - `<AccountList accounts onSettings? />`, with test ids `account-row` and `account-balance`
  - `<AddAccountDialog bind:open />`, `<AccountSettingsDialog bind:open account />`
  - routes `/accounts` and `/settings`

- [ ] **Step 1: Write the failing e2e tests**

Create `e2e/shell.e2e.ts`:

```ts
import { expect, test } from '@playwright/test';
import { onboard } from './helpers';

test('navigates between screens and switches the language', async ({ page }) => {
	await onboard(page);
	await page.getByRole('link', { name: 'Accounts' }).first().click();
	await expect(page.getByRole('heading', { name: 'Accounts' })).toBeVisible();
	await page.getByRole('link', { name: 'Settings' }).first().click();
	await page.getByLabel('Language').selectOption('pt-BR');
	await expect(page.getByRole('heading', { name: 'Configurações' })).toBeVisible();
	await page.getByRole('link', { name: 'Orçamento' }).first().click();
	await expect(page.getByText('Pronto para atribuir').first()).toBeVisible();
});

test('adds, closes and protects accounts', async ({ page }) => {
	await onboard(page);
	await page.getByRole('link', { name: 'Accounts' }).first().click();
	await page.getByRole('button', { name: 'Add account' }).click();
	const dialog = page.getByRole('dialog');
	await dialog.getByLabel('Account name').fill('Old savings');
	await dialog.getByLabel('Type').selectOption('savings');
	await dialog.getByRole('button', { name: 'Add account' }).click();
	await expect(dialog).toBeHidden();

	const main = page.getByRole('main');
	await main.getByRole('button', { name: 'Settings for Old savings' }).click();
	await dialog.getByRole('button', { name: 'Close account' }).click();
	await expect(dialog).toBeHidden();
	await expect(main.getByRole('region', { name: 'Closed' })).toContainText('Old savings');

	await main.getByRole('button', { name: 'Settings for Checking' }).click();
	await dialog.getByRole('button', { name: 'Close account' }).click();
	await expect(dialog.getByRole('alert')).toHaveText(
		'Only accounts with a zero balance can be closed.'
	);
});
```

Create `e2e/register.e2e.ts`:

```ts
import { expect, test } from '@playwright/test';
import { onboard } from './helpers';

test('shows the register with balances, cleared toggles and search', async ({ page }) => {
	await onboard(page);
	await page.getByTestId('account-row').filter({ hasText: 'Checking' }).getByRole('link').click();
	await expect(page.getByTestId('register-title')).toHaveText('Checking');

	const row = page.getByTestId('register-row');
	await expect(row).toHaveCount(1);
	await expect(row).toContainText('Starting balance');
	await expect(row.getByTestId('register-amount')).toHaveText('$1,000.00');
	await expect(page.getByTestId('register-balance')).toHaveText('$1,000.00');

	await row.getByRole('button', { name: 'Cleared' }).click();
	await expect(row.getByRole('button', { name: 'Cleared' })).toHaveAttribute(
		'aria-pressed',
		'false'
	);

	await page.getByRole('searchbox').fill('nothing like this');
	await expect(page.getByText('No transactions.')).toBeVisible();
	await page.getByRole('searchbox').fill('');
	await expect(row).toHaveCount(1);
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm test:e2e e2e/shell.e2e.ts`

Expected: FAIL. There is no navigation yet.

- [ ] **Step 3: Add the shell**

Create `src/lib/components/accounts/AccountList.svelte`:

```svelte
<script lang="ts">
	import { resolve } from '$app/paths';
	import SettingsIcon from '@lucide/svelte/icons/settings-2';
	import { Button } from '$lib/components/ui/button';
	import { accountSections, type AccountSectionKey } from '$lib/accounts/account-form';
	import { useSession } from '$lib/client/app-state.svelte';
	import type { Account } from '$lib/db/repos/accounts';
	import { m } from '$lib/paraglide/messages';

	let { accounts, onSettings }: { accounts: Account[]; onSettings?: (account: Account) => void } =
		$props();

	const session = useSession();
	const sections = $derived(accountSections(accounts));
	const TITLES: Record<AccountSectionKey, () => string> = {
		onBudget: m.accounts_on_budget,
		offBudget: m.accounts_off_budget,
		closed: m.accounts_closed
	};
</script>

<div class="grid gap-4">
	{#each sections as section (section.key)}
		<section class="grid gap-1" aria-label={TITLES[section.key]()}>
			<div
				class="flex items-center justify-between px-2 text-xs font-medium tracking-wide text-muted-foreground uppercase"
			>
				<span>{TITLES[section.key]()}</span>
				<span class="tabular-nums">{session.format(section.total)}</span>
			</div>
			{#each section.accounts as account (account.id)}
				<div class="flex items-center gap-1" data-testid="account-row">
					<a
						href={resolve('/accounts/[id]', { id: account.id })}
						class="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
					>
						<span class="truncate">{account.name}</span>
						<span
							class="tabular-nums {account.balance < 0 ? 'text-destructive' : ''}"
							data-testid="account-balance">{session.format(account.balance)}</span
						>
					</a>
					{#if onSettings}
						<Button
							variant="ghost"
							size="icon-sm"
							aria-label={m.account_settings_for({ name: account.name })}
							onclick={() => onSettings(account)}
						>
							<SettingsIcon />
						</Button>
					{/if}
				</div>
			{/each}
		</section>
	{/each}
</div>
```

Create `src/lib/components/app/AppShell.svelte`:

```svelte
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import LandmarkIcon from '@lucide/svelte/icons/landmark';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import WalletIcon from '@lucide/svelte/icons/wallet';
	import AccountList from '$lib/components/accounts/AccountList.svelte';
	import { useSession } from '$lib/client/app-state.svelte';
	import { useLive } from '$lib/client/live.svelte';
	import { currentMonth } from '$lib/domain/month';
	import { m } from '$lib/paraglide/messages';

	let { children }: { children: Snippet } = $props();

	const session = useSession();
	const accounts = useLive(session.client, ['accounts', 'transactions'], () =>
		session.api.accounts.list()
	);

	const path = $derived(page.url.pathname);
	const nav = $derived([
		{
			href: resolve('/budget/[month]', { month: currentMonth() }),
			label: m.nav_budget(),
			icon: WalletIcon,
			active: path.startsWith('/budget')
		},
		{
			href: resolve('/accounts'),
			label: m.nav_accounts(),
			icon: LandmarkIcon,
			active: path.startsWith('/accounts')
		},
		{
			href: resolve('/settings'),
			label: m.nav_settings(),
			icon: SettingsIcon,
			active: path.startsWith('/settings')
		}
	]);
</script>

<div class="flex min-h-dvh">
	<aside
		class="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-6 overflow-y-auto border-r bg-sidebar p-3 text-sidebar-foreground md:flex"
	>
		<div class="px-2 pt-2">
			<p class="text-lg font-semibold">{m.app_name()}</p>
			<p class="truncate text-sm text-muted-foreground">{session.meta.name}</p>
		</div>
		<nav class="grid gap-1" aria-label={m.nav_label()}>
			{#each nav as item (item.label)}
				<a
					href={item.href}
					aria-current={item.active ? 'page' : undefined}
					class="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-sidebar-accent aria-[current=page]:bg-sidebar-accent aria-[current=page]:font-medium"
				>
					<item.icon class="size-4" />
					{item.label}
				</a>
			{/each}
		</nav>
		<AccountList accounts={accounts.data ?? []} />
	</aside>

	<main class="min-w-0 flex-1 pb-20 md:pb-0">{@render children()}</main>

	<nav
		class="fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
		aria-label={m.nav_label()}
	>
		{#each nav as item (item.label)}
			<a
				href={item.href}
				aria-current={item.active ? 'page' : undefined}
				class="flex flex-col items-center gap-0.5 py-2 text-xs text-muted-foreground aria-[current=page]:text-foreground"
			>
				<item.icon class="size-5" />
				{item.label}
			</a>
		{/each}
	</nav>
</div>
```

Replace `src/lib/components/app/Boot.svelte` (wraps the page in `AppShell`):

```svelte
<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { AppState, BudgetSession, setApp } from '$lib/client/app-state.svelte';
	import { startDbWorker, type DbWorker } from '$lib/client/db';
	import { openLastBudget, startupError } from '$lib/client/session';
	import { createTabLock, type TabLock } from '$lib/client/tab-lock';
	import type { BudgetMeta } from '$lib/db/repos/meta';
	import { currentMonth } from '$lib/domain/month';
	import AppShell from './AppShell.svelte';
	import Onboarding from './Onboarding.svelte';
	import StartupScreen from './StartupScreen.svelte';

	let { children }: { children: Snippet } = $props();

	const app = new AppState();
	setApp(app);

	let worker: DbWorker | null = $state.raw(null);
	// Without Web Locks (very old browsers) there is no way to coordinate tabs; run unguarded.
	const lock: TabLock | null =
		'locks' in navigator
			? createTabLock({ locks: navigator.locks, channel: new BroadcastChannel('moneta-tab') })
			: null;

	lock?.onLost(async () => {
		await stopWorker();
		app.boot = { kind: 'blocked' };
	});

	async function stopWorker() {
		const current = worker;
		worker = null;
		app.session = null;
		if (!current) return;
		await current.api.system.release().catch(() => {});
		current.terminate();
	}

	async function start() {
		app.boot = { kind: 'loading' };
		const started = startDbWorker();
		worker = started;
		started.onFatal((err) => {
			app.boot = { kind: 'error', code: 'WORKER_FAILED', message: err.message };
		});
		try {
			const result = await openLastBudget(started.api, localStorage);
			if (result.kind === 'ready') ready(result.file, result.meta);
			else app.boot = { kind: 'onboarding' };
		} catch (err) {
			app.boot = { kind: 'error', ...startupError(err) };
		}
	}

	function ready(file: string, meta: BudgetMeta) {
		if (!worker) return;
		app.session = new BudgetSession(worker, file, meta);
		app.boot = { kind: 'ready' };
	}

	async function takeOver() {
		app.boot = { kind: 'loading' };
		await lock?.takeOver();
		await start();
	}

	onMount(() => {
		void (async () => {
			if (!lock || (await lock.tryAcquire())) await start();
			else app.boot = { kind: 'blocked' };
		})();
	});

	$effect(() => app.session?.watchMeta());
</script>

{#if app.boot.kind === 'ready' && app.session}
	{#key app.session.file}
		<AppShell>{@render children()}</AppShell>
	{/key}
{:else if app.boot.kind === 'onboarding' && worker}
	<Onboarding
		api={worker.api}
		onCreated={(file, meta) => {
			ready(file, meta);
			void goto(resolve('/budget/[month]', { month: currentMonth() }));
		}}
	/>
{:else if app.boot.kind === 'loading' || app.boot.kind === 'blocked' || app.boot.kind === 'error'}
	<StartupScreen boot={app.boot} onTakeOver={takeOver} />
{/if}
```

- [ ] **Step 4: Add the accounts page and its dialogs**

Create `src/lib/components/accounts/AddAccountDialog.svelte`:

```svelte
<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import ResponsiveDialog from '$lib/components/ResponsiveDialog.svelte';
	import { signedStartingBalance } from '$lib/accounts/account-form';
	import { useSession } from '$lib/client/app-state.svelte';
	import { runAction } from '$lib/client/notify';
	import type { AccountType } from '$lib/db/repos/accounts';
	import { todayIso } from '$lib/domain/month';
	import { m } from '$lib/paraglide/messages';
	import AccountFields from './AccountFields.svelte';

	let { open = $bindable(false) }: { open: boolean } = $props();
	const session = useSession();

	let name = $state('');
	let type = $state<AccountType>('checking');
	let onBudget = $state(true);
	let balance = $state('');
	let date = $state(todayIso());
	let error = $state<string | null>(null);

	$effect(() => {
		if (!open) return;
		name = '';
		type = 'checking';
		onBudget = true;
		balance = '';
		date = todayIso();
		error = null;
	});

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		const typed = balance.trim() === '' ? 0 : session.parse(balance);
		if (typed === null) {
			error = m.form_error_amount_invalid();
			return;
		}
		error = await runAction(() =>
			session.api.accounts.create({
				name,
				type,
				onBudget,
				startingBalance: signedStartingBalance(type, typed),
				startingDate: date
			})
		);
		if (!error) open = false;
	}
</script>

<ResponsiveDialog bind:open title={m.accounts_add()}>
	<form class="grid gap-4" onsubmit={submit}>
		<AccountFields
			bind:name
			bind:type
			bind:onBudget
			bind:balance
			bind:date
			idPrefix="new-account"
		/>
		{#if error}<p class="text-sm text-destructive" role="alert">{error}</p>{/if}
		<Button type="submit">{m.accounts_add()}</Button>
	</form>
</ResponsiveDialog>
```

Create `src/lib/components/accounts/AccountSettingsDialog.svelte`:

```svelte
<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Separator } from '$lib/components/ui/separator';
	import ResponsiveDialog from '$lib/components/ResponsiveDialog.svelte';
	import { useSession } from '$lib/client/app-state.svelte';
	import { runAction } from '$lib/client/notify';
	import type { Account } from '$lib/db/repos/accounts';
	import { m } from '$lib/paraglide/messages';

	let { open = $bindable(false), account }: { open: boolean; account: Account } = $props();
	const session = useSession();
	let name = $state('');
	let confirmDelete = $state(false);
	let error = $state<string | null>(null);

	$effect(() => {
		if (!open) return;
		name = account.name;
		confirmDelete = false;
		error = null;
	});

	async function act(fn: () => Promise<unknown>) {
		error = await runAction(fn);
		if (!error) open = false;
	}

	function rename(event: SubmitEvent) {
		event.preventDefault();
		void act(() => session.api.accounts.rename(account.id, name));
	}

	function remove() {
		if (!confirmDelete) confirmDelete = true;
		else void act(() => session.api.accounts.delete(account.id));
	}
</script>

<ResponsiveDialog bind:open title={account.name}>
	<div class="grid gap-4">
		<form class="grid gap-2" onsubmit={rename}>
			<Label for="account-rename">{m.account_name()}</Label>
			<div class="flex gap-2">
				<Input id="account-rename" bind:value={name} required autocomplete="off" />
				<Button type="submit" variant="outline">{m.save()}</Button>
			</div>
		</form>
		<Separator />
		{#if account.closed}
			<Button variant="outline" onclick={() => act(() => session.api.accounts.reopen(account.id))}>
				{m.account_reopen()}
			</Button>
		{:else}
			<div class="grid gap-1">
				<Button variant="outline" onclick={() => act(() => session.api.accounts.close(account.id))}>
					{m.account_close()}
				</Button>
				<p class="text-xs text-muted-foreground">{m.account_close_hint()}</p>
			</div>
		{/if}
		<div class="grid gap-1">
			<Button variant="destructive" onclick={remove}>
				{confirmDelete ? m.confirm_delete() : m.account_delete()}
			</Button>
			<p class="text-xs text-muted-foreground">{m.account_delete_hint()}</p>
		</div>
		{#if error}<p class="text-sm text-destructive" role="alert">{error}</p>{/if}
	</div>
</ResponsiveDialog>
```

Create `src/routes/accounts/+page.svelte`:

```svelte
<script lang="ts">
	import PlusIcon from '@lucide/svelte/icons/plus';
	import { Button } from '$lib/components/ui/button';
	import AccountList from '$lib/components/accounts/AccountList.svelte';
	import AccountSettingsDialog from '$lib/components/accounts/AccountSettingsDialog.svelte';
	import AddAccountDialog from '$lib/components/accounts/AddAccountDialog.svelte';
	import { useSession } from '$lib/client/app-state.svelte';
	import { useLive } from '$lib/client/live.svelte';
	import type { Account } from '$lib/db/repos/accounts';
	import { m } from '$lib/paraglide/messages';

	const session = useSession();
	const accounts = useLive(session.client, ['accounts', 'transactions'], () =>
		session.api.accounts.list()
	);
	let adding = $state(false);
	let settingsOpen = $state(false);
	let selected = $state<Account | null>(null);
</script>

<div class="mx-auto grid max-w-2xl gap-4 p-3 md:p-6">
	<header class="flex items-center justify-between">
		<h1 class="text-xl font-semibold">{m.nav_accounts()}</h1>
		<Button onclick={() => (adding = true)}>
			<PlusIcon />
			{m.accounts_add()}
		</Button>
	</header>
	{#if accounts.data?.length === 0}
		<p class="text-muted-foreground">{m.accounts_empty()}</p>
	{/if}
	<AccountList
		accounts={accounts.data ?? []}
		onSettings={(account) => {
			selected = account;
			settingsOpen = true;
		}}
	/>
</div>

<AddAccountDialog bind:open={adding} />
{#if selected}
	<AccountSettingsDialog bind:open={settingsOpen} account={selected} />
{/if}
<svelte:head><title>{m.nav_accounts()} · {m.app_name()}</title></svelte:head>
```

- [ ] **Step 5: Add the settings page**

Create `src/routes/settings/+page.svelte`:

```svelte
<script lang="ts">
	import { setMode, userPrefersMode } from 'mode-watcher';
	import * as Card from '$lib/components/ui/card';
	import { Label } from '$lib/components/ui/label';
	import { NativeSelect, NativeSelectOption } from '$lib/components/ui/native-select';
	import { m } from '$lib/paraglide/messages';
	import { getLocale, locales, setLocale, type Locale } from '$lib/paraglide/runtime';

	const LANGUAGE_NAMES: Record<Locale, string> = { en: 'English', 'pt-BR': 'Português (Brasil)' };
	type Theme = 'system' | 'light' | 'dark';
	const THEMES: { value: Theme; label: () => string }[] = [
		{ value: 'system', label: m.settings_theme_system },
		{ value: 'light', label: m.settings_theme_light },
		{ value: 'dark', label: m.settings_theme_dark }
	];
</script>

<div class="mx-auto grid max-w-2xl gap-4 p-3 md:p-6">
	<h1 class="text-xl font-semibold">{m.nav_settings()}</h1>
	<Card.Root>
		<Card.Header>
			<Card.Title>{m.settings_app()}</Card.Title>
		</Card.Header>
		<Card.Content class="grid gap-4">
			<div class="grid gap-2">
				<Label for="settings-language">{m.settings_language()}</Label>
				<NativeSelect
					id="settings-language"
					class="w-full"
					value={getLocale()}
					onchange={(e) => setLocale(e.currentTarget.value as Locale)}
				>
					{#each locales as locale (locale)}
						<NativeSelectOption value={locale}>{LANGUAGE_NAMES[locale]}</NativeSelectOption>
					{/each}
				</NativeSelect>
			</div>
			<div class="grid gap-2">
				<Label for="settings-theme">{m.settings_theme()}</Label>
				<NativeSelect
					id="settings-theme"
					class="w-full"
					value={userPrefersMode.current}
					onchange={(e) => setMode(e.currentTarget.value as Theme)}
				>
					{#each THEMES as theme (theme.value)}
						<NativeSelectOption value={theme.value}>{theme.label()}</NativeSelectOption>
					{/each}
				</NativeSelect>
			</div>
		</Card.Content>
	</Card.Root>
</div>
<svelte:head><title>{m.nav_settings()} · {m.app_name()}</title></svelte:head>
```

- [ ] **Step 6: Run the e2e tests to verify they pass**

Run: `pnpm test:e2e`

Expected: PASS (10 tests).

- [ ] **Step 7: Format, check and commit**

```bash
pnpm exec prettier --write src/lib/components/accounts/AccountList.svelte src/lib/components/app/AppShell.svelte src/routes/accounts/+page.svelte src/lib/components/accounts/AddAccountDialog.svelte src/lib/components/accounts/AccountSettingsDialog.svelte src/routes/settings/+page.svelte src/lib/components/app/Boot.svelte e2e/shell.e2e.ts e2e/register.e2e.ts
```

Run: `pnpm lint && pnpm check`

Expected: Prettier, ESLint and svelte-check report no problems.

Run: `pnpm test`

Expected: every unit test passes.

```bash
git add src/lib/components/accounts/AccountList.svelte src/lib/components/app/AppShell.svelte src/routes/accounts/+page.svelte src/lib/components/accounts/AddAccountDialog.svelte src/lib/components/accounts/AccountSettingsDialog.svelte src/routes/settings/+page.svelte src/lib/components/app/Boot.svelte e2e/shell.e2e.ts e2e/register.e2e.ts
git commit -m "feat: add the app shell, the accounts page and settings" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```


---


### Task 14: Transaction form logic

The rules of the transaction form (spec §3 rules 3–5, §5), kept pure so they can be tested thoroughly:

- **Transfers:** the payee field offers "Transfer: ‹account›" for every other open account, and picking one makes the transaction a transfer. Transfers between two on-budget accounts, or two off-budget ones, have no category. Across the budget boundary the on-budget leg needs one, whichever side you enter it from.
- **Categories:** required on cash accounts and optional on cards (uncategorized card spending is plain debt). Off-budget accounts have none. Card payment categories are never offered, hidden ones only if already chosen, and Ready to Assign never when the budget side is a card (Task 2).
- **Splits:** only on on-budget, non-transfer transactions, with at least two lines that add up to the amount. Lines follow the transaction's direction, and a negative line goes the other way (e.g. a refund inside a purchase).
- **Amounts:** typed without a sign, with an Outflow/Inflow toggle. Arithmetic is allowed.
- **Payees:** picking an existing payee suggests its most recent category.
- **Editing:** `draftFromTransaction` turns a row back into a draft. For a transfer seen from its off-budget leg, the category comes from the other leg.

**Files:**
- Create: `src/lib/transactions/form.ts`
- Test: `src/lib/transactions/form.test.ts`

**Interfaces:**
- Consumes: `Account`, `GroupNode`, `Payee`, `TransactionInput`, `SplitInput`, `TransactionRow` (Plan 1); `parseAmount`, `formatAmountInput` (Task 1); `isDate` (Plan 1).
- Produces:
  - `interface TransactionDraft { accountId; date; payee; categoryId; amount; direction: 'outflow' | 'inflow'; memo; cleared; splits: SplitDraft[] | null }`, `SplitDraft = { categoryId; amount; memo }`
  - `interface FormContext { accounts: FormAccount[]; payees: Payee[]; tree: GroupNode[]; money: MoneyFormat; transferLabel(accountName): string }`
  - `newDraft(accountId, date)`, `transferTargets(draft, ctx)`, `transferTarget(draft, ctx)`, `categoryMode(draft, ctx): 'required' | 'optional' | 'hidden'`, `canSplit(draft, ctx)`, `categoryOptions(draft, ctx): CategoryOptionGroup[]`, `suggestCategory(draft, ctx)`, `splitRemaining(draft, money): number | null`
  - `buildTransactionInput(draft, ctx): { ok: true; input: TransactionInput } | { ok: false; error: FormError }`, where `FormError` is `ACCOUNT_REQUIRED | DATE_INVALID | AMOUNT_INVALID | CATEGORY_REQUIRED | SPLIT_LINE_INVALID | SPLIT_TOO_FEW_LINES | SPLIT_SUM_MISMATCH`
  - `draftFromTransaction(row, ctx, pair?): TransactionDraft`

- [ ] **Step 1: Write the failing test**

Create `src/lib/transactions/form.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type { GroupNode } from '$lib/db/repos/categories';
import type { TransactionRow } from '$lib/db/repos/transactions';
import {
	buildTransactionInput,
	canSplit,
	categoryMode,
	categoryOptions,
	draftFromTransaction,
	newDraft,
	splitRemaining,
	suggestCategory,
	transferTarget,
	type FormAccount,
	type FormContext,
	type TransactionDraft
} from './form';

const acct = (id: string, type: FormAccount['type'], onBudget = true, closed = false) => ({
	id,
	name: id[0].toUpperCase() + id.slice(1),
	type,
	onBudget,
	closed
});

const category = (
	id: string,
	groupId: string,
	extra: Partial<GroupNode['categories'][number]> = {}
): GroupNode['categories'][number] => ({
	id,
	groupId,
	name: id[0].toUpperCase() + id.slice(1),
	sortOrder: 0,
	hidden: false,
	carryoverOverspending: false,
	ccAccountId: null,
	system: null,
	...extra
});

const tree: GroupNode[] = [
	{
		id: 'income',
		name: 'Income',
		sortOrder: 0,
		hidden: false,
		system: 'income',
		categories: [category('rta', 'income', { name: 'Ready to Assign', system: 'ready_to_assign' })]
	},
	{
		id: 'cards',
		name: 'Credit Card Payments',
		sortOrder: 1,
		hidden: false,
		system: 'credit_card_payments',
		categories: [category('visaPayment', 'cards', { name: 'Visa', ccAccountId: 'visa' })]
	},
	{
		id: 'everyday',
		name: 'Everyday',
		sortOrder: 2,
		hidden: false,
		system: null,
		categories: [category('food', 'everyday'), category('old', 'everyday', { hidden: true })]
	}
];

const ctx: FormContext = {
	accounts: [
		acct('checking', 'checking'),
		acct('savings', 'savings'),
		acct('visa', 'credit_card'),
		acct('broker', 'investment', false),
		acct('closedbank', 'checking', true, true)
	],
	payees: [
		{ id: 'p1', name: 'Mercado', lastCategoryId: 'food' },
		{ id: 'p2', name: 'Oldshop', lastCategoryId: 'old' }
	],
	tree,
	money: { currency: 'BRL', locale: 'pt-BR' },
	transferLabel: (name) => `Transfer: ${name}`
};

const draft = (p: Partial<TransactionDraft>): TransactionDraft => ({
	...newDraft('checking', '2026-09-05'),
	...p
});

describe('newDraft', () => {
	it('starts as an uncleared outflow with no category', () => {
		expect(newDraft('checking', '2026-09-05')).toEqual({
			accountId: 'checking',
			date: '2026-09-05',
			payee: '',
			categoryId: '',
			amount: '',
			direction: 'outflow',
			memo: '',
			cleared: false,
			splits: null
		});
	});
});

describe('transfers in the payee field', () => {
	it('recognizes transfer labels for other open accounts only', () => {
		expect(transferTarget(draft({ payee: 'Transfer: Savings' }), ctx)?.id).toBe('savings');
		expect(transferTarget(draft({ payee: 'Transfer: Checking' }), ctx)).toBeNull();
		expect(transferTarget(draft({ payee: 'Transfer: Closedbank' }), ctx)).toBeNull();
		expect(transferTarget(draft({ payee: 'Mercado' }), ctx)).toBeNull();
	});
});

describe('categoryMode', () => {
	it.each([
		['checking', '', 'required'],
		['visa', '', 'optional'],
		['broker', '', 'hidden'],
		['checking', 'Transfer: Savings', 'hidden'],
		['checking', 'Transfer: Visa', 'hidden'],
		['checking', 'Transfer: Broker', 'required'],
		['broker', 'Transfer: Checking', 'required']
	])('%s with payee "%s" → %s', (accountId, payee, mode) => {
		expect(categoryMode(draft({ accountId, payee }), ctx)).toBe(mode);
	});

	it('hides the category while split', () => {
		expect(categoryMode(draft({ splits: [] }), ctx)).toBe('hidden');
	});
});

describe('canSplit', () => {
	it('allows splits on on-budget accounts, but not on transfers', () => {
		expect(canSplit(draft({}), ctx)).toBe(true);
		expect(canSplit(draft({ accountId: 'broker' }), ctx)).toBe(false);
		expect(canSplit(draft({ payee: 'Transfer: Savings' }), ctx)).toBe(false);
	});
});

describe('categoryOptions', () => {
	const ids = (d: TransactionDraft) =>
		categoryOptions(d, ctx).flatMap((g) => g.categories.map((c) => c.id));

	it('never offers card payment or hidden categories', () => {
		expect(ids(draft({}))).toEqual(['rta', 'food']);
	});

	it('keeps a hidden category that is already chosen', () => {
		expect(ids(draft({ categoryId: 'old' }))).toEqual(['rta', 'food', 'old']);
	});

	it('leaves out Ready to Assign when the budget side is a card', () => {
		expect(ids(draft({ accountId: 'visa' }))).toEqual(['food']);
		expect(ids(draft({ accountId: 'broker', payee: 'Transfer: Visa' }))).toEqual(['food']);
	});
});

describe('suggestCategory', () => {
	it('suggests the payee’s last category when it is offered', () => {
		expect(suggestCategory(draft({ payee: 'mercado' }), ctx)).toBe('food');
		expect(suggestCategory(draft({ payee: 'Oldshop' }), ctx)).toBeNull();
		expect(suggestCategory(draft({ payee: 'Someone new' }), ctx)).toBeNull();
	});
});

describe('buildTransactionInput', () => {
	it('builds a categorized outflow', () => {
		expect(
			buildTransactionInput(
				draft({
					payee: ' Mercado ',
					categoryId: 'food',
					amount: '12,50',
					memo: ' pão ',
					cleared: true
				}),
				ctx
			)
		).toEqual({
			ok: true,
			input: {
				accountId: 'checking',
				date: '2026-09-05',
				amount: -1250,
				memo: 'pão',
				cleared: true,
				payeeName: 'Mercado',
				categoryId: 'food'
			}
		});
	});

	it('builds income with arithmetic', () => {
		const result = buildTransactionInput(
			draft({ categoryId: 'rta', amount: '1000+250,5', direction: 'inflow' }),
			ctx
		);
		expect(result).toMatchObject({ ok: true, input: { amount: 125050, categoryId: 'rta' } });
	});

	it('allows uncategorized card spending', () => {
		expect(buildTransactionInput(draft({ accountId: 'visa', amount: '10' }), ctx)).toMatchObject({
			ok: true,
			input: { accountId: 'visa', amount: -1000, categoryId: null }
		});
	});

	it('builds transfers, with a category only across the budget boundary', () => {
		expect(
			buildTransactionInput(
				draft({ payee: 'Transfer: Savings', categoryId: 'food', amount: '5' }),
				ctx
			)
		).toEqual({
			ok: true,
			input: {
				accountId: 'checking',
				date: '2026-09-05',
				amount: -500,
				memo: '',
				cleared: false,
				transferAccountId: 'savings',
				categoryId: null
			}
		});
		expect(
			buildTransactionInput(
				draft({ payee: 'Transfer: Broker', categoryId: 'food', amount: '5' }),
				ctx
			)
		).toMatchObject({ ok: true, input: { transferAccountId: 'broker', categoryId: 'food' } });
	});

	it('builds splits whose lines follow the direction', () => {
		const result = buildTransactionInput(
			draft({
				amount: '30',
				splits: [
					{ categoryId: 'food', amount: '35', memo: '' },
					{ categoryId: 'rta', amount: '-5', memo: ' refund ' }
				]
			}),
			ctx
		);
		expect(result).toMatchObject({
			ok: true,
			input: {
				amount: -3000,
				splits: [
					{ categoryId: 'food', amount: -3500, memo: '' },
					{ categoryId: 'rta', amount: 500, memo: 'refund' }
				]
			}
		});
		expect(result.ok && 'categoryId' in result.input).toBe(false);
	});

	it.each([
		[{ accountId: 'nope' }, 'ACCOUNT_REQUIRED'],
		[{ date: '2026-02-30', categoryId: 'food', amount: '1' }, 'DATE_INVALID'],
		[{ categoryId: 'food', amount: '' }, 'AMOUNT_INVALID'],
		[{ categoryId: 'food', amount: '-5' }, 'AMOUNT_INVALID'],
		[{ categoryId: 'food', amount: '1e5' }, 'AMOUNT_INVALID'],
		[{ amount: '5' }, 'CATEGORY_REQUIRED'],
		[{ accountId: 'broker', payee: 'Transfer: Checking', amount: '5' }, 'CATEGORY_REQUIRED'],
		[
			{ amount: '5', splits: [{ categoryId: 'food', amount: '5', memo: '' }] },
			'SPLIT_TOO_FEW_LINES'
		],
		[
			{
				amount: '5',
				splits: [
					{ categoryId: 'food', amount: '5', memo: '' },
					{ categoryId: '', amount: '0', memo: '' }
				]
			},
			'SPLIT_LINE_INVALID'
		],
		[
			{
				amount: '5',
				splits: [
					{ categoryId: 'food', amount: '3', memo: '' },
					{ categoryId: 'rta', amount: '1', memo: '' }
				]
			},
			'SPLIT_SUM_MISMATCH'
		]
	] as [Partial<TransactionDraft>, string][])('rejects %o with %s', (patch, error) => {
		expect(buildTransactionInput(draft(patch), ctx)).toEqual({ ok: false, error });
	});
});

describe('splitRemaining', () => {
	it('tracks what is left to split, and waits for readable amounts', () => {
		const d = draft({
			amount: '30',
			splits: [
				{ categoryId: 'food', amount: '10', memo: '' },
				{ categoryId: '', amount: '', memo: '' }
			]
		});
		expect(splitRemaining(d, ctx.money)).toBe(-2000);
		expect(splitRemaining({ ...d, direction: 'inflow' }, ctx.money)).toBe(2000);
		expect(splitRemaining({ ...d, amount: 'x' }, ctx.money)).toBeNull();
	});
});

describe('draftFromTransaction', () => {
	const row = (p: Partial<TransactionRow>): TransactionRow => ({
		id: 't1',
		accountId: 'checking',
		accountName: 'Checking',
		date: '2026-09-05',
		amount: -1250,
		payeeId: 'p1',
		payeeName: 'Mercado',
		categoryId: 'food',
		categoryName: 'Food',
		memo: 'pão',
		cleared: true,
		transferId: null,
		transferAccountId: null,
		transferAccountName: null,
		isSplit: false,
		splits: [],
		...p
	});

	it('round-trips a plain transaction', () => {
		const d = draftFromTransaction(row({}), ctx);
		expect(d).toMatchObject({ payee: 'Mercado', amount: '12,50', direction: 'outflow' });
		expect(buildTransactionInput(d, ctx)).toMatchObject({
			ok: true,
			input: { amount: -1250, payeeName: 'Mercado', categoryId: 'food', memo: 'pão', cleared: true }
		});
	});

	it('round-trips a split with a line in the other direction', () => {
		const d = draftFromTransaction(
			row({
				amount: -3000,
				categoryId: null,
				isSplit: true,
				splits: [
					{ id: 's1', categoryId: 'food', categoryName: 'Food', amount: -3500, memo: '' },
					{ id: 's2', categoryId: 'rta', categoryName: 'Ready to Assign', amount: 500, memo: '' }
				]
			}),
			ctx
		);
		expect(d.splits?.map((s) => s.amount)).toEqual(['35,00', '-5,00']);
		expect(buildTransactionInput(d, ctx)).toMatchObject({ ok: true, input: { amount: -3000 } });
	});

	it('takes a transfer’s category from the on-budget leg', () => {
		const offLeg = row({
			accountId: 'broker',
			amount: 500,
			payeeName: null,
			categoryId: null,
			transferId: 't2',
			transferAccountId: 'checking',
			transferAccountName: 'Checking'
		});
		const onLeg = row({ id: 't2', categoryId: 'food' });
		const d = draftFromTransaction(offLeg, ctx, onLeg);
		expect(d).toMatchObject({
			payee: 'Transfer: Checking',
			categoryId: 'food',
			direction: 'inflow'
		});
		expect(buildTransactionInput(d, ctx)).toMatchObject({
			ok: true,
			input: { accountId: 'broker', amount: 500, transferAccountId: 'checking', categoryId: 'food' }
		});
	});
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test src/lib/transactions`

Expected: FAIL. `./form` does not exist.

- [ ] **Step 3: Implement**

Create `src/lib/transactions/form.ts`:

```ts
import type { Account } from '$lib/db/repos/accounts';
import type { GroupNode } from '$lib/db/repos/categories';
import type { Payee } from '$lib/db/repos/payees';
import type { SplitInput, TransactionInput, TransactionRow } from '$lib/db/repos/transactions';
import { formatAmountInput, parseAmount, type MoneyFormat } from '$lib/domain/money';
import { isDate } from '$lib/domain/month';

export type Direction = 'outflow' | 'inflow';

export interface SplitDraft {
	categoryId: string;
	amount: string; // as typed; follows the transaction's direction (a negative line goes the other way)
	memo: string;
}

/** What the transaction form edits. Amounts are text so arithmetic like "120+35" works. */
export interface TransactionDraft {
	accountId: string;
	date: string;
	payee: string; // a payee name, or a transfer label from FormContext.transferLabel
	categoryId: string; // '' when none
	amount: string; // unsigned, as typed
	direction: Direction;
	memo: string;
	cleared: boolean;
	splits: SplitDraft[] | null; // null when not split
}

export type FormAccount = Pick<Account, 'id' | 'name' | 'type' | 'onBudget' | 'closed'>;

export interface FormContext {
	accounts: FormAccount[];
	payees: Payee[];
	tree: GroupNode[];
	money: MoneyFormat;
	/** How a transfer to or from an account appears in the payee field, e.g. "Transfer: Savings". */
	transferLabel: (accountName: string) => string;
}

export function newDraft(accountId: string, date: string): TransactionDraft {
	return {
		accountId,
		date,
		payee: '',
		categoryId: '',
		amount: '',
		direction: 'outflow',
		memo: '',
		cleared: false,
		splits: null
	};
}

function findAccount(ctx: FormContext, id: string): FormAccount | undefined {
	return ctx.accounts.find((a) => a.id === id);
}

/** Accounts the payee field offers as transfer targets. */
export function transferTargets(draft: TransactionDraft, ctx: FormContext): FormAccount[] {
	return ctx.accounts.filter((a) => !a.closed && a.id !== draft.accountId);
}

/** The account that the payee field's transfer label points at, if it holds one. */
export function transferTarget(draft: TransactionDraft, ctx: FormContext): FormAccount | null {
	const payee = draft.payee.trim();
	return transferTargets(draft, ctx).find((a) => ctx.transferLabel(a.name) === payee) ?? null;
}

/**
 * The on-budget account whose budget the transaction touches, or null when it is budget-neutral:
 * off-budget activity, or a transfer between two accounts on the same side (spec rules 4 and 5).
 */
function budgetLeg(draft: TransactionDraft, ctx: FormContext): FormAccount | null {
	const own = findAccount(ctx, draft.accountId);
	if (!own) return null;
	const other = transferTarget(draft, ctx);
	if (other) {
		if (own.onBudget === other.onBudget) return null;
		return own.onBudget ? own : other;
	}
	return own.onBudget ? own : null;
}

export type CategoryMode = 'required' | 'optional' | 'hidden';

/** Whether the form shows the category field and whether it must be filled. */
export function categoryMode(draft: TransactionDraft, ctx: FormContext): CategoryMode {
	if (draft.splits && canSplit(draft, ctx)) return 'hidden';
	const leg = budgetLeg(draft, ctx);
	if (!leg) return 'hidden';
	if (transferTarget(draft, ctx)) return 'required';
	// Uncategorized card spending is plain debt with no budget effect.
	return leg.type === 'credit_card' ? 'optional' : 'required';
}

/** Splitting is for categorized, non-transfer transactions on on-budget accounts. */
export function canSplit(draft: TransactionDraft, ctx: FormContext): boolean {
	return !!findAccount(ctx, draft.accountId)?.onBudget && !transferTarget(draft, ctx);
}

export interface CategoryOption {
	id: string;
	name: string;
	system: 'ready_to_assign' | null;
}

export interface CategoryOptionGroup {
	id: string;
	name: string;
	system: GroupNode['system'];
	categories: CategoryOption[];
}

/**
 * The categories the form offers: never card payment categories, no hidden ones unless already
 * chosen, and no Ready to Assign when the budget side is a credit card.
 */
export function categoryOptions(draft: TransactionDraft, ctx: FormContext): CategoryOptionGroup[] {
	const chosen = new Set([draft.categoryId, ...(draft.splits ?? []).map((s) => s.categoryId)]);
	const leg = budgetLeg(draft, ctx) ?? findAccount(ctx, draft.accountId);
	const noIncome = leg?.type === 'credit_card';
	return ctx.tree
		.map((g) => ({
			id: g.id,
			name: g.name,
			system: g.system,
			categories: g.categories
				.filter((c) => !c.ccAccountId)
				.filter((c) => !c.hidden || chosen.has(c.id))
				.filter((c) => !(noIncome && c.system === 'ready_to_assign'))
				.map((c) => ({ id: c.id, name: c.name, system: c.system }))
		}))
		.filter((g) => g.categories.length > 0);
}

/** The category to preselect for an existing payee: its most recent one, if the form offers it. */
export function suggestCategory(draft: TransactionDraft, ctx: FormContext): string | null {
	const name = draft.payee.trim().toLocaleLowerCase();
	const payee = ctx.payees.find((p) => p.name.toLocaleLowerCase() === name);
	if (!payee?.lastCategoryId) return null;
	const offered = categoryOptions(draft, ctx).some((g) =>
		g.categories.some((c) => c.id === payee.lastCategoryId)
	);
	return offered ? payee.lastCategoryId : null;
}

function signed(value: number, direction: Direction): number {
	if (value === 0) return 0;
	return direction === 'outflow' ? -value : value;
}

function parseUnsigned(text: string, money: MoneyFormat): number | null {
	const value = parseAmount(text, money);
	return value === null || value < 0 ? null : value;
}

/** What is left to spread over the split lines (signed), or null while an amount is unreadable. */
export function splitRemaining(draft: TransactionDraft, money: MoneyFormat): number | null {
	const total = parseUnsigned(draft.amount, money);
	if (total === null) return null;
	let rest = signed(total, draft.direction);
	for (const line of draft.splits ?? []) {
		if (line.amount.trim() === '') continue;
		const value = parseAmount(line.amount, money);
		if (value === null) return null;
		rest -= signed(value, draft.direction);
	}
	return rest;
}

export type FormError =
	| 'ACCOUNT_REQUIRED'
	| 'DATE_INVALID'
	| 'AMOUNT_INVALID'
	| 'CATEGORY_REQUIRED'
	| 'SPLIT_LINE_INVALID'
	| 'SPLIT_TOO_FEW_LINES'
	| 'SPLIT_SUM_MISMATCH';

export type BuildResult = { ok: true; input: TransactionInput } | { ok: false; error: FormError };

const fail = (error: FormError): BuildResult => ({ ok: false, error });

/** Validates a draft and turns it into the repo's TransactionInput. */
export function buildTransactionInput(draft: TransactionDraft, ctx: FormContext): BuildResult {
	const own = findAccount(ctx, draft.accountId);
	if (!own) return fail('ACCOUNT_REQUIRED');
	if (!isDate(draft.date)) return fail('DATE_INVALID');
	const value = parseUnsigned(draft.amount, ctx.money);
	if (value === null) return fail('AMOUNT_INVALID');
	const amount = signed(value, draft.direction);
	const base = {
		accountId: own.id,
		date: draft.date,
		amount,
		memo: draft.memo.trim(),
		cleared: draft.cleared
	};
	const mode = categoryMode(draft, ctx);
	const categoryId = mode === 'hidden' ? null : draft.categoryId || null;
	if (mode === 'required' && !categoryId) return fail('CATEGORY_REQUIRED');

	const target = transferTarget(draft, ctx);
	if (target) return { ok: true, input: { ...base, transferAccountId: target.id, categoryId } };

	const payeeName = draft.payee.trim() || null;
	if (draft.splits && canSplit(draft, ctx)) {
		if (draft.splits.length < 2) return fail('SPLIT_TOO_FEW_LINES');
		const splits: SplitInput[] = [];
		for (const line of draft.splits) {
			const lineValue = parseAmount(line.amount, ctx.money);
			if (!line.categoryId || lineValue === null) return fail('SPLIT_LINE_INVALID');
			splits.push({
				categoryId: line.categoryId,
				amount: signed(lineValue, draft.direction),
				memo: line.memo.trim()
			});
		}
		if (splits.reduce((sum, s) => sum + s.amount, 0) !== amount) return fail('SPLIT_SUM_MISMATCH');
		return { ok: true, input: { ...base, payeeName, splits } };
	}
	return { ok: true, input: { ...base, payeeName, categoryId } };
}

/**
 * A draft that edits `row`. For a transfer seen from its off-budget leg, pass the other leg as
 * `pair`: the category lives on the on-budget side.
 */
export function draftFromTransaction(
	row: TransactionRow,
	ctx: FormContext,
	pair?: TransactionRow | null
): TransactionDraft {
	const direction: Direction = row.amount < 0 ? 'outflow' : 'inflow';
	const relative = (amount: number) =>
		formatAmountInput(direction === 'outflow' ? -amount : amount, ctx.money);
	return {
		accountId: row.accountId,
		date: row.date,
		payee: row.transferAccountName
			? ctx.transferLabel(row.transferAccountName)
			: (row.payeeName ?? ''),
		categoryId: row.categoryId ?? pair?.categoryId ?? '',
		amount: relative(row.amount),
		direction,
		memo: row.memo,
		cleared: row.cleared,
		splits: row.isSplit
			? row.splits.map((s) => ({
					categoryId: s.categoryId,
					amount: relative(s.amount),
					memo: s.memo
				}))
			: null
	};
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm test src/lib/transactions`

Expected: PASS (34 tests).

- [ ] **Step 5: Format, check and commit**

```bash
pnpm exec prettier --write src/lib/transactions/form.ts src/lib/transactions/form.test.ts
```

Run: `pnpm lint && pnpm check`

Expected: Prettier, ESLint and svelte-check report no problems.

Run: `pnpm test`

Expected: every unit test passes.

```bash
git add src/lib/transactions/form.ts src/lib/transactions/form.test.ts
git commit -m "feat: add the transaction form logic" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```


---


### Task 15: Transaction dialog: add, edit, split and transfer

The phone-first transaction form (spec §5), a bottom sheet on phones and a dialog on desktop. It has account, date (today by default), payee, the Outflow/Inflow toggle with the amount (numeric keypad via `inputmode="decimal"`), category, memo and cleared.

- **Payee:** a text input with a `datalist`. You can pick an existing payee or a transfer target, or type a new name (created on save). Picking a payee fills in its last category.
- **Category:** the field appears only when Task 14's rules call for it.
- **Split:** opens split lines with a live "Remaining" amount. Save stays disabled until the lines add up.

It opens from the floating **+ Transaction** button on every screen (for the current register's account, else the last one used), from the register's button, and from a register row's payee to edit it. Editing offers Delete, which asks for a second tap to confirm.

**Files:**
- Create: `src/lib/components/transactions/TransactionForm.svelte`
- Create: `src/lib/components/transactions/TransactionDialog.svelte`
- Modify: `src/lib/components/app/AppShell.svelte`
- Modify: `src/routes/accounts/[id]/+page.svelte`
- Test: `e2e/money-flow.e2e.ts`

**Interfaces:**
- Consumes: Task 14's form logic; `api.accounts.list`, `api.payees.list`, `api.categories.tree`, `api.transactions.create/update/delete/get` (Plan 1); `ResponsiveDialog` (Task 10); `useSession`, `runAction`, `notifyError` (Task 8); `groupLabel`, `categoryLabel` (Task 4).
- Produces:
  - `<TransactionDialog bind:open accountId? transaction? />` (loads what it needs each time it opens)
  - `<TransactionForm ctx initial editingId onDone />`
  - the `moneta.lastAccount` localStorage key (a convenience only)

- [ ] **Step 1: Write the failing e2e tests**

These cover the spec §9 flow: onboarding → income → assign → spend → card purchase → card payment → correct numbers. They also cover a split recorded from the register.

Create `e2e/money-flow.e2e.ts`:

```ts
import { expect, test, type Page } from '@playwright/test';
import { categoryRow, onboard } from './helpers';

async function addTransaction(
	page: Page,
	t: { account: string; payee: string; amount: string; category?: string; inflow?: boolean }
) {
	await page.getByRole('button', { name: 'Transaction', exact: true }).click();
	const dialog = page.getByRole('dialog');
	await dialog.getByLabel('Account', { exact: true }).selectOption({ label: t.account });
	await dialog.getByLabel('Payee').fill(t.payee);
	if (t.inflow) await dialog.getByRole('button', { name: 'Inflow' }).click();
	await dialog.getByLabel('Amount', { exact: true }).fill(t.amount);
	if (t.category)
		await dialog.getByLabel('Category', { exact: true }).selectOption({ label: t.category });
	await dialog.getByRole('button', { name: 'Save' }).click();
	await expect(dialog).toBeHidden();
}

test('income, assigning, spending, a card purchase and a card payment add up', async ({ page }) => {
	await onboard(page);

	await addTransaction(page, {
		account: 'Checking',
		payee: 'Employer',
		amount: '500',
		category: 'Ready to Assign',
		inflow: true
	});
	await expect(page.getByTestId('rta-amount')).toHaveText('$1,500.00');

	const groceries = categoryRow(page, 'Groceries');
	await groceries.getByTestId('assigned').fill('300');
	await groceries.getByTestId('assigned').press('Enter');
	await expect(page.getByTestId('rta-amount')).toHaveText('$1,200.00');

	await page.getByRole('link', { name: 'Accounts' }).first().click();
	await page.getByRole('button', { name: 'Add account' }).click();
	const dialog = page.getByRole('dialog');
	await dialog.getByLabel('Account name').fill('Visa');
	await dialog.getByLabel('Type').selectOption('credit_card');
	await dialog.getByRole('button', { name: 'Add account' }).click();
	await expect(dialog).toBeHidden();
	await page.getByRole('link', { name: 'Budget' }).first().click();

	await addTransaction(page, {
		account: 'Checking',
		payee: 'Market',
		amount: '50',
		category: 'Groceries'
	});
	await expect(groceries.getByTestId('available')).toHaveText('$250.00');

	await addTransaction(page, {
		account: 'Visa',
		payee: 'Shop',
		amount: '100',
		category: 'Groceries'
	});
	await expect(groceries.getByTestId('available')).toHaveText('$150.00');
	await expect(categoryRow(page, 'Visa').getByTestId('available')).toHaveText('$100.00');

	await addTransaction(page, { account: 'Checking', payee: 'Transfer: Visa', amount: '100' });
	await expect(categoryRow(page, 'Visa').getByTestId('available')).toHaveText('$0.00');
	await expect(page.getByTestId('rta-amount')).toHaveText('$1,200.00');

	const accounts = page.getByTestId('account-row');
	await expect(accounts.filter({ hasText: 'Checking' }).getByTestId('account-balance')).toHaveText(
		'$1,350.00'
	);
	await expect(accounts.filter({ hasText: 'Visa' }).getByTestId('account-balance')).toHaveText(
		'$0.00'
	);
});

test('records a split and shows it in the register', async ({ page }) => {
	await onboard(page);
	await page.getByTestId('account-row').filter({ hasText: 'Checking' }).getByRole('link').click();
	await expect(page.getByTestId('register-title')).toHaveText('Checking');
	await expect(page.getByTestId('register-row')).toHaveCount(1);

	await page.getByRole('button', { name: 'Transaction', exact: true }).first().click();
	const dialog = page.getByRole('dialog');
	await dialog.getByLabel('Payee').fill('Big Store');
	await dialog.getByLabel('Amount', { exact: true }).fill('80');
	await dialog.getByLabel('Category', { exact: true }).selectOption({ label: 'Groceries' });
	await dialog.getByRole('button', { name: 'Split' }).click();
	await dialog.getByLabel('Amount for line 1').fill('50');
	await expect(dialog.getByTestId('split-remaining')).toHaveText('Remaining: $30.00');
	await expect(dialog.getByRole('button', { name: 'Save' })).toBeDisabled();
	await dialog.getByLabel('Category for line 2').selectOption({ label: 'Household' });
	await dialog.getByLabel('Amount for line 2').fill('30');
	await dialog.getByRole('button', { name: 'Save' }).click();
	await expect(dialog).toBeHidden();

	const row = page.getByTestId('register-row').filter({ hasText: 'Big Store' });
	await expect(row.getByTestId('register-amount')).toHaveText('-$80.00');
	await row.getByRole('button', { name: 'Split (2)' }).click();
	await expect(row.getByText('Household')).toBeVisible();
	await expect(page.getByTestId('register-balance')).toHaveText('$920.00');
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm test:e2e e2e/money-flow.e2e.ts`

Expected: FAIL. There is no "Transaction" button.

- [ ] **Step 3: Add the form and the dialog**

Create `src/lib/components/transactions/TransactionForm.svelte`:

```svelte
<script lang="ts">
	import PlusIcon from '@lucide/svelte/icons/plus';
	import XIcon from '@lucide/svelte/icons/x';
	import { Button } from '$lib/components/ui/button';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import {
		NativeSelect,
		NativeSelectOptGroup,
		NativeSelectOption
	} from '$lib/components/ui/native-select';
	import { useSession } from '$lib/client/app-state.svelte';
	import { runAction } from '$lib/client/notify';
	import { groupLabel, categoryLabel } from '$lib/i18n/labels';
	import { m } from '$lib/paraglide/messages';
	import {
		buildTransactionInput,
		canSplit,
		categoryMode,
		categoryOptions,
		splitRemaining,
		suggestCategory,
		transferTarget,
		transferTargets,
		type FormContext,
		type FormError,
		type TransactionDraft
	} from '$lib/transactions/form';

	let {
		ctx,
		initial,
		editingId,
		onDone
	}: {
		ctx: FormContext;
		initial: TransactionDraft;
		editingId: string | null;
		onDone: (savedAccountId: string | null) => void;
	} = $props();

	const session = useSession();
	// The dialog re-creates this form (with {#key}) for every transaction it opens.
	// svelte-ignore state_referenced_locally
	let draft = $state(structuredClone(initial));
	let error = $state<string | null>(null);
	let busy = $state(false);
	let confirmDelete = $state(false);

	const openAccounts = $derived(ctx.accounts.filter((a) => !a.closed || a.id === draft.accountId));
	const mode = $derived(categoryMode(draft, ctx));
	const options = $derived(categoryOptions(draft, ctx));
	const splittable = $derived(canSplit(draft, ctx));
	const remaining = $derived(draft.splits ? splitRemaining(draft, ctx.money) : 0);
	const isTransfer = $derived(transferTarget(draft, ctx) !== null);

	const FORM_ERRORS: Record<FormError, () => string> = {
		ACCOUNT_REQUIRED: m.form_error_account_required,
		DATE_INVALID: m.form_error_date_invalid,
		AMOUNT_INVALID: m.form_error_amount_invalid,
		CATEGORY_REQUIRED: m.error_category_required,
		SPLIT_LINE_INVALID: m.form_error_split_line_invalid,
		SPLIT_TOO_FEW_LINES: m.error_split_too_few_lines,
		SPLIT_SUM_MISMATCH: m.error_split_sum_mismatch
	};

	function payeeChanged() {
		if (mode === 'hidden' || draft.categoryId) return;
		draft.categoryId = suggestCategory(draft, ctx) ?? '';
	}

	function startSplit() {
		draft.splits = [
			{ categoryId: draft.categoryId, amount: draft.amount, memo: '' },
			{ categoryId: '', amount: '', memo: '' }
		];
		draft.categoryId = '';
	}

	function removeLine(index: number) {
		if (!draft.splits) return;
		draft.splits.splice(index, 1);
		if (draft.splits.length === 0) draft.splits = null;
	}

	async function save(event: SubmitEvent) {
		event.preventDefault();
		const result = buildTransactionInput(draft, ctx);
		if (!result.ok) {
			error = FORM_ERRORS[result.error]();
			return;
		}
		busy = true;
		error = await runAction(() =>
			editingId
				? session.api.transactions.update(editingId, result.input)
				: session.api.transactions.create(result.input)
		);
		busy = false;
		if (!error) onDone(result.input.accountId);
	}

	async function remove() {
		if (!editingId) return;
		if (!confirmDelete) {
			confirmDelete = true;
			return;
		}
		const id = editingId;
		error = await runAction(() => session.api.transactions.delete(id));
		if (!error) onDone(null);
	}
</script>

{#snippet categorySelect(value: string, onChange: (id: string) => void, id: string, label: string)}
	<NativeSelect
		{id}
		class="w-full"
		{value}
		aria-label={label}
		onchange={(e) => onChange(e.currentTarget.value)}
	>
		<NativeSelectOption value="">
			{mode === 'optional' ? m.transaction_no_category() : m.transaction_choose_category()}
		</NativeSelectOption>
		{#each options as group (group.id)}
			<NativeSelectOptGroup label={groupLabel(group)}>
				{#each group.categories as category (category.id)}
					<NativeSelectOption value={category.id}>{categoryLabel(category)}</NativeSelectOption>
				{/each}
			</NativeSelectOptGroup>
		{/each}
	</NativeSelect>
{/snippet}

<form class="grid gap-4" onsubmit={save}>
	<div class="grid grid-cols-2 gap-3">
		<div class="grid gap-2">
			<Label for="txn-account">{m.transaction_account()}</Label>
			<NativeSelect id="txn-account" class="w-full" bind:value={draft.accountId}>
				{#each openAccounts as account (account.id)}
					<NativeSelectOption value={account.id}>{account.name}</NativeSelectOption>
				{/each}
			</NativeSelect>
		</div>
		<div class="grid gap-2">
			<Label for="txn-date">{m.transaction_date()}</Label>
			<Input id="txn-date" type="date" bind:value={draft.date} required />
		</div>
	</div>

	<div class="grid gap-2">
		<Label for="txn-payee">{m.transaction_payee()}</Label>
		<Input
			id="txn-payee"
			list="txn-payees"
			autocomplete="off"
			bind:value={draft.payee}
			onchange={payeeChanged}
		/>
		<datalist id="txn-payees">
			{#each transferTargets(draft, ctx) as account (account.id)}
				<option value={ctx.transferLabel(account.name)}></option>
			{/each}
			{#each ctx.payees as payee (payee.id)}
				<option value={payee.name}></option>
			{/each}
		</datalist>
	</div>

	<div class="grid gap-2">
		<span class="text-sm font-medium">{m.transaction_amount()}</span>
		<div class="grid grid-cols-[auto_1fr] gap-2">
			<div class="flex rounded-md border p-0.5" role="group" aria-label={m.transaction_direction()}>
				<Button
					size="sm"
					variant={draft.direction === 'outflow' ? 'secondary' : 'ghost'}
					aria-pressed={draft.direction === 'outflow'}
					onclick={() => (draft.direction = 'outflow')}>{m.transaction_outflow()}</Button
				>
				<Button
					size="sm"
					variant={draft.direction === 'inflow' ? 'secondary' : 'ghost'}
					aria-pressed={draft.direction === 'inflow'}
					onclick={() => (draft.direction = 'inflow')}>{m.transaction_inflow()}</Button
				>
			</div>
			<Input
				id="txn-amount"
				bind:value={draft.amount}
				inputmode="decimal"
				autocomplete="off"
				aria-label={m.transaction_amount()}
				placeholder="0"
				required
			/>
		</div>
	</div>

	{#if mode !== 'hidden'}
		<div class="grid gap-2">
			<Label for="txn-category">{m.transaction_category()}</Label>
			<div class="flex gap-2">
				{@render categorySelect(
					draft.categoryId,
					(id) => (draft.categoryId = id),
					'txn-category',
					m.transaction_category()
				)}
				{#if splittable && !isTransfer}
					<Button variant="outline" onclick={startSplit}>{m.transaction_split()}</Button>
				{/if}
			</div>
		</div>
	{/if}

	{#if draft.splits && splittable}
		<fieldset class="grid gap-2 rounded-md border p-3">
			<legend class="px-1 text-sm font-medium">{m.transaction_split_lines()}</legend>
			{#each draft.splits as line, i (i)}
				<div class="grid grid-cols-[1fr_7rem_auto] gap-2">
					{@render categorySelect(
						line.categoryId,
						(id) => (line.categoryId = id),
						`txn-split-${i}`,
						m.transaction_split_category({ line: i + 1 })
					)}
					<Input
						bind:value={line.amount}
						inputmode="decimal"
						autocomplete="off"
						aria-label={m.transaction_split_amount({ line: i + 1 })}
					/>
					<Button
						variant="ghost"
						size="icon"
						aria-label={m.transaction_split_remove({ line: i + 1 })}
						onclick={() => removeLine(i)}><XIcon /></Button
					>
					<Input
						class="col-span-3"
						bind:value={line.memo}
						placeholder={m.transaction_memo()}
						aria-label={m.transaction_split_memo({ line: i + 1 })}
					/>
				</div>
			{/each}
			<div class="flex items-center justify-between gap-2">
				<Button
					variant="ghost"
					size="sm"
					onclick={() => draft.splits?.push({ categoryId: '', amount: '', memo: '' })}
				>
					<PlusIcon />{m.transaction_split_add()}
				</Button>
				<span
					class="text-sm tabular-nums {remaining === 0
						? 'text-muted-foreground'
						: 'text-destructive'}"
					data-testid="split-remaining"
				>
					{remaining === null
						? m.form_error_amount_invalid()
						: m.transaction_split_remaining({ amount: session.format(Math.abs(remaining)) })}
				</span>
			</div>
		</fieldset>
	{/if}

	<div class="grid gap-2">
		<Label for="txn-memo">{m.transaction_memo()}</Label>
		<Input id="txn-memo" bind:value={draft.memo} autocomplete="off" />
	</div>

	<div class="flex items-center gap-2">
		<Checkbox id="txn-cleared" bind:checked={draft.cleared} />
		<Label for="txn-cleared">{m.transaction_cleared()}</Label>
	</div>

	{#if error}<p class="text-sm text-destructive" role="alert">{error}</p>{/if}

	<div class="flex flex-wrap justify-end gap-2">
		{#if editingId}
			<Button variant="destructive" class="mr-auto" onclick={remove}>
				{confirmDelete ? m.confirm_delete() : m.delete()}
			</Button>
		{/if}
		<Button variant="ghost" onclick={() => onDone(null)}>{m.cancel()}</Button>
		<Button
			type="submit"
			disabled={busy || (draft.splits !== null && splittable && remaining !== 0)}
		>
			{m.save()}
		</Button>
	</div>
</form>
```

Create `src/lib/components/transactions/TransactionDialog.svelte`:

```svelte
<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import ResponsiveDialog from '$lib/components/ResponsiveDialog.svelte';
	import { useSession } from '$lib/client/app-state.svelte';
	import { notifyError } from '$lib/client/notify';
	import type { TransactionRow } from '$lib/db/repos/transactions';
	import { todayIso } from '$lib/domain/month';
	import { m } from '$lib/paraglide/messages';
	import {
		draftFromTransaction,
		newDraft,
		type FormContext,
		type TransactionDraft
	} from '$lib/transactions/form';
	import TransactionForm from './TransactionForm.svelte';

	/**
	 * Adds a transaction, or edits `transaction`. The accounts, payees and categories it offers are
	 * loaded each time it opens.
	 */
	let {
		open = $bindable(false),
		accountId,
		transaction = null
	}: { open: boolean; accountId?: string; transaction?: TransactionRow | null } = $props();

	const session = useSession();
	const LAST_ACCOUNT_KEY = 'moneta.lastAccount';

	let ctx = $state.raw<FormContext | null>(null);
	let initial = $state.raw<TransactionDraft | null>(null);

	function readLastAccount(): string | null {
		try {
			return localStorage.getItem(LAST_ACCOUNT_KEY);
		} catch {
			return null;
		}
	}

	function rememberAccount(id: string) {
		try {
			localStorage.setItem(LAST_ACCOUNT_KEY, id);
		} catch {
			// Only a convenience.
		}
	}

	async function load(editing: TransactionRow | null, preferredAccount: string | undefined) {
		ctx = null;
		initial = null;
		try {
			const [accounts, payees, tree] = await Promise.all([
				session.api.accounts.list(),
				session.api.payees.list(),
				session.api.categories.tree()
			]);
			const context: FormContext = {
				accounts,
				payees,
				tree,
				money: session.money,
				transferLabel: (account) => m.transfer_payee({ account })
			};
			if (editing) {
				const pair =
					editing.transferId && editing.categoryId === null
						? await session.api.transactions.get(editing.transferId)
						: null;
				initial = draftFromTransaction(editing, context, pair);
			} else {
				const open = accounts.filter((a) => !a.closed);
				const pick =
					[preferredAccount, readLastAccount()].find((id) => open.some((a) => a.id === id)) ??
					open[0]?.id ??
					'';
				initial = newDraft(pick, todayIso());
			}
			ctx = context;
		} catch (err) {
			notifyError(err);
			open = false;
		}
	}

	$effect(() => {
		if (open) void load(transaction, accountId);
	});
</script>

<ResponsiveDialog
	bind:open
	title={transaction ? m.transaction_edit_title() : m.transaction_add_title()}
>
	{#if ctx && initial}
		{#if ctx.accounts.some((a) => !a.closed)}
			{#key initial}
				<TransactionForm
					{ctx}
					{initial}
					editingId={transaction?.id ?? null}
					onDone={(savedAccountId) => {
						if (savedAccountId) rememberAccount(savedAccountId);
						open = false;
					}}
				/>
			{/key}
		{:else}
			<p class="text-muted-foreground">{m.transaction_no_accounts()}</p>
			<Button variant="outline" onclick={() => (open = false)}>{m.close()}</Button>
		{/if}
	{:else}
		<p class="text-muted-foreground" role="status">{m.startup_loading()}</p>
	{/if}
</ResponsiveDialog>
```

- [ ] **Step 4: Open it from the shell and the register**

Replace `src/lib/components/app/AppShell.svelte` (adds the floating button and the dialog):

```svelte
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import LandmarkIcon from '@lucide/svelte/icons/landmark';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import WalletIcon from '@lucide/svelte/icons/wallet';
	import { Button } from '$lib/components/ui/button';
	import AccountList from '$lib/components/accounts/AccountList.svelte';
	import TransactionDialog from '$lib/components/transactions/TransactionDialog.svelte';
	import { useSession } from '$lib/client/app-state.svelte';
	import { useLive } from '$lib/client/live.svelte';
	import { currentMonth } from '$lib/domain/month';
	import { m } from '$lib/paraglide/messages';

	let { children }: { children: Snippet } = $props();

	const session = useSession();
	const accounts = useLive(session.client, ['accounts', 'transactions'], () =>
		session.api.accounts.list()
	);

	const path = $derived(page.url.pathname);
	const nav = $derived([
		{
			href: resolve('/budget/[month]', { month: currentMonth() }),
			label: m.nav_budget(),
			icon: WalletIcon,
			active: path.startsWith('/budget')
		},
		{
			href: resolve('/accounts'),
			label: m.nav_accounts(),
			icon: LandmarkIcon,
			active: path.startsWith('/accounts')
		},
		{
			href: resolve('/settings'),
			label: m.nav_settings(),
			icon: SettingsIcon,
			active: path.startsWith('/settings')
		}
	]);

	let adding = $state(false);
</script>

<div class="flex min-h-dvh">
	<aside
		class="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-6 overflow-y-auto border-r bg-sidebar p-3 text-sidebar-foreground md:flex"
	>
		<div class="px-2 pt-2">
			<p class="text-lg font-semibold">{m.app_name()}</p>
			<p class="truncate text-sm text-muted-foreground">{session.meta.name}</p>
		</div>
		<nav class="grid gap-1" aria-label={m.nav_label()}>
			{#each nav as item (item.label)}
				<a
					href={item.href}
					aria-current={item.active ? 'page' : undefined}
					class="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-sidebar-accent aria-[current=page]:bg-sidebar-accent aria-[current=page]:font-medium"
				>
					<item.icon class="size-4" />
					{item.label}
				</a>
			{/each}
		</nav>
		<AccountList accounts={accounts.data ?? []} />
	</aside>

	<main class="min-w-0 flex-1 pb-32 md:pb-24">{@render children()}</main>

	<Button
		class="fixed right-4 bottom-20 z-40 rounded-full shadow-lg md:bottom-6"
		size="lg"
		onclick={() => (adding = true)}
	>
		<PlusIcon />
		{m.add_transaction()}
	</Button>

	<nav
		class="fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
		aria-label={m.nav_label()}
	>
		{#each nav as item (item.label)}
			<a
				href={item.href}
				aria-current={item.active ? 'page' : undefined}
				class="flex flex-col items-center gap-0.5 py-2 text-xs text-muted-foreground aria-[current=page]:text-foreground"
			>
				<item.icon class="size-5" />
				{item.label}
			</a>
		{/each}
	</nav>
</div>

<TransactionDialog bind:open={adding} accountId={page.params.id} />
```

Replace `src/routes/accounts/[id]/+page.svelte` (adds the add button and row editing):

```svelte
<script lang="ts">
	import { page } from '$app/state';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import RegisterRow from '$lib/components/accounts/RegisterRow.svelte';
	import TransactionDialog from '$lib/components/transactions/TransactionDialog.svelte';
	import { PAGE_SIZE, registerBalances } from '$lib/accounts/register';
	import { useSession } from '$lib/client/app-state.svelte';
	import { useLive } from '$lib/client/live.svelte';
	import type { TransactionRow } from '$lib/db/repos/transactions';
	import { errorMessage } from '$lib/i18n/errors';
	import { m } from '$lib/paraglide/messages';

	const accountId = $derived(page.params.id ?? '');
	const session = useSession();

	let searchInput = $state('');
	let search = $state('');
	let from = $state('');
	let to = $state('');
	let pages = $state(1);

	// Search as the user types, but not on every keystroke.
	$effect(() => {
		const text = searchInput;
		const timer = setTimeout(() => (search = text), 250);
		return () => clearTimeout(timer);
	});

	const account = useLive(session.client, ['accounts', 'transactions'], () =>
		session.api.accounts.get(accountId)
	);
	const rows = useLive(
		session.client,
		['transactions', 'transaction_splits', 'payees', 'categories', 'accounts'],
		() =>
			session.api.transactions.list({
				accountId,
				search: search || undefined,
				from: from || undefined,
				to: to || undefined,
				limit: pages * PAGE_SIZE
			})
	);
	const balances = $derived(account.data ? registerBalances(account.data) : null);
	const hasMore = $derived((rows.data?.length ?? 0) >= pages * PAGE_SIZE);

	let dialogOpen = $state(false);
	let editing = $state<TransactionRow | null>(null);

	function add() {
		editing = null;
		dialogOpen = true;
	}

	function edit(row: TransactionRow) {
		editing = row;
		dialogOpen = true;
	}
</script>

<div class="mx-auto grid max-w-6xl gap-4 p-3 md:p-6">
	{#if account.error && !account.data}
		<p class="text-destructive" role="alert">{errorMessage(account.error)}</p>
	{:else if account.data && balances}
		<header class="flex flex-wrap items-end justify-between gap-3">
			<div>
				<h1 class="text-xl font-semibold" data-testid="register-title">{account.data.name}</h1>
				<dl class="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
					<div class="flex gap-1">
						<dt class="text-muted-foreground">{m.register_cleared_balance()}</dt>
						<dd class="tabular-nums">{session.format(balances.cleared)}</dd>
					</div>
					<div class="flex gap-1">
						<dt class="text-muted-foreground">{m.register_uncleared_balance()}</dt>
						<dd class="tabular-nums">{session.format(balances.uncleared)}</dd>
					</div>
					<div class="flex gap-1">
						<dt class="text-muted-foreground">{m.register_total_balance()}</dt>
						<dd class="font-medium tabular-nums" data-testid="register-balance">
							{session.format(balances.total)}
						</dd>
					</div>
				</dl>
			</div>
			{#if !account.data.closed}
				<Button onclick={add}><PlusIcon />{m.add_transaction()}</Button>
			{/if}
		</header>

		<div class="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
			<Input
				type="search"
				bind:value={searchInput}
				placeholder={m.register_search()}
				aria-label={m.register_search()}
			/>
			<div class="flex items-center gap-2">
				<Label for="register-from" class="text-sm text-muted-foreground">{m.register_from()}</Label>
				<Input id="register-from" type="date" bind:value={from} />
			</div>
			<div class="flex items-center gap-2">
				<Label for="register-to" class="text-sm text-muted-foreground">{m.register_to()}</Label>
				<Input id="register-to" type="date" bind:value={to} />
			</div>
		</div>

		<section class="rounded-lg border" aria-label={m.register_transactions()}>
			{#each rows.data ?? [] as row (row.id)}
				<RegisterRow {row} onEdit={edit} />
			{:else}
				{#if rows.data}
					<p class="p-6 text-center text-muted-foreground">{m.register_empty()}</p>
				{/if}
			{/each}
		</section>
		{#if hasMore}
			<Button variant="outline" onclick={() => pages++}>{m.register_load_more()}</Button>
		{/if}
	{/if}
</div>

<TransactionDialog bind:open={dialogOpen} {accountId} transaction={editing} />
<svelte:head><title>{account.data?.name ?? m.nav_accounts()} · {m.app_name()}</title></svelte:head>
```

- [ ] **Step 5: Run the whole e2e suite to verify it passes**

Run: `pnpm test:e2e`

Expected: PASS (12 tests).

- [ ] **Step 6: Format, check and commit**

```bash
pnpm exec prettier --write src/lib/components/transactions/TransactionForm.svelte src/lib/components/transactions/TransactionDialog.svelte src/lib/components/app/AppShell.svelte 'src/routes/accounts/[id]/+page.svelte' e2e/money-flow.e2e.ts
```

Run: `pnpm lint && pnpm check`

Expected: Prettier, ESLint and svelte-check report no problems.

Run: `pnpm test`

Expected: every unit test passes.

```bash
git add src/lib/components/transactions/TransactionForm.svelte src/lib/components/transactions/TransactionDialog.svelte src/lib/components/app/AppShell.svelte 'src/routes/accounts/[id]/+page.svelte' e2e/money-flow.e2e.ts
git commit -m "feat: add, edit, split and transfer transactions" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```


---


### Task 16: Record the rulings and update the docs

The spec gains the Plan 2 rulings, the follow-ups file marks the Plan 2 items (and the Plan 3 smoke-route item) done, and the README describes the new layout and the translations workflow.

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-09-19-moneta-v1-design.md`
- Modify: `docs/superpowers/plans/2026-09-19-moneta-plan-1-followups.md`

**Interfaces:**
- Consumes: everything above.
- Produces:
  - docs only

- [ ] **Step 1: Update the spec**

In `docs/superpowers/specs/2026-09-19-moneta-v1-design.md`, replace:

```markdown
- **One budget = one SQLite file** in OPFS (`budget-<uuid>.sqlite3`). A small registry (localStorage, mirrored to an OPFS JSON file) lists budgets and the last one opened. Switching budgets closes and reopens the DB in the worker.
```

with:

```markdown
- **One budget = one SQLite file** in OPFS (`budget-<uuid>.sqlite3`). A small registry in localStorage lists budgets and the last one opened. It is a cache: if it is lost, it is rebuilt from the worker's file list and each file's `meta` name. Switching budgets closes and reopens the DB in the worker.
```

Then replace:

```markdown
1. **Income** is a transaction categorized to the system `Ready to Assign` category.
```

with:

```markdown
1. **Income** is a transaction categorized to the system `Ready to Assign` category. Ready to Assign can't be used on credit card accounts (`CATEGORY_NOT_ALLOWED`): income on a card would pay down debt without adding cash, so record it in a cash account and pay the card.
```

Then replace:

```markdown
6. **Credit card accounts:** creating one automatically creates `CC Payment: <name>` in the system `Credit Card Payments` group. Closing the card hides the category. An account (any type) can be deleted only when it has no transactions; otherwise it can be closed, and closing requires a zero balance.
```

with:

```markdown
6. **Credit card accounts:** creating one automatically creates `CC Payment: <name>` in the system `Credit Card Payments` group. Closing the card hides the category, so closing also requires the category's available to be 0 (`CC_PAYMENT_NOT_EMPTY`). An account (any type) can be deleted only when it has no transactions; otherwise it can be closed, and closing requires a zero balance.
```

Then replace:

```markdown
- Group rows show subtotals. Reorder by drag on desktop and via an "edit order" mode on mobile. Hidden categories go in a collapsible section.
```

with:

```markdown
- Group rows show subtotals. Reorder by drag on desktop and via an "edit order" mode on mobile. The Credit Card Payments group always comes first and can't be moved. Hidden categories go in a collapsible section.
```

Then replace:

```markdown
- Split rows expand to show their parts. A transfer row links to its counterpart.
```

with:

```markdown
- Split rows expand to show their parts. Transfers store no payee: a transfer row shows "Transfer to/from ‹account›" and links to that account.
```

Then replace:

```markdown
Name the budget, pick the currency and locale, create the first account with its starting balance, and seed a default, translated category set that can be edited.
```

with:

```markdown
Name the budget, pick the currency and locale, create the first account with its starting balance, and seed a default, translated category set that can be edited. Loan and investment accounts default to off-budget, here and when adding accounts later.
```

Then replace:

```markdown
- **Domain errors** have typed codes (`SPLIT_SUM_MISMATCH`, `ACCOUNT_HAS_TRANSACTIONS`, `ACCOUNT_BALANCE_NOT_ZERO`, `CATEGORY_REQUIRED`, `SYSTEM_ENTITY_READONLY`, ...), are mapped to i18n messages, and appear inline on forms.
```

with:

```markdown
- **Domain errors** have typed codes (`SPLIT_SUM_MISMATCH`, `ACCOUNT_HAS_TRANSACTIONS`, `ACCOUNT_BALANCE_NOT_ZERO`, `CC_PAYMENT_NOT_EMPTY`, `CATEGORY_REQUIRED`, `SYSTEM_ENTITY_READONLY`, ...), are mapped to i18n messages, and appear inline on forms.
```

- [ ] **Step 2: Update the follow-ups**

Replace `docs/superpowers/plans/2026-09-19-moneta-plan-1-followups.md`:

```markdown
# Moneta Plan 1: Follow-ups for Plans 2 and 3

Plan 1 (headless core) is complete: 142 unit tests and 1 browser e2e test. Its reviews deferred the items below to the plans whose UI or infrastructure exposes them.

## Plan 2 (app UI): done

Plan 2 (`2026-09-19-moneta-plan-2-app-ui.md`) resolved every item:

- **Month range:** `isMonth` accepts only the years 1900–2199, like `isDate`.
- **Amount parsing:** `parseAmount` rejects mixed or misplaced separators, more decimals than the currency has, and any letters except the budget currency's own symbol or code.
- **RPC failure paths:** arguments are sent as `$state.snapshot` copies; a message that can't be sent rejects with `INTERNAL`; worker `error`/`messageerror` rejects every pending and later call with `WORKER_FAILED` and shows a full-screen "Reload".
- **Closing a credit card** also requires its payment category's available to be 0 (`CC_PAYMENT_NOT_EMPTY`).
- **Spec decisions** (now recorded in the spec):
  - Ready to Assign can't be used on credit card accounts (`CATEGORY_NOT_ALLOWED`).
  - Loan and investment accounts default to off-budget.
  - Transfers show as "Transfer to/from ‹account›" in the register, and as "Transfer: ‹account›" in the payee field.
  - The system groups keep their place (Income, then Credit Card Payments) whatever order is saved.

## Plan 3 (reports, backup, PWA)

- **Pre-migration backup (spec §7), and SAH pool capacity:** call `reserveMinimumCapacity` before creating backup copies, since the initial capacity is 12. This must land before any `0002_*.sql` migration.
- **Migrations that rebuild tables** need `PRAGMA foreign_keys = OFF` outside the transaction. The current `migrate` loop can't do that.
- **Performance:** measure the budget recompute. Every read reloads all history; that's fine at MVP scale.
- ~~**Dev smoke route**~~: done in Plan 2. The route and its test were removed; the app's own e2e tests cover the worker, OPFS persistence and RPC.
- **Budget files UI:** the registry (`src/lib/client/registry.ts`) and `createBudget` (`src/lib/client/session.ts`) are ready for Settings → Budget files. Switching budgets means closing the worker's database, opening the other file, and replacing `AppState.session` (the shell is keyed on the file).

## Accepted as-is

- The carryover-overspending toggle isn't time-scoped. Flipping it recomputes past months.
```

- [ ] **Step 3: Update the README**

In `README.md`, replace:

```markdown
> **Status:** the headless core (budget engine, database, typed RPC to the SQLite worker) is done. The app UI, reports, backup and the PWA shell come next. See `docs/superpowers/specs/` for the design and `docs/superpowers/plans/` for the implementation plans.
```

with:

```markdown
> **Status:** the core (budget engine, database, typed RPC to the SQLite worker) and the app UI (budget, accounts, register, transactions, in English and Brazilian Portuguese) are done. Reports, backup/restore and the installable PWA come next. See `docs/superpowers/specs/` for the design and `docs/superpowers/plans/` for the implementation plans.
```

Then replace:

```markdown

## Linting and formatting
```

with:

```markdown

## Translations

UI text lives in `src/lib/i18n/messages/en.json` and `pt-BR.json` and is compiled by [Paraglide](https://inlang.com/m/gerre34r/library-inlang-paraglideJs) into `src/lib/paraglide/` (generated, not committed). `pnpm dev`, `pnpm build` and `pnpm check` compile it; `pnpm i18n` does it on its own. Compiling downloads Paraglide's message-format plugins from jsDelivr the first time, so the first build needs a network connection.

## Linting and formatting
```

Then replace:

```markdown
End-to-end tests run the production build in Chromium with Playwright:
```

with:

```markdown
End-to-end tests (in `e2e/`) run the production build in Chromium with Playwright:
```

Then replace:

```markdown
src/lib/domain/   pure TypeScript: money, months, budget engine, quick-assign
src/lib/db/       SQLite side (runs in a Web Worker): schema, migrations, repositories, RPC dispatcher
src/lib/client/   main-thread side: typed RPC client and live-query stores
src/routes/       SvelteKit pages
docs/superpowers/ design spec and implementation plans
```

with:

```markdown
src/lib/domain/        pure TypeScript: money, months, budget engine, quick-assign
src/lib/db/            SQLite side (runs in a Web Worker): schema, migrations, repositories, RPC dispatcher
src/lib/client/        main-thread side: RPC client, live queries, tab lock, budget registry and session
src/lib/budget/        budget screen logic (grid model, category order)
src/lib/accounts/      account and register logic
src/lib/transactions/  transaction form logic
src/lib/i18n/          message catalogs (en, pt-BR), error messages, labels and formats
src/lib/components/    Svelte components (ui/ holds the shadcn-svelte primitives)
src/routes/            SvelteKit pages
e2e/                   Playwright tests
docs/superpowers/      design spec and implementation plans
```

- [ ] **Step 4: Verify everything and commit**

```bash
pnpm exec prettier --write README.md docs/superpowers/specs/2026-09-19-moneta-v1-design.md docs/superpowers/plans/2026-09-19-moneta-plan-1-followups.md
```

Run: `pnpm lint && pnpm check && pnpm test && pnpm test:e2e`

Expected: no lint or type problems, every unit test passes, and all 12 e2e tests pass.

Run: `git status --short`

Expected: only the three docs are modified.

```bash
git add README.md docs/superpowers/specs/2026-09-19-moneta-v1-design.md docs/superpowers/plans/2026-09-19-moneta-plan-1-followups.md
git commit -m "docs: record the Plan 2 rulings and describe the app UI" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```



---

## Spec coverage

| Spec requirement | Where |
| --- | --- |
| §2 single-tab ownership, "open in another tab" screen with takeover | Tasks 3, 6, 8 |
| §2 persistence request on first run | Task 8 (onboarding) |
| §2 budget registry, one file per budget | Tasks 5, 7 |
| §2 reactivity through changed tables | Task 9 (`useLive`) |
| §3 rules 1, 4, 5, 6 as refined by the rulings | Tasks 2, 14 |
| §4 Ready to Assign breakdown, future-month warning | Task 9 |
| §4 quick-assign (category and group) | Task 10 |
| §5 mobile bottom nav, desktop sidebar with balances, + Transaction button, light/dark theme | Tasks 4, 12, 15 |
| §5 budget screen: month picker, grid, pills, inline Assigned with arithmetic, category sheet, move money, subtotals, hidden section | Tasks 9, 10 |
| §5 reorder (drag on desktop, edit-order mode), category settings | Task 11 |
| §5 accounts page sections, register with search, dates, cleared toggle, balances, splits, transfer links | Tasks 12, 13 |
| §5 transaction form: fields, payee create and suggest, transfers, splits with remaining | Tasks 14, 15 |
| §5 Settings → App (language, theme) | Task 13 |
| §5 onboarding with translated categories | Tasks 4, 7, 8 |
| §6 typed domain errors mapped to i18n and shown inline; unexpected errors as a toast with "copy details"; worker failure → Reload; startup failure screens | Tasks 3, 4, 7, 8 |
| §9 unit tests for the new logic; e2e onboarding → income → assign → spend → card purchase → card payment; second tab blocked | Tasks 1–15 |
| Plan 1 follow-ups for Plan 2 (month range, amount parsing, RPC failure paths, closing cards, four rulings) | Tasks 1, 2, 3, 7, 12, 14 |

Left for Plan 3, as the spec's plan split intends: reports (§5), Settings → budget files, budget details, backup and storage (§5), backup/export/restore and restore validation (§6), pre-migration backups (§7), the PWA (§8), and the export/restore and offline e2e flows (§9).
