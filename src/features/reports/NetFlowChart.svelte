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

	/**
	 * What was left each month: a surplus rises above the line in the income colour, a shortfall
	 * drops below it in the expense colour, on one money axis. The tooltip has the month's income,
	 * expenses and net.
	 */
	let { rows }: { rows: CashFlowRow[] } = $props();

	const session = useSession();
	const config = {
		surplus: { label: m.reports_net(), color: 'var(--income)' },
		shortfall: { label: m.reports_net(), color: 'var(--spending)' }
	};
	const data = $derived(
		rows.map((r) => {
			const net = r.income - r.spending;
			return {
				...r,
				label: formatMonth(r.month, getLocale()),
				surplus: Math.max(0, net),
				shortfall: Math.min(0, net)
			};
		})
	);
</script>

<Chart.Container {config} class="aspect-auto h-56 w-full md:h-64" data-testid="net-flow-chart">
	<BarChart
		{data}
		x="month"
		series={[
			{ key: 'surplus', label: config.surplus.label, color: 'var(--color-surplus)' },
			{ key: 'shortfall', label: config.shortfall.label, color: 'var(--color-shortfall)' }
		]}
		seriesLayout="stackDiverging"
		bandPadding={0.3}
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
