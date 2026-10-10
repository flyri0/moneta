<script lang="ts">
	import { useSession } from '$client/app-state.svelte';
	import {
		categoryProgress,
		showsSpending,
		type CategoryProgress
	} from '$features/budget/progress';
	import { availableTone } from '$features/budget/view';
	import type { BudgetCategoryView } from '$db/repos/budget';
	import { m } from '$i18n/paraglide/messages';
	import { TONE_BAR } from './tones';

	/** A category's spending bar and its caption, with the goal when it has one. */
	let { category }: { category: BudgetCategoryView } = $props();

	const session = useSession();
	const progress = $derived(categoryProgress(category));
	const tone = $derived(availableTone(category));
	// An untouched category has nothing to plot, so it shows nothing. A goal still shows.
	const untouched = $derived(!showsSpending(progress) && !progress.goal);

	// The caption is the bar's text alternative, so the bar itself is hidden from assistive tech.
	const caption = $derived.by(() => {
		const p = progress;
		const toGo = p.goal?.toGo ?? 0;
		const spending = spendingCaption(p);
		return toGo > 0
			? `${spending} · ${m.budget_goal_to_go({ amount: session.format(toGo) })}`
			: spending;
	});

	function spendingCaption(p: CategoryProgress): string {
		if (p.inflow > 0) return m.budget_progress_inflow({ amount: session.format(p.inflow) });
		if (p.overspent > 0)
			return m.budget_progress_over({
				spent: session.format(p.spent),
				over: session.format(p.overspent)
			});
		return m.budget_progress_spent({
			spent: session.format(p.spent),
			funded: session.format(p.funded)
		});
	}
</script>

{#if !untouched}
	<!-- With a goal the bar spans up to it: the funded part is a shade darker, and a tick marks it. -->
	<div class="relative h-1.5 rounded-full bg-muted" aria-hidden="true">
		{#if progress.goal}
			<div
				class="absolute inset-y-0 left-0 rounded-full bg-muted-foreground/25"
				style="width: {progress.goal.funded}%"
			></div>
		{/if}
		<div
			class="absolute inset-y-0 left-0 rounded-full {TONE_BAR[tone]}"
			style="width: {progress.percent}%"
		></div>
		{#if progress.goal}
			<div
				class="absolute -inset-y-0.5 w-0.5 -translate-x-1/2 rounded-full bg-foreground/60"
				style="left: clamp(1px, {progress.goal.at}%, calc(100% - 1px))"
				data-testid="goal-tick"
			></div>
		{/if}
	</div>
	<p class="text-xs text-muted-foreground tabular-nums" data-testid="progress">{caption}</p>
{/if}
