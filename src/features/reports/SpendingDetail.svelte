<script lang="ts">
	import { untrack } from 'svelte';
	import FormMessage from '$components/FormMessage.svelte';
	import { resolve } from '$app/paths';
	import StackedBar from './StackedBar.svelte';
	import StatTile from './StatTile.svelte';
	import { payeeDisplay } from '$features/accounts/register';
	import { useSession } from '$client/app-state.svelte';
	import { useLive } from '$client/live.svelte';
	import { actionError } from '$client/notify';
	import { todayIso } from '$domain/month';
	import type { TransactionRow } from '$db/repos/transactions';
	import { formatDate } from '$i18n/formats';
	import { type DateRange, monthsCovered } from '$features/reports/range';
	import {
		amountInCategory,
		byGroup,
		SPENDING_TABLES,
		segmentClass,
		topSegments,
		withShares
	} from '$features/reports/spending';
	import { m } from '$i18n/paraglide/messages';
	import { getLocale } from '$i18n/paraglide/runtime';

	let { range }: { range: DateRange } = $props();

	const session = useSession();
	/** Rows shown before the list folds. Enough to see the shape of a month's spending. */
	const ROWS = 8;
	/** Parts of the bar with a colour of their own; the table's first rows wear the same ones. */
	const TOP = 5;

	let selected = $state<string | null>(null);
	let expanded = $state(false);
	let grouped = $state(false);

	const spending = useLive(session.client, SPENDING_TABLES, () =>
		session.api.reports.spending({ from: range.from, to: range.to })
	);
	const source = $derived(grouped ? byGroup(spending.data ?? []) : (spending.data ?? []));
	const report = $derived(withShares(source));
	const top = $derived(topSegments(source, TOP));
	const months = $derived(monthsCovered(range, todayIso()));
	/** Bars are scaled to the biggest row, so the top one fills its track and the rest compare
	 * against it. The share column carries the percent of the total. */
	const max = $derived(Math.max(1, ...report.rows.map((r) => r.amount)));
	const shown = $derived(expanded ? report.rows : report.rows.slice(0, ROWS));
	const category = $derived(
		grouped ? null : (report.rows.find((r) => r.categoryId === selected) ?? null)
	);
	const transactions = useLive(session.client, SPENDING_TABLES, () =>
		selected
			? session.api.transactions.list({ categoryId: selected, from: range.from, to: range.to })
			: Promise.resolve<TransactionRow[]>([])
	);

	// A drilled-in category rarely survives a new period or a switch to groups, and a stale one
	// reads as a bug.
	$effect(() => {
		void range;
		void grouped;
		untrack(() => {
			selected = null;
			expanded = false;
		});
	});

	const percent = $derived(
		new Intl.NumberFormat(getLocale(), { style: 'percent', maximumFractionDigits: 1 })
	);
</script>

<div class="grid gap-4 rounded-xl border bg-card p-4 text-card-foreground">
	{#if spending.error}
		<FormMessage error={actionError(spending.error)} />
	{:else if spending.data && report.rows.length === 0}
		<p class="text-sm text-muted-foreground">{m.reports_spending_empty()}</p>
	{:else if report.rows.length > 0}
		<div class="flex flex-wrap items-end justify-between gap-3">
			<StatTile
				value={session.format(report.total)}
				caption={months && months > 1
					? m.reports_average_month({ amount: session.format(Math.round(report.total / months)) })
					: undefined}
				testId="spending-total"
			/>
			<div class="inline-flex rounded-lg bg-muted p-0.5 text-sm">
				{#each [false, true] as byGroups (byGroups)}
					<button
						type="button"
						class="rounded-md px-3 py-1 text-muted-foreground transition-colors aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:shadow-sm"
						aria-pressed={grouped === byGroups}
						onclick={() => (grouped = byGroups)}
					>
						{byGroups ? m.reports_by_group() : m.reports_by_category()}
					</button>
				{/each}
			</div>
		</div>
		<StackedBar segments={top.segments} other={top.other} class="h-4" />

		<!-- The drill-down gets its own column on a wide screen; with none open the list keeps the
		width to itself rather than leaving half the card empty. -->
		<div class="grid gap-4 {category ? 'lg:grid-cols-2 lg:items-start' : ''}">
			<table class="w-full text-sm" data-testid="spending-table">
				<thead class="text-left text-xs text-muted-foreground">
					<tr>
						<th scope="col" class="py-1 font-medium">
							{grouped ? m.reports_group() : m.budget_category()}
						</th>
						<th scope="col" class="py-1 text-right font-medium">{m.reports_spent()}</th>
						<th scope="col" class="py-1 text-right font-medium">{m.reports_share()}</th>
					</tr>
				</thead>
				<tbody>
					{#each shown as row, i (row.categoryId)}
						{@const bar = segmentClass(i < TOP ? i + 1 : null)}
						<tr class="border-t">
							<th scope="row" class="py-2 pr-3 text-left font-normal">
								{#if grouped}
									<span class="grid gap-1.5">
										<span class="font-medium">{row.name}</span>
										<span class="block h-1.5 overflow-hidden rounded-full bg-muted">
											<span
												class="block h-full rounded-full {bar}"
												style="width: {(row.amount / max) * 100}%"
											></span>
										</span>
									</span>
								{:else}
									<button
										type="button"
										class="group grid w-full gap-1.5 text-left"
										aria-pressed={selected === row.categoryId}
										onclick={() => (selected = selected === row.categoryId ? null : row.categoryId)}
									>
										<span class="grid gap-0.5">
											<span class="font-medium group-aria-pressed:underline">{row.name}</span>
											<span class="text-xs text-muted-foreground">{row.groupName}</span>
										</span>
										<span class="block h-1.5 overflow-hidden rounded-full bg-muted">
											<span
												class="block h-full rounded-full {bar}"
												style="width: {(row.amount / max) * 100}%"
											></span>
										</span>
									</button>
								{/if}
							</th>
							<td class="py-2 text-right align-top whitespace-nowrap tabular-nums">
								{session.format(row.amount)}
							</td>
							<td
								class="py-2 pl-2 text-right align-top whitespace-nowrap text-muted-foreground tabular-nums"
							>
								{percent.format(row.share / 100)}
							</td>
						</tr>
					{/each}
					{#if report.rows.length > ROWS}
						<tr class="border-t">
							<td colspan="3" class="py-2">
								<button
									type="button"
									class="text-sm text-muted-foreground hover:underline"
									aria-expanded={expanded}
									onclick={() => (expanded = !expanded)}
								>
									{expanded
										? m.reports_show_less()
										: m.reports_show_all({ count: report.rows.length })}
								</button>
							</td>
						</tr>
					{/if}
				</tbody>
				<tfoot>
					<tr class="border-t font-medium">
						<td class="py-2">{m.reports_total()}</td>
						<td class="py-2 text-right tabular-nums">{session.format(report.total)}</td>
						<td></td>
					</tr>
				</tfoot>
			</table>

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
									{#if payee.kind === 'transfer'}
										{payee.direction === 'to'
											? m.register_transfer_to({ account: payee.accountName })
											: m.register_transfer_from({ account: payee.accountName })}
									{:else if payee.kind === 'starting-balance'}
										{m.register_starting_balance()}
									{:else if payee.kind === 'payee'}
										{payee.name}
									{:else}
										{row.accountName}
									{/if}
								</a>
								<span class="row-span-2 self-center tabular-nums sm:row-span-1">
									{session.format(amountInCategory(row, category.categoryId))}
								</span>
							</li>
						{/each}
					</ul>
				</section>
			{/if}
		</div>
	{/if}
</div>
