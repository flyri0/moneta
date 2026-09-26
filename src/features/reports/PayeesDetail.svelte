<script lang="ts">
	import ReportBody from './ReportBody.svelte';
	import { untrack } from 'svelte';
	import FormMessage from '$components/FormMessage.svelte';
	import { resolve } from '$app/paths';
	import StackedBar from './StackedBar.svelte';
	import StatTile from './StatTile.svelte';
	import { useSession } from '$client/app-state.svelte';
	import { useLive } from '$client/live.svelte';
	import { actionError } from '$client/notify';
	import { todayIso } from '$domain/month';
	import type { TransactionRow } from '$db/repos/transactions';
	import { formatDate } from '$i18n/formats';
	import { NO_PAYEE, payeeSlices } from '$features/reports/payees';
	import { type DateRange, monthsCovered } from '$features/reports/range';
	import { SPENDING_TABLES, segmentClass, topSlices, withShares } from '$features/reports/spending';
	import { m } from '$i18n/paraglide/messages';
	import { getLocale } from '$i18n/paraglide/runtime';

	/** Spending by who it went to, with each payee's transactions a click away. */
	let { range }: { range: DateRange } = $props();

	const session = useSession();
	/** Rows shown before the list folds, as in the spending report. */
	const ROWS = 8;
	/** Parts of the bar with a colour of their own; the table's first rows wear the same ones. */
	const TOP = 5;

	let selected = $state<string | null>(null);
	let expanded = $state(false);

	const payees = useLive(session.client, SPENDING_TABLES, () =>
		session.api.reports.payees({ from: range.from, to: range.to })
	);
	const slices = $derived(payeeSlices(payees.data ?? []));
	const report = $derived(withShares(slices));
	const top = $derived(topSlices(slices, TOP));
	const months = $derived(monthsCovered(range, todayIso()));
	const max = $derived(Math.max(1, ...report.rows.map((r) => r.amount)));
	const shown = $derived(expanded ? report.rows : report.rows.slice(0, ROWS));
	const payee = $derived(report.rows.find((r) => r.key === selected) ?? null);
	const transactions = useLive(session.client, SPENDING_TABLES, () =>
		selected
			? session.api.transactions.list({ payeeId: selected, from: range.from, to: range.to })
			: Promise.resolve<TransactionRow[]>([])
	);

	// A drilled-in payee rarely survives a new period, and a stale one reads as a bug.
	$effect(() => {
		void range;
		untrack(() => {
			selected = null;
			expanded = false;
		});
	});

	const percent = $derived(
		new Intl.NumberFormat(getLocale(), { style: 'percent', maximumFractionDigits: 1 })
	);
</script>

<ReportBody loading={!payees.data && !payees.error} stale={payees.stale}>
	<div class="grid gap-4 rounded-xl border bg-card p-4 text-card-foreground">
		{#if payees.error}
			<FormMessage error={actionError(payees.error)} />
		{:else if payees.data && report.rows.length === 0}
			<p class="text-sm text-muted-foreground">{m.reports_spending_empty()}</p>
		{:else if report.rows.length > 0}
			<StatTile
				value={session.format(report.total)}
				caption={months && months > 1
					? m.reports_average_month({ amount: session.format(Math.round(report.total / months)) })
					: undefined}
				testId="payees-total"
			/>
			<StackedBar
				segments={top.segments}
				other={top.other}
				label={(summary) => `${m.reports_payees()}: ${summary}`}
				class="h-4"
			/>

			<div class="grid gap-4 {payee ? 'lg:grid-cols-2 lg:items-start' : ''}">
				<table class="w-full text-sm" data-testid="payees-table">
					<thead class="text-left text-xs text-muted-foreground">
						<tr>
							<th scope="col" class="py-1 font-medium">{m.reports_payee()}</th>
							<th scope="col" class="py-1 text-right font-medium">{m.reports_spent()}</th>
							<th scope="col" class="py-1 text-right font-medium">{m.reports_share()}</th>
						</tr>
					</thead>
					<tbody>
						{#each shown as row, i (row.key)}
							{@const bar = segmentClass(i < TOP ? i + 1 : null)}
							<tr class="border-t">
								<th scope="row" class="py-2 pr-3 text-left font-normal">
									{#if row.key === NO_PAYEE}
										<span class="grid gap-1.5">
											<span class="font-medium text-muted-foreground">{row.label}</span>
											<span class="block h-1.5 overflow-hidden rounded-full bg-muted">
												<span
													class="block h-full rounded-full {bar}"
													style="width: {(row.amount / max) * 100}%"
												></span>
											</span>
										</span>
									{:else}
										<button
											type="button"
											class="group grid w-full gap-1.5 text-left"
											aria-pressed={selected === row.key}
											onclick={() => (selected = selected === row.key ? null : row.key)}
										>
											<span class="font-medium group-aria-pressed:underline">{row.label}</span>
											<span class="block h-1.5 overflow-hidden rounded-full bg-muted">
												<span
													class="block h-full rounded-full {bar}"
													style="width: {(row.amount / max) * 100}%"
												></span>
											</span>
										</button>
									{/if}
								</th>
								<td class="py-2 text-right align-top whitespace-nowrap tabular-nums">
									{session.format(row.amount)}
								</td>
								<td
									class="py-2 pl-2 text-right align-top whitespace-nowrap text-muted-foreground tabular-nums"
								>
									{percent.format(row.share / 100)}
								</td>
							</tr>
						{/each}
						{#if report.rows.length > ROWS}
							<tr class="border-t">
								<td colspan="3" class="py-2">
									<button
										type="button"
										class="text-sm text-muted-foreground hover:underline"
										aria-expanded={expanded}
										onclick={() => (expanded = !expanded)}
									>
										{expanded
											? m.reports_show_less()
											: m.reports_show_all({ count: report.rows.length })}
									</button>
								</td>
							</tr>
						{/if}
					</tbody>
					<tfoot>
						<tr class="border-t font-medium">
							<td class="py-2">{m.reports_total()}</td>
							<td class="py-2 text-right tabular-nums">{session.format(report.total)}</td>
							<td></td>
						</tr>
					</tfoot>
				</table>

				{#if payee}
					<section
						class="grid gap-2"
						aria-label={m.reports_payee_transactions({ payee: payee.label })}
					>
						<h3 class="text-sm font-medium">
							{m.reports_payee_transactions({ payee: payee.label })}
						</h3>
						<ul class="grid text-sm">
							{#each transactions.data ?? [] as row (row.id)}
								<li
									class="grid grid-cols-[1fr_auto] items-baseline gap-x-3 border-t py-1.5 sm:grid-cols-[6rem_1fr_auto]"
								>
									<span class="order-2 text-xs text-muted-foreground sm:order-none">
										{formatDate(row.date, getLocale())}
									</span>
									<a
										class="min-w-0 truncate hover:underline"
										href={resolve('/accounts/[id]', { id: row.accountId })}
									>
										{row.isSplit
											? row.splits.map((s) => s.categoryName).join(', ')
											: (row.categoryName ?? row.accountName)}
									</a>
									<span class="row-span-2 self-center tabular-nums sm:row-span-1">
										{session.format(row.amount)}
									</span>
								</li>
							{/each}
						</ul>
					</section>
				{/if}
			</div>
		{/if}
	</div>
</ReportBody>
