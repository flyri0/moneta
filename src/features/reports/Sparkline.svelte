<script lang="ts">
	import { area, curveMonotoneX, line } from 'd3-shape';
	import type { Month } from '$domain/month';

	/**
	 * A figure's recent months as a card's glance: a smooth area down to zero, with no axes or
	 * tooltip, the last point marked. Monotone smoothing never swings past the points. Plain SVG, so
	 * the reports overview loads no charting library.
	 */
	let { points, testId }: { points: { month: Month; value: number }[]; testId?: string } = $props();

	const uid = $props.id();
	const fill = `${uid}-fill`;
	const PAD = { top: 8, right: 8, bottom: 4, left: 8 };

	let width = $state(0);
	let height = $state(0);

	const shape = $derived.by(() => {
		const values = points.map((p) => p.value);
		const min = Math.min(0, ...values);
		const max = Math.max(0, ...values);
		const w = Math.max(0, width - PAD.left - PAD.right);
		const h = Math.max(0, height - PAD.top - PAD.bottom);
		const x = (i: number) => PAD.left + (points.length > 1 ? (i / (points.length - 1)) * w : w / 2);
		const y = (v: number) => PAD.top + (max === min ? h : (1 - (v - min) / (max - min)) * h);
		const xy = points.map((p, i): [number, number] => [x(i), y(p.value)]);
		return {
			line: line().curve(curveMonotoneX)(xy) ?? '',
			area: area().curve(curveMonotoneX).y0(y(0))(xy) ?? '',
			last: xy.at(-1)
		};
	});
</script>

<div
	class="relative min-h-16 w-full flex-1"
	bind:clientWidth={width}
	bind:clientHeight={height}
	data-testid={testId}
>
	{#if width > 0 && height > 0}
		<svg class="absolute inset-0 size-full overflow-visible" aria-hidden="true">
			<defs>
				<linearGradient id={fill} x1="0" y1="0" x2="0" y2="1">
					<stop offset="0%" stop-color="var(--chart-1)" stop-opacity="0.35" />
					<stop offset="100%" stop-color="var(--chart-1)" stop-opacity="0.02" />
				</linearGradient>
			</defs>
			<path d={shape.area} fill="url(#{fill})" />
			<path
				d={shape.line}
				fill="none"
				stroke="var(--chart-1)"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
			{#if shape.last}
				<circle
					cx={shape.last[0]}
					cy={shape.last[1]}
					r="4.5"
					fill="var(--chart-1)"
					class="stroke-background"
					stroke-width="2"
				/>
			{/if}
		</svg>
	{/if}
</div>
