<script lang="ts">
	import { Tooltip } from 'layerchart';
	import { useSession } from '$client/app-state.svelte';
	import type { NetWorthPoint } from '$domain/net-worth';
	import { m } from '$i18n/paraglide/messages';

	/**
	 * Net worth is the only series, so the shadcn tooltip (which lists series) can't show assets
	 * and debts. This reads them off the point instead, in the same card as the other tooltips.
	 */
	const session = useSession();
</script>

<Tooltip.Root variant="none">
	{#snippet children({ data }: { data: NetWorthPoint & { label: string } })}
		<div
			class="grid min-w-40 gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl"
		>
			<div class="font-medium">{data.label}</div>
			<dl class="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1">
				<dt class="text-muted-foreground">{m.reports_net_worth()}</dt>
				<dd class="text-right font-medium tabular-nums">{session.format(data.netWorth)}</dd>
				<dt class="text-muted-foreground">{m.reports_assets()}</dt>
				<dd class="text-right tabular-nums">{session.format(data.assets)}</dd>
				<dt class="text-muted-foreground">{m.reports_debts()}</dt>
				<dd class="text-right tabular-nums">{session.format(data.debts)}</dd>
			</dl>
		</div>
	{/snippet}
</Tooltip.Root>
