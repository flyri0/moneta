<script lang="ts">
	import { useSession } from '$client/app-state.svelte';
	import { availableTone } from '$features/budget/view';
	import type { BudgetCategoryView } from '$db/repos/budget';
	import { TONE_PILL } from './tones';

	let { category }: { category: Pick<BudgetCategoryView, 'available' | 'cashOverspent'> } =
		$props();
	const session = useSession();

	const tone = $derived(availableTone(category));
</script>

<span
	class="inline-block rounded-full px-2 py-0.5 text-sm font-medium tabular-nums {TONE_PILL[tone]}"
	data-testid="available"
	data-tone={tone}
>
	{session.format(category.available)}
</span>
