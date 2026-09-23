<script lang="ts">
	import { useSession } from '$client/app-state.svelte';
	import { segmentClass, type Segment } from '$features/reports/spending';
	import { m } from '$i18n/paraglide/messages';
	import { getLocale } from '$i18n/paraglide/runtime';

	/**
	 * Spending as one bar split into its biggest parts, each in its own colour, with the rest in a
	 * muted tail so the bar still adds up to the whole. Segments grow by amount rather than take a
	 * percent width, so the 2px gaps between them never push the bar past its track.
	 */
	let {
		segments,
		other,
		class: className = 'h-3'
	}: {
		segments: Segment[];
		other: { count: number; amount: number; share: number } | null;
		class?: string;
	} = $props();

	const session = useSession();
	const percent = $derived(
		new Intl.NumberFormat(getLocale(), { style: 'percent', maximumFractionDigits: 1 })
	);
	const parts = $derived([
		...segments.map((s) => ({ ...s, color: s.color as number | null })),
		...(other
			? [{ key: '__other', label: m.reports_other(), ...other, color: null as number | null }]
			: [])
	]);
	const summary = $derived(
		parts.map((p) => `${p.label} ${percent.format(p.share / 100)}`).join(', ')
	);
</script>

<div
	class="flex gap-0.5 overflow-hidden rounded-full {className}"
	role="img"
	aria-label={m.reports_spending_breakdown({ summary })}
	data-testid="stacked-bar"
>
	{#each parts as part (part.key)}
		<span
			class="h-full min-w-0.5 {segmentClass(part.color)}"
			style="flex: {part.amount} 1 0%"
			title="{part.label}: {session.format(part.amount)} ({percent.format(part.share / 100)})"
		></span>
	{/each}
</div>
