<script lang="ts">
	import IconLabel from '$components/IconLabel.svelte';
	import { availableTone } from '$features/budget/view';
	import type { BudgetCategoryView } from '$db/repos/budget';
	import AvailablePill from './AvailablePill.svelte';
	import CategoryProgressBar from './CategoryProgressBar.svelte';
	import { TONE_ROW } from './tones';

	let { category, onSelect }: { category: BudgetCategoryView; onSelect: (id: string) => void } =
		$props();

	const tone = $derived(availableTone(category));
</script>

<div
	class="relative grid gap-2 px-4 py-3 transition-colors hover:bg-muted/40 {TONE_ROW[tone]}"
	data-testid="category-row"
	data-tone={tone}
	data-tour="category"
>
	<div class="flex items-center justify-between gap-3">
		<button
			type="button"
			data-testid="category-name"
			class="-my-1 min-w-0 flex-1 cursor-pointer truncate py-1 text-left font-medium after:absolute after:inset-0 hover:underline"
			onclick={() => onSelect(category.id)}
			><IconLabel icon={category.icon} label={category.name} /></button
		>
		<AvailablePill {category} />
	</div>
	<CategoryProgressBar {category} />
</div>
