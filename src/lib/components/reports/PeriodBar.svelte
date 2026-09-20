<script lang="ts">
	import ResponsiveDialog from '$lib/components/ResponsiveDialog.svelte';
	import { Button } from '$lib/components/ui/button';
	import { DatePicker } from '$lib/components/ui/date-picker';
	import { Label } from '$lib/components/ui/label';
	import * as Select from '$lib/components/ui/select';
	import { MAX_DATE, MIN_DATE } from '$lib/domain/month';
	import { formatDate } from '$lib/i18n/formats';
	import { type DateRange, RANGE_PRESETS, type RangePreset } from '$lib/reports/range';
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';

	/** The one period control on the page: it scopes every report below it. */
	let {
		preset = $bindable(),
		custom = $bindable(),
		range
	}: {
		preset: RangePreset | 'custom';
		custom: DateRange;
		range: DateRange;
	} = $props();

	const PRESETS: Record<RangePreset, () => string> = {
		this_month: m.reports_range_this_month,
		last_month: m.reports_range_last_month,
		last_3_months: m.reports_range_last_3_months,
		last_12_months: m.reports_range_last_12_months,
		this_year: m.reports_range_this_year,
		all: m.reports_range_all
	};

	/** What the select shows. It only becomes `preset` once a custom range is applied. */
	let choice = $state<RangePreset | 'custom'>(preset);
	let editing = $state(false);
	let draft = $state<DateRange>({ ...custom });

	const summary = $derived(
		preset === 'all'
			? m.reports_range_all()
			: `${formatDate(range.from, getLocale())} – ${formatDate(range.to, getLocale())}`
	);

	function choose() {
		if (choice === 'custom') {
			draft = { ...range };
			editing = true;
			return;
		}
		preset = choice;
	}

	function apply() {
		custom = { ...draft };
		preset = 'custom';
		editing = false;
	}

	// Dismissing the dialog without applying leaves the select on a choice that never took; put
	// it back on what is actually in force.
	$effect(() => {
		if (!editing) choice = preset;
	});
</script>

<div
	class="flex flex-wrap items-center gap-2 rounded-xl border bg-card px-3 py-2 text-card-foreground"
>
	<Label
		for="report-period"
		class="text-xs font-medium tracking-wide text-muted-foreground uppercase"
	>
		{m.reports_period()}
	</Label>
	<Select.Root
		type="single"
		bind:value={choice}
		onValueChange={(v) => {
			if (v) {
				choice = v as RangePreset | 'custom';
				choose();
			}
		}}
	>
		<Select.Trigger id="report-period" size="sm" class="min-w-0 flex-1 sm:flex-none">
			{choice === 'custom' ? m.reports_range_custom() : PRESETS[choice as RangePreset]()}
		</Select.Trigger>
		<Select.Content>
			{#each RANGE_PRESETS as value (value)}
				<Select.Item {value} label={PRESETS[value]()}>{PRESETS[value]()}</Select.Item>
			{/each}
			<Select.Item value="custom" label={m.reports_range_custom()}>
				{m.reports_range_custom()}
			</Select.Item>
		</Select.Content>
	</Select.Root>
	<button
		type="button"
		aria-label={m.reports_custom_range()}
		onclick={() => {
			draft = { ...range };
			editing = true;
		}}
		class="ml-auto max-w-full truncate rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground {preset ===
		'custom'
			? ''
			: 'hidden sm:block'}"
	>
		{summary}
	</button>
</div>

<ResponsiveDialog bind:open={editing} title={m.reports_custom_range()}>
	<div class="grid gap-3 py-2">
		<div class="grid gap-2">
			<Label for="report-from">{m.register_from()}</Label>
			<DatePicker
				id="report-from"
				ariaLabel={m.register_from()}
				min={MIN_DATE}
				max={MAX_DATE}
				bind:value={draft.from}
				required
			/>
		</div>
		<div class="grid gap-2">
			<Label for="report-to">{m.register_to()}</Label>
			<DatePicker
				id="report-to"
				ariaLabel={m.register_to()}
				min={MIN_DATE}
				max={MAX_DATE}
				bind:value={draft.to}
				required
			/>
		</div>
		<Button onclick={apply} disabled={draft.from > draft.to}>{m.reports_apply()}</Button>
	</div>
</ResponsiveDialog>
