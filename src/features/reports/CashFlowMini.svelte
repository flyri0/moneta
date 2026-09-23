<script lang="ts">
	import { useSession } from '$client/app-state.svelte';
	import type { CashFlowRow } from '$db/repos/reports';
	import { formatMonth, formatMonthName } from '$i18n/formats';
	import { m } from '$i18n/paraglide/messages';
	import { getLocale } from '$i18n/paraglide/runtime';

	/**
	 * Income against expenses, month by month, small enough for a card: a pair of bars per month
	 * on one shared scale, no axes. The numbers are in the list for screen readers and in each
	 * month's hover title; the full chart has the axis.
	 */
	let { rows }: { rows: CashFlowRow[] } = $props();

	const session = useSession();
	const max = $derived(Math.max(1, ...rows.flatMap((r) => [r.income, r.spending])));
	const height = (minor: number) => `${(Math.max(0, minor) / max) * 100}%`;
	const describe = (row: CashFlowRow) =>
		m.reports_cash_flow_month({
			month: formatMonth(row.month, getLocale()),
			income: session.format(row.income),
			expenses: session.format(row.spending)
		});
</script>

<div class="grid gap-2">
	<ul class="flex h-24 items-stretch gap-2" data-testid="cash-flow-mini">
		{#each rows as row (row.month)}
			<li class="flex flex-1 flex-col gap-1" title={describe(row)}>
				<span class="sr-only">{describe(row)}</span>
				<span class="flex flex-1 items-end justify-center gap-0.5 border-b" aria-hidden="true">
					<span class="w-2 rounded-t-[3px] bg-income" style="height: {height(row.income)}"></span>
					<span class="w-2 rounded-t-[3px] bg-spending" style="height: {height(row.spending)}"
					></span>
				</span>
				<span class="text-center text-[11px] text-muted-foreground" aria-hidden="true">
					{formatMonthName(Number(row.month.slice(5)), getLocale())}
				</span>
			</li>
		{/each}
	</ul>
	<div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-hidden="true">
		<span class="flex items-center gap-1.5">
			<span class="size-2.5 rounded-full bg-income"></span>{m.reports_income()}
		</span>
		<span class="flex items-center gap-1.5">
			<span class="size-2.5 rounded-full bg-spending"></span>{m.reports_expenses()}
		</span>
	</div>
</div>
