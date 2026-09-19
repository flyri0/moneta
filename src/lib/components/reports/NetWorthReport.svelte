<script lang="ts">
	import { BarChart } from 'layerchart';
	import * as Card from '$lib/components/ui/card';
	import * as Chart from '$lib/components/ui/chart';
	import { Label } from '$lib/components/ui/label';
	import { NativeSelect, NativeSelectOption } from '$lib/components/ui/native-select';
	import { useSession } from '$lib/client/app-state.svelte';
	import { useLive } from '$lib/client/live.svelte';
	import { currentMonth } from '$lib/domain/month';
	import { errorMessage } from '$lib/i18n/errors';
	import { formatMonth } from '$lib/i18n/formats';
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';

	const session = useSession();
	let span = $state<'last_12_months' | 'all'>('last_12_months');

	const series = useLive(session.client, ['transactions', 'accounts'], () =>
		session.api.reports.netWorth(currentMonth())
	);
	const points = $derived(span === 'all' ? (series.data ?? []) : (series.data ?? []).slice(-12));
	const chartData = $derived(
		points.map((p) => ({ ...p, label: formatMonth(p.month, getLocale()) }))
	);

	const config = {
		assets: { label: m.reports_assets(), color: 'var(--chart-1)' },
		debts: { label: m.reports_debts(), color: 'var(--destructive)' }
	};
</script>

<Card.Root>
	<Card.Header>
		<Card.Title>{m.reports_net_worth()}</Card.Title>
	</Card.Header>
	<Card.Content class="grid gap-4">
		<div class="grid gap-2 sm:max-w-xs">
			<Label for="net-worth-period">{m.reports_period()}</Label>
			<NativeSelect id="net-worth-period" class="w-full" bind:value={span}>
				<NativeSelectOption value="last_12_months">
					{m.reports_range_last_12_months()}
				</NativeSelectOption>
				<NativeSelectOption value="all">{m.reports_range_all()}</NativeSelectOption>
			</NativeSelect>
		</div>

		{#if series.error}
			<p class="text-sm text-destructive" role="alert">{errorMessage(series.error)}</p>
		{:else if series.data && points.length === 0}
			<p class="text-sm text-muted-foreground">{m.reports_net_worth_empty()}</p>
		{:else if points.length > 0}
			<Chart.Container {config} class="aspect-auto h-64 w-full">
				<BarChart
					data={chartData}
					x="label"
					seriesLayout="stackDiverging"
					series={[
						{ key: 'assets', label: config.assets.label, color: config.assets.color },
						{ key: 'debts', label: config.debts.label, color: config.debts.color }
					]}
					props={{ bars: { strokeWidth: 0 }, yAxis: { format: session.formatCompact } }}
				/>
			</Chart.Container>

			<table class="w-full text-sm" data-testid="net-worth-table">
				<thead class="text-left text-xs text-muted-foreground">
					<tr>
						<th class="py-1 font-medium">{m.reports_month()}</th>
						<th class="py-1 text-right font-medium">{m.reports_assets()}</th>
						<th class="py-1 text-right font-medium">{m.reports_debts()}</th>
						<th class="py-1 text-right font-medium">{m.reports_net_worth()}</th>
					</tr>
				</thead>
				<tbody>
					{#each [...points].reverse() as point (point.month)}
						<tr class="border-t">
							<td class="py-1.5">{formatMonth(point.month, getLocale())}</td>
							<td class="py-1.5 text-right tabular-nums">{session.format(point.assets)}</td>
							<td class="py-1.5 text-right tabular-nums">{session.format(point.debts)}</td>
							<td class="py-1.5 text-right font-medium tabular-nums">
								{session.format(point.netWorth)}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</Card.Content>
</Card.Root>
