<script lang="ts">
	import CalendarIcon from '@lucide/svelte/icons/calendar';
	import SearchIcon from '@lucide/svelte/icons/search';
	import { Button } from '$ui/button';
	import { DatePicker } from '$ui/date-picker';
	import { Input } from '$ui/input';
	import { Label } from '$ui/label';
	import type { RegisterFilters } from '$features/accounts/register-filters.svelte';
	import { m } from '$i18n/paraglide/messages';

	/**
	 * The register's search and date range, for the page header's toolbar. On phones the dates wait
	 * behind a button, so the sticky header stays short; a date that's set keeps them in sight.
	 */
	let { filters }: { filters: RegisterFilters } = $props();

	let open = $state(false);
	const dated = $derived(!!filters.from || !!filters.to);
	const showDates = $derived(open || dated);
</script>

<div class="grid gap-2 md:flex md:items-center md:gap-3">
	<div class="flex gap-2 md:flex-1">
		<div class="relative flex-1">
			<SearchIcon
				class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
			/>
			<Input
				type="search"
				bind:value={filters.searchInput}
				placeholder={m.register_search()}
				aria-label={m.register_search()}
				class="pl-9"
			/>
		</div>
		<Button
			variant="outline"
			class="relative md:hidden"
			aria-expanded={showDates}
			aria-controls="register-dates"
			onclick={() => (open = !open || dated)}
		>
			<CalendarIcon />
			{m.register_dates()}
			{#if dated}
				<span class="absolute top-1 right-1 size-1.5 rounded-full bg-primary" aria-hidden="true"
				></span>
			{/if}
		</Button>
	</div>
	<div
		id="register-dates"
		class="{showDates ? 'grid' : 'hidden'} grid-cols-2 gap-2 md:flex md:items-center md:gap-2"
	>
		<div class="flex items-center gap-1.5">
			<Label for="register-from" class="shrink-0 text-xs font-medium text-muted-foreground">
				{m.register_from()}
			</Label>
			<DatePicker
				id="register-from"
				bind:value={filters.from}
				clearable
				placeholder={m.register_from()}
				class="w-full md:w-36"
			/>
		</div>
		<div class="flex items-center gap-1.5">
			<Label for="register-to" class="shrink-0 text-xs font-medium text-muted-foreground">
				{m.register_to()}
			</Label>
			<DatePicker
				id="register-to"
				bind:value={filters.to}
				clearable
				placeholder={m.register_to()}
				class="w-full md:w-36"
			/>
		</div>
	</div>
</div>
