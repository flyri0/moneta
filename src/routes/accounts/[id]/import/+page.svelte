<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import HelpLink from '$components/HelpLink.svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import FormMessage from '$components/FormMessage.svelte';
	import LoadingRows from '$components/LoadingRows.svelte';
	import PageHeader from '$components/PageHeader.svelte';
	import CsvColumns from '$features/accounts/import/CsvColumns.svelte';
	import ImportReview from '$features/accounts/import/ImportReview.svelte';
	import {
		applyFormat,
		widest,
		guessFormat,
		localeDateOrder,
		storedFormat,
		type CsvFormat
	} from '$features/accounts/import/csv';
	import { importHandoff } from '$features/accounts/import/pending.svelte';
	import type { Statement } from '$features/accounts/import/statement';
	import { useSession } from '$client/app-state.svelte';
	import { useLive } from '$client/live.svelte';
	import { actionError, type ActionError } from '$client/notify';
	import type { StatementLine } from '$db/repos/imports';
	import { currencyDigits, decimalSeparator } from '$domain/money';
	import { m } from '$i18n/paraglide/messages';

	const session = useSession();
	const accountId = page.params.id ?? '';
	const account = useLive(session.client, ['accounts'], () => session.api.accounts.get(accountId));

	/** The statement read on the account's page; opening this page any other way goes back. */
	const pending = untrack(() => importHandoff.takeStatement(accountId));
	const digits = currencyDigits(session.money.currency);

	let format = $state<CsvFormat | null>(null);
	let formatError = $state<ActionError | null>(null);
	let review = $state.raw<{
		lines: StatementLine[];
		csvFormat: string | undefined;
		balance: Statement['balance'];
	} | null>(
		pending?.kind === 'ofx'
			? { lines: pending.statement.lines, csvFormat: undefined, balance: pending.statement.balance }
			: null
	);

	onMount(() => {
		if (!pending) {
			void goto(resolve('/accounts/[id]', { id: accountId }), { replaceState: true });
			return;
		}
		if (pending.kind !== 'csv') return;
		const table = pending.table;
		const columns = widest(table);
		session.api.imports.csvFormat(accountId).then(
			(saved) => {
				format =
					storedFormat(saved, columns) ??
					guessFormat(table, {
						decimal: decimalSeparator(session.money.locale) === ',' ? ',' : '.',
						dateOrder: localeDateOrder(session.money.locale)
					});
			},
			(err) => (formatError = actionError(err))
		);
	});

	function toReview() {
		if (pending?.kind !== 'csv' || !format) return;
		review = {
			lines: applyFormat(pending.table, format, digits).lines,
			csvFormat: JSON.stringify(format),
			balance: null
		};
	}
</script>

<PageHeader
	title={m.import_title()}
	back={{ route: '/accounts/[id]', id: accountId, label: account.data?.name ?? m.nav_accounts() }}
>
	{#snippet subtitle()}
		{#if pending}<p class="truncate text-xs text-muted-foreground">{pending.fileName}</p>{/if}
	{/snippet}
	{#snippet actions()}
		<HelpLink topic="importing" />
	{/snippet}
</PageHeader>

<div class="mx-auto grid max-w-2xl gap-4 p-3 md:p-6">
	{#if account.error && !account.data}
		<FormMessage error={actionError(account.error)} />
	{:else if formatError}
		<FormMessage error={formatError} />
	{:else if !pending}
		<!-- Going back to the account. -->
	{:else if review && account.data}
		<ImportReview
			account={account.data}
			lines={review.lines}
			csvFormat={review.csvFormat}
			balance={review.balance}
		/>
	{:else if pending.kind === 'csv' && format}
		<CsvColumns
			table={pending.table}
			bind:format
			{digits}
			onContinue={toReview}
			onCancel={() => goto(resolve('/accounts/[id]', { id: accountId }))}
		/>
	{:else}
		<div class="overflow-hidden rounded-xl border bg-card shadow-xs">
			<LoadingRows rows={6} />
		</div>
	{/if}
</div>

<svelte:head><title>{m.import_title()} · {m.app_name()}</title></svelte:head>
