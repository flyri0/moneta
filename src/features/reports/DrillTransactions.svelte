<script lang="ts">
	import { untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import { Button } from '$ui/button';
	import { useSession } from '$client/app-state.svelte';
	import { useLive } from '$client/live.svelte';
	import type { FlagFilter } from '$domain/flag';
	import type { TransactionRow } from '$db/repos/transactions';
	import { PAGE_SIZE } from '$features/accounts/register';
	import { flagQuery } from '$features/flags/flags';
	import type { DateRange } from '$features/reports/range';
	import { revealBelowTable } from '$features/reports/reveal';
	import { SPENDING_TABLES } from '$features/reports/spending';
	import { formatDate } from '$i18n/formats';
	import { m } from '$i18n/paraglide/messages';
	import { getLocale } from '$i18n/paraglide/runtime';

	/** The transactions behind a report's row, in the period, a page at a time. */
	let {
		title,
		by,
		id,
		range,
		flags,
		primary,
		amount
	}: {
		title: string;
		/** What the row is: a category or a payee. */
		by: 'categoryId' | 'payeeId';
		id: string;
		range: DateRange;
		flags: FlagFilter;
		/** What a transaction shows, linking to its account. */
		primary: (row: TransactionRow) => string;
		/** The part of a transaction that counts toward the row. */
		amount: (row: TransactionRow) => number;
	} = $props();

	const session = useSession();

	/** How many pages are shown: a long period has thousands. */
	let pages = $state(1);

	const transactions = useLive(session.client, SPENDING_TABLES, () =>
		session.api.transactions.list({
			[by]: id,
			from: range.from,
			to: range.to,
			flags: flagQuery(flags),
			limit: pages * PAGE_SIZE
		})
	);
	const hasMore = $derived((transactions.data?.length ?? 0) >= pages * PAGE_SIZE);

	$effect(() => {
		void id;
		void range;
		void flags;
		untrack(() => (pages = 1));
	});
</script>

<!-- Comes into view each time another row opens it. -->
<section
	class="grid gap-2"
	aria-label={title}
	{@attach (node) => {
		void id;
		revealBelowTable(node);
	}}
>
	<h3 class="text-sm font-medium outline-none" tabindex="-1">{title}</h3>
	<ul class="grid text-sm">
		{#each transactions.data ?? [] as row (row.id)}
			<li
				class="grid grid-cols-[1fr_auto] items-baseline gap-x-3 border-t py-1.5 sm:grid-cols-[6rem_1fr_auto]"
			>
				<span class="order-2 text-xs text-muted-foreground sm:order-none">
					{formatDate(row.date, getLocale())}
				</span>
				<a
					class="min-w-0 truncate hover:underline"
					href={resolve('/accounts/[id]', { id: row.accountId })}
				>
					{primary(row)}
				</a>
				<span class="row-span-2 self-center tabular-nums sm:row-span-1">
					{session.format(amount(row))}
				</span>
			</li>
		{/each}
	</ul>
	{#if hasMore}
		<Button variant="outline" class="w-full" onclick={() => pages++}>
			{m.register_load_more()}
		</Button>
	{/if}
</section>
