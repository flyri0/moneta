<script lang="ts">
	import SearchIcon from '@lucide/svelte/icons/search';
	import { DatePicker } from '$ui/date-picker';
	import { Input } from '$ui/input';
	import { Label } from '$ui/label';
	import type { RegisterFilters } from '$features/accounts/register-filters.svelte';
	import { m } from '$i18n/paraglide/messages';

	/** The register's search and date range, for the page header's toolbar. */
	let { filters }: { filters: RegisterFilters } = $props();
</script>

<div class="grid gap-2 sm:flex sm:items-center sm:gap-3">
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
	<div class="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-2">
		<div class="flex items-center gap-1.5">
			<Label for="register-from" class="shrink-0 text-xs font-medium text-muted-foreground">
				{m.register_from()}
			</Label>
			<DatePicker
				id="register-from"
				bind:value={filters.from}
				clearable
				placeholder={m.register_from()}
				class="w-full sm:w-36"
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
				class="w-full sm:w-36"
			/>
		</div>
	</div>
</div>
