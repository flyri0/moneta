<script lang="ts">
	import ResponsiveDialog from '$lib/components/ResponsiveDialog.svelte';
	import type { BudgetGroupView } from '$lib/db/repos/budget';
	import type { Month } from '$lib/domain/month';
	import { groupLabel } from '$lib/i18n/labels';
	import QuickAssignButtons from './QuickAssignButtons.svelte';

	let {
		open = $bindable(false),
		group,
		month
	}: { open: boolean; group: BudgetGroupView; month: Month } = $props();
</script>

<ResponsiveDialog bind:open title={groupLabel(group)}>
	<QuickAssignButtons
		categoryIds={group.categories.map((c) => c.id)}
		{month}
		onDone={() => (open = false)}
	/>
</ResponsiveDialog>
