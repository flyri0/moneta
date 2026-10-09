<script lang="ts">
	import type { FlagFilter } from '$domain/flag';
	import { flagQuery } from '$features/flags/flags';
	import { untrack } from 'svelte';
	import ChartPieIcon from '@lucide/svelte/icons/chart-pie';
	import FormMessage from '$components/FormMessage.svelte';
	import DrillTransactions from './DrillTransactions.svelte';
	import ReportBody from './ReportBody.svelte';
	import ReportEmpty from './ReportEmpty.svelte';
	import SliceTable from './SliceTable.svelte';
	import StackedBar from './StackedBar.svelte';
	import StatTile from './StatTile.svelte';
	import { payeeDisplay, payeeText } from '$features/accounts/register';
	import { useSession } from '$client/app-state.svelte';
	import { useLive } from '$client/live.svelte';
	import { actionError } from '$client/notify';
	import { todayIso } from '$domain/month';
	import { type DateRange, monthsCovered } from '$features/reports/range';
	import {
		amountInCategory,
		byGroup,
		SPENDING_TABLES,
		topSegments,
		withShares
	} from '$features/reports/spending';
	import { m } from '$i18n/paraglide/messages';

	let {
		range,
		flags = [],
		onClear
	}: { range: DateRange; flags?: FlagFilter; onClear?: () => void } = $props();

	const session = useSession();
	/** Parts of the bar with a colour of their own; the table's first rows wear the same ones. */
	const TOP = 5;

	let selected = $state<string | null>(null);
	let expanded = $state(false);
	let grouped = $state(false);

	const spending = useLive(session.client, SPENDING_TABLES, () =>
		session.api.reports.spending({ from: range.from, to: range.to, flags: flagQuery(flags) })
	);
	const source = $derived(grouped ? byGroup(spending.data ?? []) : (spending.data ?? []));
	const report = $derived(
		withShares(
			source.map((r) => ({
				key: r.categoryId,
				label: r.name,
				groupName: r.groupName,
				amount: r.amount
			}))
		)
	);
	const top = $derived(topSegments(source, TOP));
	const months = $derived(monthsCovered(range, todayIso()));
	const category = $derived(grouped ? null : (report.rows.find((r) => r.key === selected) ?? null));

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
</script>

<ReportBody loading={!spending.data && !spending.error} stale={spending.stale}>
	<div class="grid gap-4 rounded-xl border bg-card p-4 text-card-foreground">
		{#if spending.error}
			<FormMessage error={actionError(spending.error)} />
		{:else if spending.data && report.rows.length === 0}
			<ReportEmpty icon={ChartPieIcon} description={m.reports_spending_empty()} {onClear} />
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
				<SliceTable
					rows={report.rows}
					total={report.total}
					heading={grouped ? m.reports_group() : m.budget_category()}
					testId="spending-table"
					top={TOP}
					bind:selected
					bind:expanded
					canOpen={() => !grouped}
				>
					{#snippet name(row)}
						{#if grouped}
							<span class="font-medium">{row.label}</span>
						{:else}
							<span class="grid gap-0.5">
								<span class="font-medium group-aria-pressed:underline">{row.label}</span>
								<span class="text-xs text-muted-foreground">{row.groupName}</span>
							</span>
						{/if}
					{/snippet}
				</SliceTable>

				{#if category}
					{@const categoryId = category.key}
					<DrillTransactions
						title={m.reports_category_transactions({ category: category.label })}
						by="categoryId"
						id={categoryId}
						{range}
						{flags}
						primary={(row) => payeeText(payeeDisplay(row), row.accountName)}
						amount={(row) => amountInCategory(row, categoryId)}
					/>
				{/if}
			</div>
		{/if}
	</div>
</ReportBody>
