<script lang="ts">
	import ReportCard from './ReportCard.svelte';
	import FormMessage from '$components/FormMessage.svelte';
	import { useSession } from '$client/app-state.svelte';
	import { useLive } from '$client/live.svelte';
	import { actionError } from '$client/notify';
	import { accountTypeLabel } from '$i18n/labels';
	import { accountBreakdown } from '$features/reports/accounts-breakdown';
	import { m } from '$i18n/paraglide/messages';
	import { getLocale } from '$i18n/paraglide/runtime';

	/**
	 * What is owned against what is owed today: the two totals, their proportion as one bar, and the
	 * biggest accounts either way, each with a bar on a shared scale.
	 */
	const session = useSession();
	/** Accounts listed on the card; the full report has them all. */
	const SHOWN = 5;

	const accounts = useLive(session.client, ['accounts', 'transactions'], () =>
		session.api.accounts.list()
	);
	const breakdown = $derived(accountBreakdown(accounts.data ?? []));
	const all = $derived(
		[
			...breakdown.assets.map((a) => ({ ...a, debt: false })),
			...breakdown.debts.map((a) => ({ ...a, debt: true }))
		].sort((a, b) => b.amount - a.amount)
	);
	const shown = $derived(all.slice(0, SHOWN));
	const max = $derived(Math.max(1, ...all.map((a) => a.amount)));
	const whole = $derived(breakdown.totalAssets + breakdown.totalDebts);
	const percent = $derived(
		new Intl.NumberFormat(getLocale(), { style: 'percent', maximumFractionDigits: 0 })
	);
	const ASSET = 'bg-emerald-500 dark:bg-emerald-400';
	const DEBT = 'bg-red-500 dark:bg-red-400';
</script>

<ReportCard title={m.reports_accounts()} route="/reports/accounts" testId="accounts-card">
	{#if accounts.error}
		<FormMessage error={actionError(accounts.error)} />
	{:else if accounts.data && all.length === 0}
		<p class="text-sm text-muted-foreground">{m.reports_accounts_empty()}</p>
	{:else if accounts.data}
		<div class="grid gap-2">
			<div class="flex items-end justify-between gap-3">
				<div class="grid min-w-0 gap-0.5" data-testid="accounts-card-assets">
					<span class="truncate text-xl leading-tight font-semibold">
						{session.format(breakdown.totalAssets)}
					</span>
					<span class="flex items-center gap-1.5 text-xs text-muted-foreground">
						<span class="size-2 rounded-full {ASSET}" aria-hidden="true"></span>
						{m.reports_assets()}
					</span>
				</div>
				<div class="grid min-w-0 gap-0.5 text-right" data-testid="accounts-card-debts">
					<span class="truncate text-xl leading-tight font-semibold">
						{session.format(-breakdown.totalDebts)}
					</span>
					<span class="flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
						<span class="size-2 rounded-full {DEBT}" aria-hidden="true"></span>
						{m.reports_debts()}
					</span>
				</div>
			</div>
			<div
				class="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-muted"
				role="img"
				aria-label="{m.reports_assets()} {percent.format(
					breakdown.totalAssets / whole
				)}, {m.reports_debts()} {percent.format(breakdown.totalDebts / whole)}"
			>
				{#if breakdown.totalAssets > 0}
					<span class="h-full {ASSET}" style="flex: {breakdown.totalAssets} 1 0%"></span>
				{/if}
				{#if breakdown.totalDebts > 0}
					<span class="h-full {DEBT}" style="flex: {breakdown.totalDebts} 1 0%"></span>
				{/if}
			</div>
		</div>
		<ul class="grid gap-2.5 text-sm" data-testid="accounts-card-list">
			{#each shown as account (account.id)}
				<li class="grid gap-1">
					<span class="flex items-baseline justify-between gap-3">
						<span class="min-w-0 truncate">
							{account.name}
							{#if accountTypeLabel(account.type).toLowerCase() !== account.name.toLowerCase()}
								<span class="text-xs text-muted-foreground">· {accountTypeLabel(account.type)}</span
								>
							{/if}
						</span>
						<span class="shrink-0 tabular-nums">
							{session.format(account.debt ? -account.amount : account.amount)}
						</span>
					</span>
					<span class="block h-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
						<span
							class="block h-full rounded-full {account.debt ? DEBT : ASSET}"
							style="width: {(account.amount / max) * 100}%"
						></span>
					</span>
				</li>
			{/each}
			{#if all.length > SHOWN}
				<li class="text-xs text-muted-foreground">
					{m.reports_more_accounts({ count: all.length - SHOWN })}
				</li>
			{/if}
		</ul>
		<p
			class="mt-auto flex items-baseline justify-between gap-3 border-t pt-2 text-sm"
			data-testid="accounts-card-net"
		>
			<span class="text-muted-foreground">{m.reports_net()}</span>
			<span class="font-semibold tabular-nums">
				{session.format(breakdown.totalAssets - breakdown.totalDebts)}
			</span>
		</p>
	{/if}
</ReportCard>
