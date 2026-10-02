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
	import * as Popover from '$ui/popover';
	import { RangeCalendar } from '$ui/range-calendar';
	import * as Select from '$ui/select';
	import { formatDate } from '$i18n/formats';
	import { m } from '$i18n/paraglide/messages';
	import { getLocale } from '$i18n/paraglide/runtime';
	import { cn } from '$utils';

	/** The two ends of a range, as `'YYYY-MM-DD'`; `''` leaves an end open. */
	type Range = { from: string; to: string };

	let {
		value = $bindable({ from: '', to: '' }),
		id,
		placeholder = m.date_range_placeholder(),
		clearable = false,
		disabled = false,
		min,
		max,
		class: className,
		ariaLabel
	}: {
		value?: Range;
		id?: string;
		placeholder?: string;
		clearable?: boolean;
		disabled?: boolean;
		min?: string;
		max?: string;
		class?: string;
		ariaLabel?: string;
	} = $props();

	let open = $state(false);

	function parse(text: string): DateValue | undefined {
		if (!text) return undefined;
		try {
			return parseDate(text);
		} catch {
			return undefined;
		}
	}

	const parsedValue = $derived({ start: parse(value.from), end: parse(value.to) });
	const hasValue = $derived(!!(value.from || value.to));

	let placeholderDate = $state<DateValue>(today(getLocalTimeZone()));

	$effect(() => {
		if (parsedValue.start) placeholderDate = parsedValue.start;
	});

	const locale = $derived(getLocale());
	const displayText = $derived.by(() => {
		if (!hasValue) return placeholder;
		const from = value.from ? formatDate(value.from, locale) : '…';
		const to = value.to ? formatDate(value.to, locale) : '…';
		return `${from} – ${to}`;
	});

	const months = $derived.by(() => {
		const formatter = new DateFormatter(locale, { month: 'short' });
		return Array.from({ length: 12 }, (_, i) => ({
			value: String(i + 1),
			label: formatter.format(new CalendarDate(2026, i + 1, 1).toDate(getLocalTimeZone()))
		}));
	});

	const minYear = $derived(min ? parseDate(min).year : 1950);
	const maxYear = $derived(max ? parseDate(max).year : 2050);
	const years = $derived(
		Array.from({ length: maxYear - minYear + 1 }, (_, i) => String(minYear + i))
	);

	/** Only a complete range is kept: the first click of a new one waits for the second. */
	function handleSelect(range: { start?: DateValue; end?: DateValue } | undefined) {
		if (!range?.start || !range.end) return;
		value = { from: range.start.toString(), to: range.end.toString() };
		open = false;
	}

	function clear(event: MouseEvent) {
		event.stopPropagation();
		value = { from: '', to: '' };
	}
</script>

<Popover.Root bind:open>
	<div class={cn('relative flex w-full min-w-0 items-center', className)}>
		<Popover.Trigger
			{id}
			role="button"
			aria-label={ariaLabel}
			{disabled}
			class={cn(
				'flex h-9 w-full min-w-0 items-center justify-start rounded-md border border-input bg-transparent px-2.5 py-2 pr-8 text-left text-sm font-normal shadow-xs transition-[color,box-shadow] outline-none hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 dark:hover:bg-input/50',
				!hasValue && 'text-muted-foreground'
			)}
		>
			<CalendarIcon class="mr-2 size-4 shrink-0 opacity-70" />
			<span class="truncate">{displayText}</span>
		</Popover.Trigger>
		{#if clearable && hasValue && !disabled}
			<button
				type="button"
				onclick={clear}
				aria-label={m.date_range_clear()}
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
				onValueChange={(v) => v && (placeholderDate = placeholderDate.set({ month: Number(v) }))}
			>
				<Select.Trigger size="sm" class="h-8 w-[110px] text-xs" aria-label={m.date_picker_month()}>
					{months.find((item) => item.value === String(placeholderDate.month))?.label ??
						m.date_picker_month()}
				</Select.Trigger>
				<Select.Content class="z-[70] max-h-56">
					{#each months as item (item.value)}
						<Select.Item value={item.value} label={item.label}>{item.label}</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
			<Select.Root
				type="single"
				value={String(placeholderDate.year)}
				onValueChange={(v) => v && (placeholderDate = placeholderDate.set({ year: Number(v) }))}
			>
				<Select.Trigger size="sm" class="h-8 w-[90px] text-xs" aria-label={m.date_picker_year()}>
					{String(placeholderDate.year)}
				</Select.Trigger>
				<Select.Content class="z-[70] max-h-56">
					{#each years as year (year)}
						<Select.Item value={year} label={year}>{year}</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
		</div>
		<RangeCalendar
			value={parsedValue}
			bind:placeholder={placeholderDate}
			{locale}
			onValueChange={handleSelect}
			minValue={min ? parseDate(min) : undefined}
			maxValue={max ? parseDate(max) : undefined}
		/>
	</Popover.Content>
</Popover.Root>
