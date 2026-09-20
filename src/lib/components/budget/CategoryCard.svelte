<script lang="ts">
	import { useSession } from '$lib/client/app-state.svelte';
	import { categoryProgress } from '$lib/budget/progress';
	import { availableTone } from '$lib/budget/view';
	import type { BudgetCategoryView } from '$lib/db/repos/budget';
	import { m } from '$lib/paraglide/messages';
	import AvailablePill from './AvailablePill.svelte';
	import { TONE_BAR } from './tones';

	let { category, onSelect }: { category: BudgetCategoryView; onSelect: (id: string) => void } =
		$props();

	const session = useSession();
	const progress = $derived(categoryProgress(category));
	const tone = $derived(availableTone(category));
	// An untouched category has nothing to plot, so it stays a single line.
	const untouched = $derived(
		progress.funded === 0 && progress.spent === 0 && progress.inflow === 0
	);

	// The caption is the bar's text alternative, so the bar itself is hidden from assistive tech.
	const caption = $derived.by(() => {
		const p = progress;
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
	});
</script>

<div class="grid gap-2 rounded-lg border px-3 py-2.5" data-testid="category-row">
	<div class="flex items-center justify-between gap-3">
		<button
			type="button"
			class="-my-1 min-w-0 flex-1 truncate py-1 text-left font-medium hover:underline"
			onclick={() => onSelect(category.id)}>{category.name}</button
		>
		<AvailablePill {category} />
	</div>
	{#if !untouched}
		<div class="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
			<div class="h-full rounded-full {TONE_BAR[tone]}" style="width: {progress.percent}%"></div>
		</div>
		<p class="text-xs text-muted-foreground tabular-nums" data-testid="progress">{caption}</p>
	{/if}
</div>
