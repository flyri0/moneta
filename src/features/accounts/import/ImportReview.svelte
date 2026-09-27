<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { toast } from 'svelte-sonner';
	import { Badge } from '$ui/badge';
	import { Button } from '$ui/button';
	import { Checkbox } from '$ui/checkbox';
	import { Input } from '$ui/input';
	import FormMessage from '$components/FormMessage.svelte';
	import LoadingRows from '$components/LoadingRows.svelte';
	import Delayed from '$components/Delayed.svelte';
	import CategoryPicker from '$features/transactions/CategoryPicker.svelte';
	import { useSession } from '$client/app-state.svelte';
	import { useLive } from '$client/live.svelte';
	import { actionError, runAction, type ActionError } from '$client/notify';
	import type { Account } from '$db/repos/accounts';
	import type { StatementLine } from '$db/repos/imports';
	import { formatDate } from '$i18n/formats';
	import { m } from '$i18n/paraglide/messages';
	import { getLocale } from '$i18n/paraglide/runtime';
	import { importHandoff } from './pending.svelte';
	import {
		fillCategories,
		importLines,
		needsCategory,
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
		const input = { lines: importLines(rows, account.onBudget), csvFormat };
		let done: { created: number; matched: number } | null = null;
		error = await runAction(async () => {
			done = await session.api.imports.commit(account.id, input);
		});
		busy = false;
		if (error || !done) return;
		const { created, matched } = done;
		const accountId = account.id;
		await goto(resolve('/accounts/[id]', { id: accountId }));
		toast.success(m.import_done({ created, matched }), {
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
				<CategoryPicker
					tree={tree.data ?? []}
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
			{@const status = row.preview.status}
			<div
				class="grid grid-cols-[auto_1fr_auto] items-start gap-x-3 gap-y-2 px-4 py-3 {row.include
					? ''
					: 'opacity-60'}"
				data-testid="import-row"
			>
				<Checkbox
					class="mt-2"
					checked={row.include}
					disabled={status === 'duplicate'}
					aria-label={m.import_include({ description: row.line.description })}
					onCheckedChange={(v) => (row.include = v === true)}
				/>
				<div class="grid min-w-0 gap-1">
					{#if status === 'new'}
						<Input
							bind:value={row.payeeName}
							aria-label={m.import_payee({ number: i + 1 })}
							disabled={!row.include}
							class="h-8"
						/>
					{:else}
						<span class="truncate py-1 text-sm font-medium">{row.line.description}</span>
					{/if}
					<div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
						<span class="tabular-nums">{formatDate(row.line.date, getLocale())}</span>
						{#if status === 'new'}
							<Badge variant="secondary">{m.import_status_new()}</Badge>
						{:else if status === 'match' && row.preview.match}
							<Badge variant="outline" data-testid="import-match">
								{m.import_status_match({
									payee: row.preview.match.payeeName ?? m.register_no_payee(),
									date: formatDate(row.preview.match.date, getLocale())
								})}
							</Badge>
						{:else}
							<Badge variant="outline">{m.import_status_duplicate()}</Badge>
						{/if}
						{#if row.line.memo}<span class="truncate">{row.line.memo}</span>{/if}
					</div>
				</div>
				<span
					class="py-1 text-sm font-semibold tabular-nums {row.line.amount < 0
						? ''
						: 'text-emerald-700 dark:text-emerald-400'}"
				>
					{session.format(row.line.amount)}
				</span>
				{#if status === 'new' && account.onBudget && row.include}
					<div class="col-start-2 col-end-4">
						<CategoryPicker
							tree={tree.data ?? []}
							bind:value={row.categoryId}
							ariaLabel={m.import_category({ number: i + 1 })}
							class="w-full {needsCategory(row, account.onBudget) ? 'border-destructive/50' : ''}"
						/>
					</div>
				{/if}
			</div>
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
