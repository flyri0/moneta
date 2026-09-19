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
