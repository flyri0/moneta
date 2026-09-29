<script lang="ts">
	import ForwardIcon from '@lucide/svelte/icons/forward';
	import { Switch } from '$ui/switch';
	import { useSession } from '$client/app-state.svelte';
	import { runActionToast } from '$client/notify';
	import type { BudgetCategoryView } from '$db/repos/budget';
	import { m } from '$i18n/paraglide/messages';

	/** A category's "roll overspending over" switch, as a row of the sheet's list. Saves when flipped. */
	let { category }: { category: Pick<BudgetCategoryView, 'id' | 'carryoverOverspending'> } =
		$props();

	const session = useSession();
	let checked = $derived(category.carryoverOverspending);

	async function save(value: boolean) {
		let failed = false;
		await runActionToast(async () => {
			try {
				await session.api.categories.update(category.id, { carryoverOverspending: value });
			} catch (err) {
				failed = true;
				throw err;
			}
		});
		// The saved value didn't change, so the switch goes back to it.
		if (failed) checked = category.carryoverOverspending;
	}
</script>

<div class="flex min-h-11 items-center gap-3 px-2 py-1.5 text-sm">
	<ForwardIcon class="size-4 shrink-0" aria-hidden="true" />
	<label for="category-carryover" class="grid flex-1 gap-0.5">
		<span>{m.category_carryover()}</span>
		<span class="text-xs text-muted-foreground">{m.category_carryover_hint()}</span>
	</label>
	<Switch id="category-carryover" bind:checked onCheckedChange={save} />
</div>
