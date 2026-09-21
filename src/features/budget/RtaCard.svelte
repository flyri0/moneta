<script lang="ts">
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import { useSession } from '$client/app-state.svelte';
	import type { BudgetMonthView } from '$db/repos/budget';
	import { m } from '$i18n/paraglide/messages';

	let { view }: { view: BudgetMonthView } = $props();
	const session = useSession();
	let expanded = $state(false);

	const amountTone = $derived(
		view.readyToAssign > 0
			? 'text-emerald-600 dark:text-emerald-400'
			: view.readyToAssign < 0
				? 'text-destructive'
				: ''
	);
</script>

<section
	class="grid gap-3 rounded-xl border bg-card p-4 text-card-foreground shadow-xs"
	aria-label={m.budget_ready_to_assign()}
	data-testid="rta-card"
>
	<button
		type="button"
		class="group flex w-full cursor-pointer items-center justify-between text-left focus-visible:outline-hidden"
		aria-expanded={expanded}
		onclick={() => (expanded = !expanded)}
	>
		<div class="grid gap-1">
			<span class="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
				{m.budget_ready_to_assign()}
			</span>
			<span
				class="text-2xl font-bold tracking-tight tabular-nums {amountTone}"
				data-testid="rta-amount"
			>
				{session.format(view.readyToAssign)}
			</span>
		</div>
		<div
			class="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors group-hover:bg-muted group-hover:text-foreground"
		>
			<ChevronDownIcon class="size-5 transition-transform {expanded ? 'rotate-180' : ''}" />
		</div>
	</button>

	{#if expanded}
		<div class="grid gap-2 border-t pt-3 sm:grid-cols-3 sm:gap-3">
			<div class="flex items-center justify-between sm:grid sm:gap-0.5">
				<span class="text-xs text-muted-foreground">{m.budget_funds_available()}</span>
				<span class="font-medium tabular-nums">{session.format(view.availableFunds)}</span>
			</div>
			<div class="flex items-center justify-between sm:grid sm:gap-0.5">
				<span class="text-xs text-muted-foreground">{m.budget_overspent_last_month()}</span>
				<span class="font-medium tabular-nums">{session.format(-view.overspentLastMonth)}</span>
			</div>
			<div class="flex items-center justify-between sm:grid sm:gap-0.5">
				<span class="text-xs text-muted-foreground">{m.budget_assigned_this_month()}</span>
				<span class="font-medium tabular-nums">{session.format(-view.assignedThisMonth)}</span>
			</div>
		</div>
	{/if}
</section>
