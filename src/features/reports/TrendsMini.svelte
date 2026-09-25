<script lang="ts">
	import { useSession } from '$client/app-state.svelte';
	import type { Month } from '$domain/month';
	import { formatMonth, formatMonthName } from '$i18n/formats';
	import { segmentClass } from '$features/reports/spending';
	import type { TrendSeries } from '$features/reports/trends';
	import { m } from '$i18n/paraglide/messages';
	import { getLocale } from '$i18n/paraglide/runtime';

	/**
	 * Spending per month as stacked bars, small enough for a card: one bar per month on a shared
	 * scale, split by category, no axes. The numbers are in each month's hover title and in the list
	 * for screen readers; the full report has the axis.
	 */
	let { months, series, totals }: { months: Month[]; series: TrendSeries[]; totals: number[] } =
		$props();

	const session = useSession();
	const max = $derived(Math.max(1, ...totals));
	const describe = (i: number) =>
		m.reports_trends_month({
			month: formatMonth(months[i], getLocale()),
			summary: series
				.filter((s) => s.values[i] > 0)
				.map((s) => `${s.label ?? m.reports_other()} ${session.format(s.values[i])}`)
				.join(', ')
		});
</script>

<ul class="flex min-h-20 flex-1 items-stretch gap-2" data-testid="trends-mini">
	{#each months as month, i (month)}
		<li class="flex flex-1 flex-col gap-1" title={describe(i)}>
			<span class="sr-only">{describe(i)}</span>
			<span class="flex flex-1 flex-col justify-end border-b" aria-hidden="true">
				<span
					class="mx-auto flex w-4 flex-col-reverse gap-px overflow-hidden rounded-t-[3px]"
					style="height: {(Math.max(0, totals[i]) / max) * 100}%"
				>
					{#each series as s (s.key)}
						{#if s.values[i] > 0}
							<span class="{segmentClass(s.color)} min-h-px" style="flex: {s.values[i]} 1 0%"
							></span>
						{/if}
					{/each}
				</span>
			</span>
			<span class="text-center text-[11px] text-muted-foreground" aria-hidden="true">
				{formatMonthName(Number(month.slice(5)), getLocale())}
			</span>
		</li>
	{/each}
</ul>
