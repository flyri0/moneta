<script lang="ts">
	import { curveMonotoneX } from 'd3-shape';
	import { AreaChart } from 'layerchart';
	import * as Chart from '$ui/chart';
	import AgeOfMoneyTooltip from './AgeOfMoneyTooltip.svelte';
	import { axisMonthLabel } from '$features/reports/net-worth';
	import type { AgeOfMoneyValue } from '$features/reports/age-of-money';
	import { formatMonth } from '$i18n/formats';
	import { m } from '$i18n/paraglide/messages';
	import { getLocale } from '$i18n/paraglide/runtime';

	/**
	 * Age of Money over the months, as YNAB draws it: a smooth area fading into the baseline, with
	 * today's figure marked. Monotone smoothing never swings past the points, so the curve stays
	 * above zero and under the highest month. `compact` is the card's glance: no axes, no tooltip.
	 */
	let {
		points,
		compact = false,
		testId
	}: { points: AgeOfMoneyValue[]; compact?: boolean; testId?: string } = $props();

	const uid = $props.id();
	const fill = `${uid}-fill`;
	const config = { days: { label: m.reports_age_of_money(), color: 'var(--chart-1)' } };
	// A Date x gives the chart a time scale; the ticks are pinned to the months we actually have.
	const chartData = $derived(
		points.map((p) => ({
			...p,
			date: new Date(`${p.month}-01T00:00:00Z`),
			label: formatMonth(p.month, getLocale())
		}))
	);
	const last = $derived(chartData.at(-1));
</script>

<Chart.Container
	{config}
	class="aspect-auto w-full {compact ? 'h-24' : 'h-56 md:h-64'}"
	data-testid={testId}
>
	<svg width="0" height="0" class="absolute" aria-hidden="true">
		<defs>
			<linearGradient id={fill} x1="0" y1="0" x2="0" y2="1">
				<stop offset="0%" style:stop-color="var(--color-days)" stop-opacity="0.35" />
				<stop offset="100%" style:stop-color="var(--color-days)" stop-opacity="0.02" />
			</linearGradient>
		</defs>
	</svg>
	<AreaChart
		data={chartData}
		x="date"
		y="days"
		yDomain={[0, null]}
		series={[{ key: 'days', label: config.days.label, color: 'var(--color-days)' }]}
		padding={compact
			? { top: 8, right: 8, bottom: 4, left: 8 }
			: { top: 8, right: 28, bottom: 34, left: 40 }}
		axis={!compact}
		grid={!compact}
		rule={!compact}
		tooltipContext={!compact}
		annotations={last
			? [
					{
						type: 'point',
						x: last.date,
						y: last.days,
						r: 4.5,
						props: {
							circle: { fill: 'var(--color-days)', class: 'stroke-background', strokeWidth: 2 }
						}
					}
				]
			: []}
		props={{
			area: {
				curve: curveMonotoneX,
				fill: `url(#${fill})`,
				fillOpacity: 1,
				line: { strokeWidth: 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }
			},
			xAxis: {
				ticks: chartData.map((d) => d.date),
				// Names only, so twelve months fit a phone; the tooltip says the year.
				format: (d: Date) => {
					const month = d.toISOString().slice(0, 7);
					return axisMonthLabel(month, month === points[0]?.month, getLocale());
				},
				tickLength: 10,
				tickOcclusion: { padding: 8 }
			},
			yAxis: { ticks: 4, tickLength: 0, tickLabelProps: { dx: -6 } }
		}}
	>
		{#snippet tooltip()}<AgeOfMoneyTooltip />{/snippet}
	</AreaChart>
</Chart.Container>
