<script lang="ts">
	import { resolve } from '$app/paths';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import { Button } from '$lib/components/ui/button';
	import { addMonths, currentMonth, type Month } from '$lib/domain/month';
	import { formatMonthLong } from '$lib/i18n/formats';
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';

	let { month }: { month: Month } = $props();
	const today = currentMonth();
</script>

<div class="flex items-center gap-1">
	<Button
		variant="ghost"
		size="icon"
		href={resolve('/budget/[month]', { month: addMonths(month, -1) })}
		aria-label={m.budget_previous_month()}
	>
		<ChevronLeftIcon />
	</Button>
	<h1 class="min-w-40 text-center text-lg font-semibold capitalize" data-testid="month-label">
		{formatMonthLong(month, getLocale())}
	</h1>
	<Button
		variant="ghost"
		size="icon"
		href={resolve('/budget/[month]', { month: addMonths(month, 1) })}
		aria-label={m.budget_next_month()}
	>
		<ChevronRightIcon />
	</Button>
	{#if month !== today}
		<Button variant="outline" size="sm" href={resolve('/budget/[month]', { month: today })}>
			{m.budget_this_month()}
		</Button>
	{/if}
</div>
