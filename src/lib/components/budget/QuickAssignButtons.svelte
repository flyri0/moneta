<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { useSession } from '$lib/client/app-state.svelte';
	import { runAction } from '$lib/client/notify';
	import type { Month } from '$lib/domain/month';
	import type { QuickAssignStrategy } from '$lib/domain/quick-assign';
	import { m } from '$lib/paraglide/messages';

	let { categoryIds, month, onDone }: { categoryIds: string[]; month: Month; onDone: () => void } =
		$props();

	const session = useSession();
	let error = $state<string | null>(null);

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
	{#if error}<p class="text-sm text-destructive" role="alert">{error}</p>{/if}
</section>
