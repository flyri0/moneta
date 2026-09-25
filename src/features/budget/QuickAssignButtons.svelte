<script lang="ts">
	import { Button } from '$ui/button';
	import FormMessage from '$components/FormMessage.svelte';
	import { useSession } from '$client/app-state.svelte';
	import { runAction, type ActionError } from '$client/notify';
	import type { Month } from '$domain/month';
	import type { QuickAssignStrategy } from '$domain/quick-assign';
	import { m } from '$i18n/paraglide/messages';

	let { categoryIds, month, onDone }: { categoryIds: string[]; month: Month; onDone: () => void } =
		$props();

	const session = useSession();
	let error = $state<ActionError | null>(null);

	const STRATEGIES: { strategy: QuickAssignStrategy; label: () => string }[] = [
		{ strategy: 'last-month', label: m.quick_assign_last_month },
		{ strategy: 'avg-3', label: () => m.quick_assign_average({ months: 3 }) },
		{ strategy: 'avg-6', label: () => m.quick_assign_average({ months: 6 }) },
		{ strategy: 'avg-12', label: () => m.quick_assign_average({ months: 12 }) },
		{ strategy: 'cover-overspending', label: m.quick_assign_cover },
		{ strategy: 'clear', label: m.quick_assign_clear }
	];

	async function apply(strategy: QuickAssignStrategy) {
		error = await runAction(() => session.api.budget.quickAssign({ month, categoryIds, strategy }));
		if (!error) onDone();
	}
</script>

<section class="grid gap-2">
	<h3 class="text-sm font-medium">{m.quick_assign_title()}</h3>
	<div class="grid grid-cols-2 gap-2">
		{#each STRATEGIES as { strategy, label } (strategy)}
			<Button variant="outline" size="sm" onclick={() => apply(strategy)}>{label()}</Button>
		{/each}
	</div>
	<FormMessage {error} />
</section>
