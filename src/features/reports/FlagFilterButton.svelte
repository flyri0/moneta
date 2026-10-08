<script lang="ts">
	import FlagIcon from '@lucide/svelte/icons/flag';
	import { Button } from '$ui/button';
	import ResponsiveDialog from '$components/ResponsiveDialog.svelte';
	import type { FlagFilter } from '$domain/flag';
	import FlagFilterField from '$features/flags/FlagFilterField.svelte';
	import { flagFilterLabel } from '$features/flags/flags';
	import { useFlags } from '$features/flags/use-flags.svelte';
	import { m } from '$i18n/paraglide/messages';
	import { period } from './period.svelte';

	/**
	 * The reports' flag filter: a button that says what it keeps, and a dialog to pick the flags.
	 * The pick is shared by the report pages, like the period, and takes effect on Apply.
	 */
	const flags = useFlags();
	let open = $state(false);
	let draft = $state.raw<FlagFilter>([]);

	$effect(() => {
		if (open) draft = [...period.flags];
	});

	function apply() {
		period.flags = draft;
		open = false;
	}
</script>

<Button
	variant={period.flags.length > 0 ? 'secondary' : 'outline'}
	size="sm"
	class="max-w-48"
	aria-label="{m.reports_filter_flags()}: {flagFilterLabel(period.flags, flags.data)}"
	data-testid="report-flag-filter"
	onclick={() => (open = true)}
>
	<FlagIcon />
	<span class="truncate">
		{period.flags.length > 0 ? flagFilterLabel(period.flags, flags.data) : m.reports_filter_flags()}
	</span>
</Button>

<ResponsiveDialog
	bind:open
	title={m.reports_filter_flags_title()}
	description={m.reports_filter_flags_body()}
>
	<div class="grid gap-4 py-2">
		<FlagFilterField
			bind:value={draft}
			flags={flags.data}
			ariaLabel={m.reports_filter_flags_title()}
		/>
		<Button
			variant="ghost"
			class="justify-self-start"
			disabled={draft.length === 0}
			onclick={() => (draft = [])}
		>
			{m.register_clear_filters()}
		</Button>
		<div class="grid grid-cols-2 gap-2">
			<Button variant="outline" onclick={() => (open = false)}>{m.cancel()}</Button>
			<Button onclick={apply}>{m.register_filter_apply()}</Button>
		</div>
	</div>
</ResponsiveDialog>
