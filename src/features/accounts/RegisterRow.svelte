<script lang="ts">
	import { resolve } from '$app/paths';
	import CheckIcon from '@lucide/svelte/icons/check';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import LockIcon from '@lucide/svelte/icons/lock';
	import { Badge } from '$ui/badge';
	import { Checkbox } from '$ui/checkbox';
	import { longPress } from '$features/accounts/long-press';
	import FlagIcon from '$features/flags/FlagIcon.svelte';
	import { flagLabel } from '$features/flags/flags';
	import type { FlagRow } from '$db/repos/flags';
	import { payeeDisplay, payeeText } from '$features/accounts/register';
	import Amount from '$components/Amount.svelte';
	import { useSession } from '$client/app-state.svelte';
	import { runActionToast } from '$client/notify';
	import { today } from '$client/today.svelte';
	import type { TransactionRow } from '$db/repos/transactions';
	import { formatDate } from '$i18n/formats';
	import { storedCategoryLabel } from '$i18n/labels';
	import { m } from '$i18n/paraglide/messages';
	import { getLocale } from '$i18n/paraglide/runtime';

	/**
	 * `showAccount` adds the row's account, for lists that span every account. Tapping anywhere on
	 * the row opens it (`onOpen`). While `selecting`, a checkbox leads the row and a tap chooses it
	 * instead; holding a finger on it calls `onLongPress`. `highlighted` marks a row an action just changed.
	 */
	let {
		row,
		showAccount = false,
		onOpen,
		selecting = false,
		selected = false,
		onSelect,
		onLongPress,
		highlighted = false,
		flags
	}: {
		row: TransactionRow;
		showAccount?: boolean;
		onOpen?: (row: TransactionRow) => void;
		selecting?: boolean;
		selected?: boolean;
		onSelect?: (row: TransactionRow) => void;
		onLongPress?: (row: TransactionRow) => void;
		highlighted?: boolean;
		/** The flags' names, for the row's flag. */
		flags?: readonly FlagRow[];
	} = $props();

	const session = useSession();
	const payee = $derived(payeeDisplay(row));
	/** A transfer with no category takes the category column too, on desktop. */
	const wide = $derived(payee.kind === 'transfer' && !row.isSplit && !row.categoryName);
	const payeeLabel = $derived(payeeText(payee));
	/** Dated after today: it counts in the balance only once its day comes. */
	const upcoming = $derived(row.date > today());
	let expanded = $state(false);

	async function toggleCleared() {
		await runActionToast(() => session.api.transactions.setCleared(row.id, !row.cleared));
	}

	/**
	 * A tap anywhere but on the row's own controls and links: it chooses the row while selecting and
	 * opens it otherwise. The payee's button stays the way in from the keyboard.
	 */
	function choose(event: MouseEvent) {
		if ((event.target as Element).closest('a, button')) return;
		if (selecting) onSelect?.(row);
		// Not when the tap ends a drag that selected some text, e.g. to copy the memo.
		else if (onOpen && !getSelection()?.toString()) onOpen(row);
	}
</script>

<!-- The checkbox is the keyboard's way to choose a row, and the payee's button to open it; tapping
the rest of the row is a shortcut. -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div
	class={[
		'flex items-center gap-3 px-4 py-3 transition-colors [contain-intrinsic-size:auto_3.5rem] [content-visibility:auto] hover:bg-muted/40',
		selected && 'bg-primary/5',
		(selecting || onOpen) && 'cursor-pointer',
		highlighted && 'motion-safe:animate-row-flash',
		upcoming && 'opacity-70',
		onLongPress && '[-webkit-touch-callout:none] pointer-coarse:select-none'
	]}
	data-testid="register-row"
	data-highlighted={highlighted || undefined}
	onclick={choose}
	{@attach onLongPress && longPress(() => onLongPress(row))}
>
	{#if selecting}
		<Checkbox
			checked={selected}
			onCheckedChange={() => onSelect?.(row)}
			aria-label={m.select_row({ payee: payeeLabel, amount: session.format(row.amount) })}
		/>
	{/if}
	<div
		class="grid min-w-0 flex-1 grid-cols-[1fr_auto_auto] items-center gap-x-3 gap-y-1 {showAccount
			? 'md:grid-cols-[6.5rem_1fr_1fr_1fr_1fr_7.5rem_auto]'
			: 'md:grid-cols-[6.5rem_1fr_1fr_1fr_7.5rem_auto]'}"
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
			{#if upcoming}
				<Badge variant="outline" class="mr-1.5 align-[0.0625em]" data-testid="register-upcoming">
					{m.register_upcoming()}
				</Badge>
			{/if}
			{#if row.flag}
				<FlagIcon
					color={row.flag}
					label={flagLabel(row.flag, flags)}
					class="mr-1 inline size-3.5 align-[-0.125em]"
				/>
			{/if}
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

		{#if onOpen && !selecting}
			<button
				type="button"
				class="min-w-0 truncate text-left text-sm font-medium hover:underline {wide
					? 'md:col-span-2'
					: ''}"
				onclick={() => onOpen(row)}>{@render payeeText()}</button
			>
		{:else}
			<span class="min-w-0 truncate text-sm font-medium {wide ? 'md:col-span-2' : ''}"
				>{@render payeeText()}</span
			>
		{/if}

		{#if !wide}
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
		{/if}

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

		<Amount
			amount={row.amount}
			flow
			class="text-right text-sm font-semibold"
			data-testid="register-amount"
		/>

		{#if row.reconciled}
			<!-- Reconciled rows stay cleared: the lock replaces the toggle. -->
			<span
				class="flex size-7 items-center justify-center rounded-full bg-emerald-600/15 text-emerald-700 dark:text-emerald-400"
				role="img"
				aria-label={m.register_reconciled()}
				title={m.register_reconciled()}
				data-testid="register-reconciled"
			>
				<LockIcon class="size-3.5 stroke-[2.5]" />
			</span>
		{:else}
			<!-- While selecting it only shows the state, and a tap on it chooses the row. -->
			<button
				type="button"
				disabled={selecting}
				class:pointer-events-none={selecting}
				class="relative flex size-7 items-center justify-center rounded-full border transition-colors after:absolute after:-inset-1.5 {row.cleared
					? 'border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500'
					: 'border-muted-foreground/30 text-transparent hover:border-muted-foreground/60'}"
				aria-pressed={row.cleared}
				aria-label={m.register_cleared()}
				onclick={toggleCleared}
			>
				<CheckIcon class="size-4 stroke-[2.5]" />
			</button>
		{/if}

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
</div>
