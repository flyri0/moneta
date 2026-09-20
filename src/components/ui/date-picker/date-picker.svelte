<script lang="ts">
	import CalendarIcon from '@lucide/svelte/icons/calendar';
	import XIcon from '@lucide/svelte/icons/x';
	import {
		CalendarDate,
		DateFormatter,
		getLocalTimeZone,
		parseDate,
		today,
		type DateValue
	} from '@internationalized/date';
	import { Calendar } from '$ui/calendar';
	import * as Popover from '$ui/popover';
	import * as Select from '$ui/select';
	import { formatDate } from '$i18n/formats';
	import { m } from '$i18n/paraglide/messages';
	import { getLocale } from '$i18n/paraglide/runtime';
	import { cn } from '$utils';

	let {
		value = $bindable(''),
		id,
		name,
		placeholder = m.date_picker_placeholder(),
		clearable = false,
		required = false,
		disabled = false,
		min,
		max,
		class: className,
		ariaLabel
	}: {
		value?: string;
		id?: string;
		name?: string;
		placeholder?: string;
		clearable?: boolean;
		required?: boolean;
		disabled?: boolean;
		min?: string;
		max?: string;
		class?: string;
		ariaLabel?: string;
	} = $props();

	let open = $state(false);

	const parsedValue = $derived.by(() => {
		if (!value) return undefined;
		try {
			return parseDate(value);
		} catch {
			return undefined;
		}
	});

	let placeholderDate = $state<DateValue>(today(getLocalTimeZone()));

	$effect(() => {
		if (parsedValue) {
			placeholderDate = parsedValue;
		}
	});

	const locale = $derived(getLocale());
	const displayText = $derived(value ? formatDate(value, locale) : placeholder);

	const months = $derived.by(() => {
		const formatter = new DateFormatter(locale, { month: 'short' });
		return Array.from({ length: 12 }, (_, i) => {
			const d = new CalendarDate(2026, i + 1, 1);
			return {
				value: String(i + 1),
				label: formatter.format(d.toDate(getLocalTimeZone()))
			};
		});
	});

	const minYear = $derived(min ? parseDate(min).year : 1950);
	const maxYear = $derived(max ? parseDate(max).year : 2050);

	const years = $derived.by(() => {
		const list: { value: string; label: string }[] = [];
		for (let y = minYear; y <= maxYear; y++) {
			list.push({ value: String(y), label: String(y) });
		}
		return list;
	});

	function handleMonthChange(newMonth: string | undefined) {
		if (!newMonth) return;
		placeholderDate = placeholderDate.set({ month: Number(newMonth) });
	}

	function handleYearChange(newYear: string | undefined) {
		if (!newYear) return;
		placeholderDate = placeholderDate.set({ year: Number(newYear) });
	}

	function handleSelect(date: DateValue | undefined) {
		if (date) {
			value = date.toString();
			open = false;
		}
	}

	function clear(event: MouseEvent) {
		event.stopPropagation();
		value = '';
	}
</script>

{#if name}
	<input type="hidden" {name} {value} {required} />
{/if}

<Popover.Root bind:open>
	<div class={cn('relative flex w-full min-w-0 items-center', className)}>
		<Popover.Trigger
			{id}
			role="button"
			aria-label={ariaLabel}
			{disabled}
			class={cn(
				'flex h-9 w-full min-w-0 items-center justify-start rounded-md border border-input bg-transparent px-2.5 py-2 pr-8 text-left text-sm font-normal shadow-xs transition-[color,box-shadow] outline-none hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 dark:hover:bg-input/50',
				!value && 'text-muted-foreground'
			)}
		>
			<CalendarIcon class="mr-2 size-4 shrink-0 opacity-70" />
			<span class="truncate">{displayText}</span>
		</Popover.Trigger>
		{#if clearable && value && !disabled}
			<button
				type="button"
				onclick={clear}
				aria-label={m.date_picker_clear()}
				class="absolute top-1/2 right-2.5 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
			>
				<XIcon class="size-3.5" />
			</button>
		{/if}
	</div>
	<Popover.Content class="z-[60] w-auto p-3" align="start">
		<div class="flex items-center justify-between gap-2 pb-2">
			<Select.Root
				type="single"
				value={String(placeholderDate.month)}
				onValueChange={handleMonthChange}
			>
				<Select.Trigger size="sm" class="h-8 w-[110px] text-xs" aria-label={m.date_picker_month()}>
					{months.find((item) => item.value === String(placeholderDate.month))?.label ??
						m.date_picker_month()}
				</Select.Trigger>
				<Select.Content class="z-[70] max-h-56">
					{#each months as monthItem (monthItem.value)}
						<Select.Item value={monthItem.value} label={monthItem.label}>
							{monthItem.label}
						</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>

			<Select.Root
				type="single"
				value={String(placeholderDate.year)}
				onValueChange={handleYearChange}
			>
				<Select.Trigger size="sm" class="h-8 w-[90px] text-xs" aria-label={m.date_picker_year()}>
					{String(placeholderDate.year)}
				</Select.Trigger>
				<Select.Content class="z-[70] max-h-56">
					{#each years as yearItem (yearItem.value)}
						<Select.Item value={yearItem.value} label={yearItem.label}>
							{yearItem.label}
						</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
		</div>

		<div
			role="presentation"
			onclick={(e) => {
				const target = (e.target as HTMLElement)?.closest('[data-slot="calendar-day"]');
				if (
					target &&
					!target.hasAttribute('data-disabled') &&
					!target.hasAttribute('data-unavailable')
				) {
					open = false;
				}
			}}
		>
			<Calendar
				type="single"
				preventDeselect
				value={parsedValue}
				bind:placeholder={placeholderDate}
				onValueChange={handleSelect}
				minValue={min ? parseDate(min) : undefined}
				maxValue={max ? parseDate(max) : undefined}
			/>
		</div>
	</Popover.Content>
</Popover.Root>
