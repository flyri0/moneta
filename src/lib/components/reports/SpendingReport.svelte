<script lang="ts">
	import { resolve } from '$app/paths';
	import { BarChart } from 'layerchart';
	import * as Card from '$lib/components/ui/card';
	import * as Chart from '$lib/components/ui/chart';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { NativeSelect, NativeSelectOption } from '$lib/components/ui/native-select';
	import { payeeDisplay } from '$lib/accounts/register';
	import { useSession } from '$lib/client/app-state.svelte';
	import { useLive } from '$lib/client/live.svelte';
	import type { Table } from '$lib/db/connection';
	import type { TransactionRow } from '$lib/db/repos/transactions';
	import { todayIso } from '$lib/domain/month';
	import { errorMessage } from '$lib/i18n/errors';
	import { formatDate } from '$lib/i18n/formats';
	import { presetRange, RANGE_PRESETS, type RangePreset } from '$lib/reports/range';
	import { amountInCategory, withShares } from '$lib/reports/spending';
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';

	const session = useSession();
	const PRESETS: Record<RangePreset, () => string> = {
		this_month: m.reports_range_this_month,
		last_month: m.reports_range_last_month,
		last_3_months: m.reports_range_last_3_months,
		last_12_months: m.reports_range_last_12_months,
		this_year: m.reports_range_this_year
	};
	const TABLES: Table[] = [
		'transactions',
		'transaction_splits',
		'categories',
		'category_groups',
		'accounts'
	];

	let preset = $state<RangePreset | 'custom'>('this_month');
	let from = $state(presetRange('this_month', todayIso()).from);
	let to = $state(presetRange('this_month', todayIso()).to);
	let selected = $state<string | null>(null);

	function choosePreset() {
		if (preset !== 'custom') ({ from, to } = presetRange(preset, todayIso()));
		selected = null;
	}

	const spending = useLive(session.client, TABLES, () =>
		session.api.reports.spending({ from, to })
	);
	const report = $derived(withShares(spending.data ?? []));
	const category = $derived(report.rows.find((r) => r.categoryId === selected) ?? null);
	const transactions = useLive(session.client, [...TABLES, 'payees'], () =>
		selected
			? session.api.transactions.list({ categoryId: selected, from, to })
			: Promise.resolve<TransactionRow[]>([])
	);

	const config = { amount: { label: m.reports_spent(), color: 'var(--chart-1)' } };
	/** Long names would push the bars off the chart; the table below has them in full. */
	const shortName = (name: string) => (name.length > 14 ? `${name.slice(0, 13)}…` : name);
	const percent = $derived(
		new Intl.NumberFormat(getLocale(), { style: 'percent', maximumFractionDigits: 1 })
	);
</script>

<Card.Root>
	<Card.Header>
		<Card.Title>{m.reports_spending()}</Card.Title>
	</Card.Header>
	<Card.Content class="grid gap-4">
		<div class="grid gap-3 sm:grid-cols-3">
			<div class="grid gap-2">
				<Label for="spending-period">{m.reports_period()}</Label>
				<NativeSelect
					id="spending-period"
					class="w-full"
					bind:value={preset}
					onchange={choosePreset}
				>
					{#each RANGE_PRESETS as value (value)}
						<NativeSelectOption {value}>{PRESETS[value]()}</NativeSelectOption>
					{/each}
					<NativeSelectOption value="custom">{m.reports_range_custom()}</NativeSelectOption>
				</NativeSelect>
			</div>
			<div class="grid gap-2">
				<Label for="spending-from">{m.register_from()}</Label>
				<Input
					id="spending-from"
					type="date"
					bind:value={from}
					oninput={() => (preset = 'custom')}
				/>
			</div>
			<div class="grid gap-2">
				<Label for="spending-to">{m.register_to()}</Label>
				<Input id="spending-to" type="date" bind:value={to} oninput={() => (preset = 'custom')} />
			</div>
		</div>

		{#if spending.error}
			<p class="text-sm text-destructive" role="alert">{errorMessage(spending.error)}</p>
		{:else if spending.data && report.rows.length === 0}
			<p class="text-sm text-muted-foreground">{m.reports_spending_empty()}</p>
		{:else if report.rows.length > 0}
			<Chart.Container
				{config}
				class="aspect-auto w-full"
				style="height: {report.rows.length * 2.25 + 2.5}rem"
			>
				<BarChart
					data={report.rows}
					orientation="horizontal"
					y="name"
					x="amount"
					series={[{ key: 'amount', label: config.amount.label, color: config.amount.color }]}
					padding={{ left: 104, bottom: 24 }}
					onBarClick={(_, detail) => (selected = detail.data.categoryId)}
					props={{
						bars: { strokeWidth: 0, radius: 4 },
						xAxis: { format: session.formatCompact },
						yAxis: { format: shortName }
					}}
				/>
			</Chart.Container>

			<table class="w-full text-sm" data-testid="spending-table">
				<thead class="text-left text-xs text-muted-foreground">
					<tr>
						<th class="py-1 font-medium">{m.budget_category()}</th>
						<th class="py-1 text-right font-medium">{m.reports_spent()}</th>
						<th class="py-1 text-right font-medium">{m.reports_share()}</th>
					</tr>
				</thead>
				<tbody>
					{#each report.rows as row (row.categoryId)}
						<tr class="border-t">
							<td class="py-1.5">
								<button
									type="button"
									class="text-left hover:underline aria-pressed:font-semibold"
									aria-pressed={selected === row.categoryId}
									onclick={() => (selected = selected === row.categoryId ? null : row.categoryId)}
								>
									{row.name}
									<span class="block text-xs text-muted-foreground">{row.groupName}</span>
								</button>
							</td>
							<td class="py-1.5 text-right tabular-nums">{session.format(row.amount)}</td>
							<td class="py-1.5 text-right text-muted-foreground tabular-nums">
								{percent.format(row.share / 100)}
							</td>
						</tr>
					{/each}
				</tbody>
				<tfoot>
					<tr class="border-t font-medium">
						<td class="py-1.5">{m.reports_total()}</td>
						<td class="py-1.5 text-right tabular-nums">{session.format(report.total)}</td>
						<td></td>
					</tr>
				</tfoot>
			</table>
		{/if}

		{#if category}
			<section
				class="grid gap-2"
				aria-label={m.reports_category_transactions({ category: category.name })}
			>
				<h3 class="text-sm font-medium">
					{m.reports_category_transactions({ category: category.name })}
				</h3>
				<ul class="grid text-sm">
					{#each transactions.data ?? [] as row (row.id)}
						{@const payee = payeeDisplay(row)}
						<li class="flex items-center gap-3 border-t py-1.5">
							<span class="w-24 shrink-0 text-xs text-muted-foreground">
								{formatDate(row.date, getLocale())}
							</span>
							<a
								class="min-w-0 flex-1 truncate hover:underline"
								href={resolve('/accounts/[id]', { id: row.accountId })}
							>
								{#if payee.kind === 'transfer'}
									{payee.direction === 'to'
										? m.register_transfer_to({ account: payee.accountName })
										: m.register_transfer_from({ account: payee.accountName })}
								{:else if payee.kind === 'payee'}
									{payee.name}
								{:else}
									{row.accountName}
								{/if}
							</a>
							<span class="tabular-nums"
								>{session.format(amountInCategory(row, category.categoryId))}</span
							>
						</li>
					{/each}
				</ul>
			</section>
		{/if}
	</Card.Content>
</Card.Root>
