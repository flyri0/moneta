<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { SvelteSet } from 'svelte/reactivity';
	import { Button } from '$ui/button';
	import FormMessage from '$components/FormMessage.svelte';
	import LoadingRows from '$components/LoadingRows.svelte';
	import Delayed from '$components/Delayed.svelte';
	import CategoryCombobox from '$features/transactions/CategoryCombobox.svelte';
	import RuleDialog from '$features/payees/RuleDialog.svelte';
	import { ruleDraft, type RuleDraft, type SavedRule } from '$features/payees/rules';
	import { NewCategories, withCategoryIds } from '$features/transactions/new-categories';
	import { useSession } from '$client/app-state.svelte';
	import { useLive } from '$client/live.svelte';
	import { actionError, runAction, type ActionError } from '$client/notify';
	import { offerUndo } from '$client/undo';
	import type { Account } from '$db/repos/accounts';
	import type { StatementLine } from '$db/repos/imports';
	import { m } from '$i18n/paraglide/messages';
	import ImportRow from './ImportRow.svelte';
	import { importHandoff } from './pending.svelte';
	import {
		applyRule,
		fillCategories,
		importLines,
		reviewCounts,
		reviewRows,
		type ReviewRow
	} from './review';
	import type { Statement } from './statement';

	/**
	 * Reviews statement lines before importing them into `account`: which to import, their payees
	 * and, for new ones in an on-budget account, their categories. Lines already imported are left
	 * out; lines matching a transaction entered by hand mark it cleared instead.
	 */
	let {
		account,
		lines,
		csvFormat,
		balance
	}: {
		account: Account;
		lines: StatementLine[];
		/** The CSV mapping to remember for the account, or undefined for an OFX file. */
		csvFormat: string | undefined;
		balance: Statement['balance'];
	} = $props();

	const session = useSession();
	const tree = useLive(session.client, ['categories', 'category_groups'], () =>
		session.api.categories.tree()
	);

	let rows = $state<ReviewRow[] | null>(null);
	let loadError = $state<ActionError | null>(null);
	let error = $state<ActionError | null>(null);
	let busy = $state(false);
	let bulkCategory = $state('');
	const pending = new NewCategories();
	const payees = useLive(session.client, ['payees'], () => session.api.payees.list());
	const payeeNames = $derived((payees.data ?? []).map((p) => p.name));

	/** The rule being made from a line, and that line's description. */
	let ruleOpen = $state(false);
	let rule = $state<{ initial: RuleDraft; sample: string } | null>(null);

	function makeRule(row: ReviewRow) {
		rule = {
			initial: ruleDraft(
				row.line.description,
				row.payeeName.trim(),
				NewCategories.isToken(row.categoryId) ? '' : row.categoryId
			),
			sample: row.line.description
		};
		ruleOpen = true;
	}

	/** A rule made here applies at once to the other lines it catches. */
	function ruleSaved(saved: SavedRule) {
		if (rows) applyRule(rows, saved);
	}

	/** The lines opened to show their details, by import id. */
	const open = new SvelteSet<string>();

	function toggle(importId: string) {
		if (open.has(importId)) open.delete(importId);
		else open.add(importId);
	}

	$effect(() => {
		const statement = lines;
		let current = true;
		rows = null;
		loadError = null;
		session.api.imports.preview(account.id, statement).then(
			(previews) => {
				if (current) rows = reviewRows(statement, previews);
			},
			(err) => {
				if (current) loadError = actionError(err);
			}
		);
		return () => (current = false);
	});

	const counts = $derived(rows ? reviewCounts(rows, account.onBudget) : null);

	async function commit() {
		if (!rows) return;
		busy = true;
		const lines = importLines(rows, account.onBudget);
		let done: { created: number; matched: number } | null = null;
		let call: Promise<unknown> | null = null;
		error = await runAction(async () => {
			// Categories picked by a new name are created first, then used by their ids.
			const ids = await pending.resolve(
				session.api,
				lines.map((l) => l.categoryId)
			);
			const committing = session.api.imports.commit(account.id, {
				lines: lines.map((l) => withCategoryIds(l, ids)),
				csvFormat
			});
			call = committing;
			done = await committing;
		});
		busy = false;
		if (error || !done || !call) return;
		const { created, matched } = done;
		const accountId = account.id;
		await goto(resolve('/accounts/[id]', { id: accountId }));
		offerUndo(session.client, call, m.import_done({ created, matched }), {
			duration: balance ? 15_000 : undefined,
			action: balance
				? {
						label: m.reconcile(),
						onClick: () =>
							(importHandoff.reconcile = { accountId, balance: balance.amount, date: balance.date })
					}
				: undefined
		});
	}
</script>

{#if loadError}
	<FormMessage error={loadError} class="justify-center p-6" />
{:else if !rows || !counts}
	<Delayed>
		<div class="overflow-hidden rounded-xl border bg-card shadow-xs">
			<LoadingRows rows={8} />
		</div>
	</Delayed>
{:else}
	{#if account.onBudget && counts.missing > 0}
		<section class="grid gap-3 rounded-xl border bg-card p-4 text-card-foreground shadow-xs">
			<p class="text-sm" data-testid="import-missing">
				{m.import_missing_categories({ count: counts.missing })}
			</p>
			<div class="flex gap-2">
				<CategoryCombobox
					tree={tree.data ?? []}
					{pending}
					bind:value={bulkCategory}
					ariaLabel={m.import_category_for_rest()}
					class="min-w-0 flex-1"
				/>
				<Button
					variant="outline"
					disabled={!bulkCategory}
					onclick={() => rows && fillCategories(rows, bulkCategory, account.onBudget)}
				>
					{m.import_apply_category()}
				</Button>
			</div>
		</section>
	{/if}

	<section
		class="divide-y overflow-hidden rounded-xl border bg-card text-card-foreground shadow-xs"
		aria-label={m.import_lines()}
	>
		{#each rows as row, i (row.line.importId)}
			<ImportRow
				bind:row={rows[i]}
				index={i}
				onBudget={account.onBudget}
				tree={tree.data ?? []}
				{pending}
				expanded={open.has(row.line.importId)}
				onToggle={() => toggle(row.line.importId)}
				onMakeRule={() => makeRule(row)}
			/>
		{/each}
	</section>

	<div class="grid gap-3">
		<FormMessage {error} />
		<div class="grid grid-cols-2 gap-2">
			<Button
				variant="outline"
				disabled={busy}
				onclick={() => goto(resolve('/accounts/[id]', { id: account.id }))}
			>
				{m.cancel()}
			</Button>
			<Button
				disabled={busy || counts.missing > 0 || counts.create + counts.match === 0}
				onclick={commit}
				data-testid="import-commit"
			>
				{m.import_commit({ count: counts.create + counts.match })}
			</Button>
		</div>
	</div>
{/if}

{#if rule}
	<RuleDialog
		bind:open={ruleOpen}
		initial={rule.initial}
		sample={rule.sample}
		tree={tree.data ?? []}
		{payeeNames}
		onSaved={ruleSaved}
	/>
{/if}
