<script lang="ts">
	import { resolve } from '$app/paths';
	import CalendarIcon from '@lucide/svelte/icons/calendar';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import { Button } from '$ui/button';
	import * as Popover from '$ui/popover';
	import { addMonths, currentMonth, type Month } from '$domain/month';
	import { formatMonthLong } from '$i18n/formats';
	import { m } from '$i18n/paraglide/messages';
	import { getLocale } from '$i18n/paraglide/runtime';
	import MonthYearPicker from './MonthYearPicker.svelte';

	let { month }: { month: Month } = $props();
	let open = $state(false);
	const today = currentMonth();
</script>

<div class="flex min-w-0 items-center gap-1">
	<Button
		variant="ghost"
		size="icon"
		href={resolve('/budget/[month]', { month: addMonths(month, -1) })}
		aria-label={m.budget_previous_month()}
	>
		<ChevronLeftIcon />
	</Button>
	<h1
		class="min-w-0 flex-1 truncate text-center text-lg font-semibold capitalize md:min-w-40 md:flex-none"
		data-testid="month-label"
	>
		<Popover.Root bind:open>
			<Popover.Trigger
				class="group inline-flex max-w-full items-center justify-center gap-1.5 rounded-md px-2 py-1 text-lg font-semibold capitalize transition-colors hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
				aria-label={m.budget_select_month()}
			>
				{#key month}
					<span class="truncate">
						{formatMonthLong(month, getLocale())}
					</span>
				{/key}
				<CalendarIcon
					class="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
				/>
			</Popover.Trigger>
			<Popover.Content class="z-[60] w-72 p-3" align="center">
				<MonthYearPicker
					{month}
					onselect={() => {
						open = false;
					}}
				/>
			</Popover.Content>
		</Popover.Root>
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
		<Button
			variant="outline"
			size="sm"
			class="shrink-0"
			href={resolve('/budget/[month]', { month: today })}
		>
			{m.budget_this_month()}
		</Button>
	{/if}
</div>
