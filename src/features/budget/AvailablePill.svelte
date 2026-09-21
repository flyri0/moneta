<script lang="ts">
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import { useSession } from '$client/app-state.svelte';
	import { availableTone } from '$features/budget/view';
	import type { BudgetCategoryView } from '$db/repos/budget';
	import { TONE_PILL } from './tones';

	let { category }: { category: Pick<BudgetCategoryView, 'available' | 'carryoverOverspending'> } =
		$props();
	const session = useSession();

	const tone = $derived(availableTone(category));
</script>

<span
	class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-sm font-medium tabular-nums {TONE_PILL[
		tone
	]}"
	data-testid="available"
	data-tone={tone}
>
	<span>{session.format(category.available)}</span>
	{#if tone === 'carryover'}
		<ArrowRightIcon
			class="size-3.5 shrink-0 text-amber-900/80 dark:text-amber-200/80"
			aria-hidden="true"
		/>
	{/if}
</span>
