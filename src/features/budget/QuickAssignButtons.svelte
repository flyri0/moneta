<script lang="ts">
	import { Button } from '$ui/button';
	import FormMessage from '$components/FormMessage.svelte';
	import { useSession } from '$client/app-state.svelte';
	import { runAction, type ActionError } from '$client/notify';
	import { offerUndo } from '$client/undo';
	import type { Month } from '$domain/month';
	import type { QuickAssignStrategy } from '$domain/quick-assign';
	import { m } from '$i18n/paraglide/messages';

	let {
		categoryIds,
		month,
		hasGoals = false,
		onDone
	}: {
		categoryIds: string[];
		month: Month;
		/** Whether one of the categories has a goal, which offers to fund it. */
		hasGoals?: boolean;
		onDone: () => void;
	} = $props();

	const session = useSession();
	let error = $state<ActionError | null>(null);

	const STRATEGIES: { strategy: QuickAssignStrategy; label: () => string }[] = [
		{ strategy: 'goals', label: m.quick_assign_goals },
		{ strategy: 'last-month', label: m.quick_assign_last_month },
		{ strategy: 'cover-overspending', label: m.quick_assign_cover },
		{ strategy: 'clear', label: m.quick_assign_clear }
	];
	/** The averages share one label: "Average spent: 3 mo. 6 mo. 12 mo.". */
	const AVERAGES: { strategy: QuickAssignStrategy; months: number }[] = [
		{ strategy: 'avg-3', months: 3 },
		{ strategy: 'avg-6', months: 6 },
		{ strategy: 'avg-12', months: 12 }
	];
	const CHIP = 'h-7 rounded-full px-3 text-xs';

	async function apply(strategy: QuickAssignStrategy, label: string) {
		const call = session.api.budget.quickAssign({ month, categoryIds, strategy });
		error = await runAction(() => call);
		if (error) return;
		onDone();
		offerUndo(session.client, call, m.budget_quick_assigned({ strategy: label }));
	}
</script>

<section class="grid gap-2">
	<h3 class="text-sm font-medium">{m.quick_assign_title()}</h3>
	<div class="flex flex-wrap gap-1.5">
		{#each STRATEGIES.filter((s) => hasGoals || s.strategy !== 'goals') as { strategy, label } (strategy)}
			<Button variant="outline" size="sm" class={CHIP} onclick={() => apply(strategy, label())}>
				{label()}
			</Button>
		{/each}
	</div>
	<div class="flex flex-wrap items-center gap-1.5">
		<span class="mr-0.5 text-xs text-muted-foreground">{m.quick_assign_average_title()}</span>
		{#each AVERAGES as { strategy, months } (strategy)}
			<Button
				variant="outline"
				size="sm"
				class={CHIP}
				aria-label={m.quick_assign_average({ months })}
				onclick={() => apply(strategy, m.quick_assign_average({ months }))}
			>
				{m.quick_assign_months({ months })}
			</Button>
		{/each}
	</div>
	<FormMessage {error} />
</section>
