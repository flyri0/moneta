<script lang="ts">
	import type { FlagFilter } from '$domain/flag';
	import { flagQuery } from '$features/flags/flags';
	import { untrack } from 'svelte';
	import ChartColumnIcon from '@lucide/svelte/icons/chart-column';
	import FormMessage from '$components/FormMessage.svelte';
	import DrillTransactions from './DrillTransactions.svelte';
	import ReportBody from './ReportBody.svelte';
	import ReportEmpty from './ReportEmpty.svelte';
	import SliceTable from './SliceTable.svelte';
	import StackedBar from './StackedBar.svelte';
	import StatTile from './StatTile.svelte';
	import { useSession } from '$client/app-state.svelte';
	import { useLive } from '$client/live.svelte';
	import { actionError } from '$client/notify';
	import { todayIso } from '$domain/month';
	import { NO_PAYEE, payeeSlices } from '$features/reports/payees';
	import { type DateRange, monthsCovered } from '$features/reports/range';
	import { SPENDING_TABLES, topSlices, withShares } from '$features/reports/spending';
	import { m } from '$i18n/paraglide/messages';

	/** Spending by who it went to, with each payee's transactions a click away. */
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

	const payees = useLive(session.client, SPENDING_TABLES, () =>
		session.api.reports.payees({ from: range.from, to: range.to, flags: flagQuery(flags) })
	);
	const slices = $derived(payeeSlices(payees.data ?? []));
	const report = $derived(withShares(slices));
	const top = $derived(topSlices(slices, TOP));
	const months = $derived(monthsCovered(range, todayIso()));
	const payee = $derived(report.rows.find((r) => r.key === selected) ?? null);

	// A drilled-in payee rarely survives a new period, and a stale one reads as a bug.
	$effect(() => {
		void range;
		untrack(() => {
			selected = null;
			expanded = false;
		});
	});
</script>

<ReportBody loading={!payees.data && !payees.error} stale={payees.stale}>
	<div class="grid gap-4 rounded-xl border bg-card p-4 text-card-foreground">
		{#if payees.error}
			<FormMessage error={actionError(payees.error)} />
		{:else if payees.data && report.rows.length === 0}
			<ReportEmpty icon={ChartColumnIcon} description={m.reports_spending_empty()} {onClear} />
		{:else if report.rows.length > 0}
			<StatTile
				value={session.format(report.total)}
				caption={months && months > 1
					? m.reports_average_month({ amount: session.format(Math.round(report.total / months)) })
					: undefined}
				testId="payees-total"
			/>
			<StackedBar
				segments={top.segments}
				other={top.other}
				label={(summary) => `${m.reports_payees()}: ${summary}`}
				class="h-4"
			/>

			<div class="grid gap-4 {payee ? 'lg:grid-cols-2 lg:items-start' : ''}">
				<SliceTable
					rows={report.rows}
					total={report.total}
					heading={m.reports_payee()}
					testId="payees-table"
					top={TOP}
					bind:selected
					bind:expanded
					canOpen={(row) => row.key !== NO_PAYEE}
				>
					{#snippet name(row)}
						<span
							class={row.key === NO_PAYEE
								? 'font-medium text-muted-foreground'
								: 'font-medium group-aria-pressed:underline'}>{row.label}</span
						>
					{/snippet}
				</SliceTable>

				{#if payee}
					<DrillTransactions
						title={m.reports_payee_transactions({ payee: payee.label })}
						by="payeeId"
						id={payee.key}
						{range}
						{flags}
						primary={(row) =>
							row.isSplit
								? row.splits.map((s) => s.categoryName).join(', ')
								: (row.categoryName ?? row.accountName)}
						amount={(row) => row.amount}
					/>
				{/if}
			</div>
		{/if}
	</div>
</ReportBody>
