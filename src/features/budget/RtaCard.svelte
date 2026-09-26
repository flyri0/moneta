<script lang="ts">
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import { useSession } from '$client/app-state.svelte';
	import type { BudgetMonthView } from '$db/repos/budget';
	import { rtaTone, type RtaTone } from '$features/budget/view';
	import { m } from '$i18n/paraglide/messages';
	import { RTA_CARD, RTA_ICON, RTA_TEXT } from './tones';

	let {
		view,
		ref = $bindable()
	}: {
		view: BudgetMonthView;
		/** The card, for the page to watch it scroll away and bring it back. */
		ref?: HTMLElement;
	} = $props();
	const session = useSession();
	let expanded = $state(false);

	const HINTS: Record<RtaTone, () => string> = {
		assigned: m.budget_rta_assigned_hint,
		unassigned: m.budget_rta_unassigned_hint,
		overassigned: m.budget_rta_overassigned_hint
	};

	// Zero is the goal: it shows as done, and anything else asks to be dealt with.
	const tone = $derived(rtaTone(view.readyToAssign));
	const Icon = $derived(RTA_ICON[tone]);
</script>

<section
	bind:this={ref}
	class="grid gap-3 rounded-xl border p-4 text-card-foreground shadow-xs transition-colors {RTA_CARD[
		tone
	]}"
	aria-label={m.budget_ready_to_assign()}
	data-testid="rta-card"
	data-tone={tone}
>
	<button
		type="button"
		class="group flex w-full cursor-pointer items-center justify-between text-left focus-visible:outline-hidden"
		aria-expanded={expanded}
		onclick={() => (expanded = !expanded)}
	>
		<div class="grid gap-1">
			<span
				class="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-muted-foreground uppercase"
			>
				<Icon class="size-4 shrink-0 {RTA_TEXT[tone]}" aria-hidden="true" />
				{m.budget_ready_to_assign()}
			</span>
			<span
				class="text-2xl font-bold tracking-tight tabular-nums {RTA_TEXT[tone]}"
				data-testid="rta-amount"
			>
				{session.format(view.readyToAssign)}
			</span>
			<span class="text-sm {RTA_TEXT[tone]}" data-testid="rta-hint">{HINTS[tone]()}</span>
		</div>
		<div
			class="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors group-hover:bg-muted group-hover:text-foreground"
		>
			<ChevronDownIcon class="size-5 transition-transform {expanded ? 'rotate-180' : ''}" />
		</div>
	</button>

	{#if expanded}
		<div class="grid gap-2 border-t border-inherit pt-3 sm:grid-cols-3 sm:gap-3">
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
