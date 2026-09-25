<script lang="ts">
	import { curveMonotoneX } from 'd3-shape';
	import { AreaChart } from 'layerchart';
	import * as Chart from '$ui/chart';
	import type { Month } from '$domain/month';

	/**
	 * A figure's recent months as a card's glance: a smooth area with no axes or tooltip, the last
	 * point marked. Unlike Age of Money it does not start at zero, so a small change still shows.
	 */
	let {
		points,
		label,
		testId
	}: { points: { month: Month; value: number }[]; label: string; testId?: string } = $props();

	const uid = $props.id();
	const fill = `${uid}-fill`;
	const config = $derived({ value: { label, color: 'var(--chart-1)' } });
	const data = $derived(points.map((p) => ({ ...p, date: new Date(`${p.month}-01T00:00:00Z`) })));
	const last = $derived(data.at(-1));
</script>

<Chart.Container {config} class="aspect-auto min-h-16 w-full flex-1" data-testid={testId}>
	<svg width="0" height="0" class="absolute" aria-hidden="true">
		<defs>
			<linearGradient id={fill} x1="0" y1="0" x2="0" y2="1">
				<stop offset="0%" style:stop-color="var(--color-value)" stop-opacity="0.35" />
				<stop offset="100%" style:stop-color="var(--color-value)" stop-opacity="0.02" />
			</linearGradient>
		</defs>
	</svg>
	<AreaChart
		{data}
		x="date"
		y="value"
		series={[{ key: 'value', label, color: 'var(--color-value)' }]}
		padding={{ top: 8, right: 8, bottom: 4, left: 8 }}
		axis={false}
		grid={false}
		rule={false}
		tooltipContext={false}
		annotations={last
			? [
					{
						type: 'point',
						x: last.date,
						y: last.value,
						r: 4.5,
						props: {
							circle: { fill: 'var(--color-value)', class: 'stroke-background', strokeWidth: 2 }
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
			}
		}}
	/>
</Chart.Container>
