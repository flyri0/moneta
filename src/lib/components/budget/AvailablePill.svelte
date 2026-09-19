<script lang="ts">
	import { useSession } from '$lib/client/app-state.svelte';
	import { availableTone, type AvailableTone } from '$lib/budget/view';
	import type { BudgetCategoryView } from '$lib/db/repos/budget';

	let { category }: { category: Pick<BudgetCategoryView, 'available' | 'cashOverspent'> } =
		$props();
	const session = useSession();

	const TONES: Record<AvailableTone, string> = {
		positive: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
		zero: 'bg-muted text-muted-foreground',
		credit: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
		overspent: 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200'
	};
	const tone = $derived(availableTone(category));
</script>

<span
	class="inline-block rounded-full px-2 py-0.5 text-sm font-medium tabular-nums {TONES[tone]}"
	data-testid="available"
	data-tone={tone}
>
	{session.format(category.available)}
</span>
