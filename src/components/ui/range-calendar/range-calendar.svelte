<script lang="ts">
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import { RangeCalendar as RangeCalendarPrimitive } from 'bits-ui';
	import { buttonVariants } from '$ui/button/index.js';
	import { cn, type WithoutChildrenOrChild } from '$utils';

	/**
	 * A calendar that selects a range of days. The month and year are chosen outside (see
	 * `DateRangePicker`), which sets `placeholder`; the heading only labels the month shown.
	 */
	let {
		ref = $bindable(null),
		value = $bindable(),
		placeholder = $bindable(),
		class: className,
		weekdayFormat = 'short',
		locale = 'en-US',
		...restProps
	}: WithoutChildrenOrChild<RangeCalendarPrimitive.RootProps> = $props();

	const cell =
		'relative size-(--cell-size) p-0 text-center text-sm focus-within:z-20 data-[selected]:bg-accent first:data-[selected]:rounded-s-(--cell-radius) last:data-[selected]:rounded-e-(--cell-radius) data-[selection-start]:rounded-s-(--cell-radius) data-[selection-end]:rounded-e-(--cell-radius)';
	const day = cn(
		'flex size-(--cell-size) flex-col items-center justify-center rounded-(--cell-radius) p-0 text-sm leading-none font-normal whitespace-nowrap select-none',
		'not-data-selected:hover:bg-accent/50 not-data-selected:hover:text-accent-foreground',
		'[&[data-today]:not([data-selected])]:bg-accent [&[data-today]:not([data-selected])]:text-accent-foreground',
		'data-[selected]:text-accent-foreground',
		'data-[selection-start]:bg-primary data-[selection-start]:text-primary-foreground data-[selection-end]:bg-primary data-[selection-end]:text-primary-foreground',
		'data-[outside-month]:text-muted-foreground',
		'data-[disabled]:pointer-events-none data-[disabled]:text-muted-foreground data-[disabled]:opacity-50',
		'data-[unavailable]:text-muted-foreground data-[unavailable]:line-through',
		'focus:relative focus:border-ring focus:ring-ring/50'
	);
	const navButton = cn(
		buttonVariants({ variant: 'ghost' }),
		'size-(--cell-size) bg-transparent p-0 select-none disabled:opacity-50 rtl:rotate-180'
	);
</script>

<RangeCalendarPrimitive.Root
	bind:value={value as never}
	bind:ref
	bind:placeholder
	{weekdayFormat}
	{locale}
	class={cn(
		'group/calendar bg-background p-3 [--cell-radius:var(--radius-md)] [--cell-size:--spacing(8)] in-data-[slot=popover-content]:bg-transparent',
		className
	)}
	{...restProps}
>
	{#snippet children({ months, weekdays })}
		<div class="relative flex flex-col gap-4">
			<nav class="absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1">
				<RangeCalendarPrimitive.PrevButton class={navButton}>
					<ChevronLeftIcon class="size-4" />
				</RangeCalendarPrimitive.PrevButton>
				<RangeCalendarPrimitive.NextButton class={navButton}>
					<ChevronRightIcon class="size-4" />
				</RangeCalendarPrimitive.NextButton>
			</nav>
			{#each months as month (month)}
				<div class="flex w-full flex-col gap-4">
					<RangeCalendarPrimitive.Header
						class="flex h-(--cell-size) w-full items-center justify-center text-sm font-medium capitalize"
					>
						<RangeCalendarPrimitive.Heading />
					</RangeCalendarPrimitive.Header>
					<RangeCalendarPrimitive.Grid class="flex w-full border-collapse flex-col">
						<RangeCalendarPrimitive.GridHead>
							<RangeCalendarPrimitive.GridRow class="flex select-none">
								{#each weekdays as weekday, i (i)}
									<RangeCalendarPrimitive.HeadCell
										class="w-(--cell-size) rounded-md text-[0.8rem] font-normal text-muted-foreground"
									>
										{weekday.replace(/\.$/, '')}
									</RangeCalendarPrimitive.HeadCell>
								{/each}
							</RangeCalendarPrimitive.GridRow>
						</RangeCalendarPrimitive.GridHead>
						<RangeCalendarPrimitive.GridBody>
							{#each month.weeks as weekDates (weekDates)}
								<RangeCalendarPrimitive.GridRow class="mt-2 flex w-full">
									{#each weekDates as date (date)}
										<RangeCalendarPrimitive.Cell {date} month={month.value} class={cell}>
											<RangeCalendarPrimitive.Day data-slot="calendar-day" class={day} />
										</RangeCalendarPrimitive.Cell>
									{/each}
								</RangeCalendarPrimitive.GridRow>
							{/each}
						</RangeCalendarPrimitive.GridBody>
					</RangeCalendarPrimitive.Grid>
				</div>
			{/each}
		</div>
	{/snippet}
</RangeCalendarPrimitive.Root>
