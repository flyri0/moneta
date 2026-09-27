<script lang="ts">
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import * as Alert from '$ui/alert';
	import { Button } from '$ui/button';
	import { useSession } from '$client/app-state.svelte';
	import type { BudgetCategoryView } from '$db/repos/budget';
	import { m } from '$i18n/paraglide/messages';

	/**
	 * Says the month has overspending and how much. Review opens the first overspent category; once
	 * it is covered it leaves the list, so the button walks through them one by one.
	 */
	let {
		categories,
		onReview
	}: { categories: BudgetCategoryView[]; onReview: (id: string) => void } = $props();
	const session = useSession();

	const over = $derived(categories.reduce((sum, c) => sum - c.available, 0));
</script>

<!-- A status, not an alert: it is part of the month, not news, and must not interrupt on load. -->
<Alert.Root variant="destructive" role="status" data-testid="overspent-alert">
	<TriangleAlertIcon />
	<Alert.Title>{m.budget_overspent_title({ count: categories.length })}</Alert.Title>
	<Alert.Description>{m.budget_overspent_body({ amount: session.format(over) })}</Alert.Description>
	<Alert.Action>
		<Button variant="outline" size="sm" onclick={() => onReview(categories[0].id)}>
			{m.budget_overspent_review()}
		</Button>
	</Alert.Action>
</Alert.Root>
