<script lang="ts">
	import { resolve } from '$app/paths';
	import CheckIcon from '@lucide/svelte/icons/check';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import { payeeDisplay } from '$features/accounts/register';
	import { useSession } from '$client/app-state.svelte';
	import { runActionToast } from '$client/notify';
	import type { TransactionRow } from '$db/repos/transactions';
	import { formatDate } from '$i18n/formats';
	import { storedCategoryLabel } from '$i18n/labels';
	import { m } from '$i18n/paraglide/messages';
	import { getLocale } from '$i18n/paraglide/runtime';

	/** `showAccount` adds the row's account, for lists that span every account. */
	let {
		row,
		showAccount = false,
		onEdit
	}: {
		row: TransactionRow;
		showAccount?: boolean;
		onEdit?: (row: TransactionRow) => void;
	} = $props();

	const session = useSession();
	const payee = $derived(payeeDisplay(row));
	let expanded = $state(false);

	async function toggleCleared() {
		await runActionToast(() => session.api.transactions.setCleared(row.id, !row.cleared));
	}
</script>

<div
	class="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 gap-y-1 px-4 py-3 transition-colors [contain-intrinsic-size:auto_3.5rem] [content-visibility:auto] hover:bg-muted/40 {showAccount
		? 'md:grid-cols-[6.5rem_1fr_1fr_1fr_1fr_7.5rem_auto]'
		: 'md:grid-cols-[6.5rem_1fr_1fr_1fr_7.5rem_auto]'}"
	data-testid="register-row"
>
	<span class="hidden text-sm text-muted-foreground tabular-nums md:block">
		{formatDate(row.date, getLocale())}
	</span>

	{#if showAccount}
		<span class="hidden min-w-0 truncate text-sm text-muted-foreground md:block">
			{row.accountName}
		</span>
	{/if}

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
			class="min-w-0 truncate text-left text-sm font-medium hover:underline"
			onclick={() => onEdit(row)}>{@render payeeText()}</button
		>
	{:else}
		<span class="min-w-0 truncate text-sm font-medium">{@render payeeText()}</span>
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

	<div
		class="order-2 col-span-2 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground md:hidden"
	>
		<span class="tabular-nums">{formatDate(row.date, getLocale())}</span>
		{#if showAccount}
			<span>·</span>
			<span class="truncate">{row.accountName}</span>
		{/if}
		{#if row.isSplit || row.categoryName || row.memo}
			<span>·</span>
		{/if}
		{#if row.isSplit}
			<button
				type="button"
				class="inline-flex items-center gap-1 font-medium text-foreground hover:underline"
				aria-expanded={expanded}
				onclick={() => (expanded = !expanded)}
			>
				<ChevronRightIcon class="size-3 transition-transform {expanded ? 'rotate-90' : ''}" />
				{m.register_split({ count: row.splits.length })}
			</button>
		{:else if row.categoryName}
			<span class="truncate font-medium">{storedCategoryLabel(row.categoryName)}</span>
		{/if}
		{#if row.memo}
			{#if row.isSplit || row.categoryName}<span>·</span>{/if}
			<span class="truncate">{row.memo}</span>
		{/if}
	</div>

	<span
		class="text-right text-sm font-semibold tabular-nums {row.amount < 0
			? ''
			: 'text-emerald-700 dark:text-emerald-400'}"
		data-testid="register-amount"
	>
		{session.format(row.amount)}
	</span>

	<button
		type="button"
		class="flex size-7 items-center justify-center rounded-full border transition-colors {row.cleared
			? 'border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500'
			: 'border-muted-foreground/30 text-transparent hover:border-muted-foreground/60'}"
		aria-pressed={row.cleared}
		aria-label={m.register_cleared()}
		onclick={toggleCleared}
	>
		<CheckIcon class="size-4 stroke-[2.5]" />
	</button>

	{#if payee.kind === 'transfer'}
		<a
			class="order-5 col-span-full mt-1 text-xs text-primary underline md:col-span-2 {showAccount
				? 'md:col-start-3'
				: 'md:col-start-2'}"
			href={resolve('/accounts/[id]', { id: payee.accountId })}
		>
			{m.register_open_account({ account: payee.accountName })}
		</a>
	{/if}

	{#if row.isSplit && expanded}
		<div
			class="order-6 col-span-full mt-2 rounded-lg bg-muted/40 p-2.5 text-xs md:col-span-3 {showAccount
				? 'md:col-start-4'
				: 'md:col-start-3'}"
		>
			<ul class="grid gap-1.5">
				{#each row.splits as split (split.id)}
					<li class="flex items-center justify-between gap-2">
						<span class="truncate">
							<span class="font-medium text-foreground"
								>{storedCategoryLabel(split.categoryName)}</span
							>
							{#if split.memo}<span class="text-muted-foreground"> · {split.memo}</span>{/if}
						</span>
						<span class="shrink-0 font-medium tabular-nums">{session.format(split.amount)}</span>
					</li>
				{/each}
			</ul>
		</div>
	{/if}
</div>
