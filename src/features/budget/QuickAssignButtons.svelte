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
		{ strategy: 'avg-3', label: () => m.quick_assign_average({ months: 3 }) },
		{ strategy: 'avg-6', label: () => m.quick_assign_average({ months: 6 }) },
		{ strategy: 'avg-12', label: () => m.quick_assign_average({ months: 12 }) },
		{ strategy: 'cover-overspending', label: m.quick_assign_cover },
		{ strategy: 'clear', label: m.quick_assign_clear }
	];

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
	<div class="grid grid-cols-2 gap-2">
		{#each STRATEGIES.filter((s) => hasGoals || s.strategy !== 'goals') as { strategy, label } (strategy)}
			<!-- Half a phone's width is short for some labels ("Média gasta (12 meses)"): they wrap. -->
			<Button
				variant="outline"
				size="sm"
				class="h-auto min-h-8 py-1.5 whitespace-normal"
				onclick={() => apply(strategy, label())}>{label()}</Button
			>
		{/each}
	</div>
	<FormMessage {error} />
</section>
