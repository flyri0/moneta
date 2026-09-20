<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import { Button } from '$ui/button';
	import * as Select from '$ui/select';
	import { currentMonth, type Month } from '$domain/month';
	import { formatMonthLong, formatMonthName } from '$i18n/formats';
	import { m } from '$i18n/paraglide/messages';
	import { getLocale } from '$i18n/paraglide/runtime';
	import { cn } from '$utils';

	let {
		month,
		onselect
	}: {
		month: Month;
		onselect?: (month: Month) => void;
	} = $props();

	const today = currentMonth();
	const todayYear = Number(today.slice(0, 4));

	let yearOverride = $state<number | null>(null);
	const viewingYear = $derived(yearOverride ?? Number(month.slice(0, 4)));

	const locale = $derived(getLocale());

	const minYear = $derived(Math.min(1950, viewingYear));
	const maxYear = $derived(Math.max(2050, viewingYear));

	const years = $derived.by(() => {
		const list: { value: string; label: string }[] = [];
		for (let y = minYear; y <= maxYear; y++) {
			list.push({ value: String(y), label: String(y) });
		}
		return list;
	});

	function prevYear() {
		if (viewingYear > minYear) yearOverride = viewingYear - 1;
	}

	function nextYear() {
		if (viewingYear < maxYear) yearOverride = viewingYear + 1;
	}

	function selectYear(val: string | undefined) {
		if (val) yearOverride = Number(val);
	}

	function handleSelect(targetMonth: Month) {
		yearOverride = null;
		onselect?.(targetMonth);
		void goto(resolve('/budget/[month]', { month: targetMonth }));
	}

	const monthItems = $derived.by(() => {
		return Array.from({ length: 12 }, (_, i) => {
			const monthNum = i + 1;
			const value = `${viewingYear}-${String(monthNum).padStart(2, '0')}`;
			const name = formatMonthName(monthNum, locale);
			const isSelected = value === month;
			const isToday = value === today;
			const ariaLabel = formatMonthLong(value, locale);
			return { monthNum, value, name, isSelected, isToday, ariaLabel };
		});
	});
</script>

<div class="flex flex-col gap-3">
	<div class="flex items-center justify-between gap-1">
		<Button
			variant="ghost"
			size="icon"
			class="size-8 shrink-0"
			onclick={prevYear}
			disabled={viewingYear <= minYear}
			aria-label={m.budget_previous_year()}
		>
			<ChevronLeftIcon class="size-4" />
		</Button>

		<Select.Root type="single" value={String(viewingYear)} onValueChange={selectYear}>
			<Select.Trigger
				size="sm"
				class="h-8 w-24 text-xs font-semibold"
				aria-label={m.date_picker_year()}
			>
				{String(viewingYear)}
			</Select.Trigger>
			<Select.Content class="z-[70] max-h-56">
				{#each years as y (y.value)}
					<Select.Item value={y.value} label={y.label}>
						{y.label}
					</Select.Item>
				{/each}
			</Select.Content>
		</Select.Root>

		<Button
			variant="ghost"
			size="icon"
			class="size-8 shrink-0"
			onclick={nextYear}
			disabled={viewingYear >= maxYear}
			aria-label={m.budget_next_year()}
		>
			<ChevronRightIcon class="size-4" />
		</Button>
	</div>

	<div class="grid grid-cols-3 gap-1.5" role="grid" aria-label={m.date_picker_month()}>
		{#each monthItems as item (item.value)}
			<Button
				type="button"
				variant={item.isSelected ? 'default' : 'ghost'}
				size="sm"
				onclick={() => handleSelect(item.value)}
				class={cn(
					'h-9 text-xs capitalize',
					item.isSelected && 'font-semibold',
					!item.isSelected && item.isToday && 'border border-primary font-semibold text-primary',
					!item.isSelected && !item.isToday && 'text-foreground'
				)}
				aria-selected={item.isSelected}
				aria-label={item.ariaLabel}
			>
				{item.name}
			</Button>
		{/each}
	</div>

	{#if month !== today || viewingYear !== todayYear}
		<div class="border-t pt-2">
			<Button
				type="button"
				variant="outline"
				size="sm"
				class="w-full text-xs"
				onclick={() => handleSelect(today)}
			>
				{m.budget_this_month()}
			</Button>
		</div>
	{/if}
</div>
