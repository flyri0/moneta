<script lang="ts">
	import { Tooltip } from 'layerchart';
	import { daysLabel, type AgeOfMoneyValue } from '$features/reports/age-of-money';
	import { m } from '$i18n/paraglide/messages';

	/** A month's Age of Money, in the same card as the other report tooltips. */
</script>

<Tooltip.Root variant="none">
	{#snippet children({ data }: { data: AgeOfMoneyValue & { label: string } })}
		<div
			class="grid min-w-36 gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl"
		>
			<div class="font-medium">{data.label}</div>
			<dl class="grid grid-cols-[1fr_auto] gap-x-3">
				<dt class="text-muted-foreground">{m.reports_age_of_money()}</dt>
				<dd class="text-right font-medium tabular-nums">{daysLabel(data.days)}</dd>
			</dl>
		</div>
	{/snippet}
</Tooltip.Root>
