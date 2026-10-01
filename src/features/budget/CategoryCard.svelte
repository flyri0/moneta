<script lang="ts">
	import { useSession } from '$client/app-state.svelte';
	import { categoryProgress, type CategoryProgress } from '$features/budget/progress';
	import { availableTone } from '$features/budget/view';
	import type { BudgetCategoryView } from '$db/repos/budget';
	import { m } from '$i18n/paraglide/messages';
	import AvailablePill from './AvailablePill.svelte';
	import { TONE_BAR, TONE_ROW } from './tones';

	let { category, onSelect }: { category: BudgetCategoryView; onSelect: (id: string) => void } =
		$props();

	const session = useSession();
	const progress = $derived(categoryProgress(category));
	const tone = $derived(availableTone(category));
	// An untouched category has nothing to plot, so it stays a single line. A goal still shows.
	const untouched = $derived(
		progress.funded === 0 && progress.spent === 0 && progress.inflow === 0 && !progress.goal
	);

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

<div
	class="relative grid gap-2 px-4 py-3 transition-colors hover:bg-muted/40 {TONE_ROW[tone]}"
	data-testid="category-row"
	data-tone={tone}
>
	<div class="flex items-center justify-between gap-3">
		<button
			type="button"
			class="-my-1 min-w-0 flex-1 cursor-pointer truncate py-1 text-left font-medium after:absolute after:inset-0 hover:underline"
			onclick={() => onSelect(category.id)}>{category.name}</button
		>
		<AvailablePill {category} />
	</div>
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
</div>
