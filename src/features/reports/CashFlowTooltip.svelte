<script lang="ts">
	import { Tooltip } from 'layerchart';
	import { useSession } from '$client/app-state.svelte';
	import type { CashFlowRow } from '$db/repos/reports';
	import { m } from '$i18n/paraglide/messages';

	/** A month's income, expenses and what was left, in the same card as the other tooltips. */
	const session = useSession();
</script>

<Tooltip.Root variant="none">
	{#snippet children({ data }: { data: CashFlowRow & { label: string } })}
		<div
			class="grid min-w-40 gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl"
		>
			<div class="font-medium">{data.label}</div>
			<dl class="grid grid-cols-[auto_1fr_auto] items-center gap-x-2 gap-y-1">
				<span class="size-2 rounded-full bg-income"></span>
				<dt class="text-muted-foreground">{m.reports_income()}</dt>
				<dd class="text-right tabular-nums">{session.format(data.income)}</dd>
				<span class="size-2 rounded-full bg-spending"></span>
				<dt class="text-muted-foreground">{m.reports_expenses()}</dt>
				<dd class="text-right tabular-nums">{session.format(data.spending)}</dd>
				<span></span>
				<dt class="text-muted-foreground">{m.reports_net()}</dt>
				<dd class="text-right font-medium tabular-nums">
					{session.format(data.income - data.spending)}
				</dd>
			</dl>
		</div>
	{/snippet}
</Tooltip.Root>
