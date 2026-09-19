<script lang="ts">
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import { useSession } from '$lib/client/app-state.svelte';
	import type { BudgetMonthView } from '$lib/db/repos/budget';
	import { m } from '$lib/paraglide/messages';

	let { view }: { view: BudgetMonthView } = $props();
	const session = useSession();
	let expanded = $state(false);

	const tone = $derived(
		view.readyToAssign > 0
			? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200'
			: view.readyToAssign < 0
				? 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200'
				: 'bg-muted text-foreground'
	);
</script>

<div class="rounded-xl {tone}">
	<button
		type="button"
		class="flex w-full items-center justify-between gap-4 px-4 py-3 text-left"
		aria-expanded={expanded}
		onclick={() => (expanded = !expanded)}
	>
		<span>
			<span class="block text-2xl font-semibold tabular-nums" data-testid="rta-amount">
				{session.format(view.readyToAssign)}
			</span>
			<span class="text-sm">{m.budget_ready_to_assign()}</span>
		</span>
		<ChevronDownIcon class="size-5 transition-transform {expanded ? 'rotate-180' : ''}" />
	</button>
	{#if expanded}
		<dl class="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 px-4 pb-3 text-sm">
			<dt>{m.budget_funds_available()}</dt>
			<dd class="text-right tabular-nums">{session.format(view.availableFunds)}</dd>
			<dt>{m.budget_overspent_last_month()}</dt>
			<dd class="text-right tabular-nums">{session.format(-view.overspentLastMonth)}</dd>
			<dt>{m.budget_assigned_this_month()}</dt>
			<dd class="text-right tabular-nums">{session.format(-view.assignedThisMonth)}</dd>
			<dt class="font-medium">{m.budget_ready_to_assign()}</dt>
			<dd class="text-right font-medium tabular-nums">{session.format(view.readyToAssign)}</dd>
		</dl>
	{/if}
</div>
