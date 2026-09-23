<script lang="ts">
	import { BarChart } from 'layerchart';
	import * as Chart from '$ui/chart';
	import CashFlowTooltip from './CashFlowTooltip.svelte';
	import { useSession } from '$client/app-state.svelte';
	import type { CashFlowRow } from '$db/repos/reports';
	import { formatMonth } from '$i18n/formats';
	import { axisMonthLabel } from '$features/reports/net-worth';
	import { m } from '$i18n/paraglide/messages';
	import { getLocale } from '$i18n/paraglide/runtime';

	/** Income and expenses side by side, month by month, on one money axis. */
	let { rows }: { rows: CashFlowRow[] } = $props();

	const session = useSession();
	const config = {
		income: { label: m.reports_income(), color: 'var(--income)' },
		spending: { label: m.reports_expenses(), color: 'var(--spending)' }
	};
	const data = $derived(rows.map((r) => ({ ...r, label: formatMonth(r.month, getLocale()) })));
</script>

<div class="grid gap-2">
	<Chart.Container {config} class="aspect-auto h-56 w-full md:h-64" data-testid="cash-flow-chart">
		<BarChart
			{data}
			x="month"
			series={[
				{ key: 'income', label: config.income.label, color: 'var(--color-income)' },
				{ key: 'spending', label: config.spending.label, color: 'var(--color-spending)' }
			]}
			seriesLayout="group"
			bandPadding={0.3}
			groupPadding={0.1}
			padding={{ top: 8, right: 8, bottom: 34, left: 56 }}
			props={{
				bars: { radius: 3, strokeWidth: 0 },
				xAxis: {
					format: (month: string) => axisMonthLabel(month, month === rows[0]?.month, getLocale()),
					tickLength: 10,
					tickOcclusion: { padding: 8 }
				},
				yAxis: {
					format: session.formatCompact,
					ticks: 4,
					tickLength: 0,
					tickLabelProps: { dx: -6 }
				}
			}}
		>
			{#snippet tooltip()}<CashFlowTooltip />{/snippet}
		</BarChart>
	</Chart.Container>
	<div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
		<span class="flex items-center gap-1.5">
			<span class="size-2.5 rounded-full bg-income" aria-hidden="true"></span>{m.reports_income()}
		</span>
		<span class="flex items-center gap-1.5">
			<span class="size-2.5 rounded-full bg-spending" aria-hidden="true"
			></span>{m.reports_expenses()}
		</span>
	</div>
</div>
