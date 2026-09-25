<script lang="ts">
	import { untrack } from 'svelte';
	import { Input } from '$ui/input';
	import { Label } from '$ui/label';
	import * as Select from '$ui/select';
	import { Switch } from '$ui/switch';
	import FormMessage from '$components/FormMessage.svelte';
	import { useSession } from '$client/app-state.svelte';
	import { runAction, type ActionError } from '$client/notify';
	import type { BudgetCategoryView, BudgetGroupView } from '$db/repos/budget';
	import type { CategoryPatch } from '$db/repos/categories';
	import { groupLabel } from '$i18n/labels';
	import { m } from '$i18n/paraglide/messages';

	/** A category's settings. Each field saves on its own: switches when flipped, the name on change. */
	let { category, groups }: { category: BudgetCategoryView; groups: BudgetGroupView[] } = $props();

	const session = useSession();
	const userGroups = $derived(groups.filter((g) => !g.system));
	const currentGroupId = $derived(
		groups.find((g) => g.categories.some((c) => c.id === category.id))?.id ?? ''
	);
	const isIncome = $derived(groups.find((g) => g.id === currentGroupId)?.system === 'income');
	const selectedGroup = $derived(userGroups.find((g) => g.id === groupId));

	let name = $state('');
	let groupId = $state('');
	let hidden = $state(false);
	let carryover = $state(false);
	let error = $state<ActionError | null>(null);

	/** Shows the saved values again, dropping edits. */
	function reset() {
		name = category.name;
		groupId = currentGroupId;
		hidden = category.hidden;
		carryover = category.carryoverOverspending;
	}

	// A derived id changes only when the category does, not on every refresh of the same category.
	const categoryId = $derived(category.id);

	// Only the category's id is tracked: a live refresh must not wipe a name being typed.
	$effect(() => {
		void categoryId;
		untrack(() => {
			reset();
			error = null;
		});
	});

	async function save(patch: CategoryPatch) {
		error = await runAction(() => session.api.categories.update(category.id, patch));
		if (error) reset();
	}

	/** Saves a changed name (Enter or leaving the field); an emptied one goes back to the saved name. */
	function saveName() {
		if (name.trim() === '' || name.trim() === category.name) {
			name = category.name;
			return;
		}
		void save({ name });
	}
</script>

<div class="grid gap-3">
	<div class="grid divide-y rounded-lg border">
		<!-- Enter fires `change` itself; the form only makes the phone keyboard offer to submit. -->
		<form class="grid gap-2 p-3" onsubmit={(e) => e.preventDefault()}>
			<Label for="category-name">{m.category_name()}</Label>
			<Input id="category-name" bind:value={name} onchange={saveName} required autocomplete="off" />
		</form>
		{#if !isIncome}
			<div class="grid gap-2 p-3">
				<Label for="category-group">{m.category_group()}</Label>
				<Select.Root
					type="single"
					bind:value={groupId}
					onValueChange={(value) => value !== currentGroupId && save({ groupId: value })}
				>
					<Select.Trigger id="category-group" class="w-full">
						{selectedGroup ? groupLabel(selectedGroup) : ''}
					</Select.Trigger>
					<Select.Content>
						{#each userGroups as group (group.id)}
							<Select.Item value={group.id} label={groupLabel(group)}>
								{groupLabel(group)}
							</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			</div>
		{/if}
		<div class="flex min-h-12 items-center justify-between gap-4 p-3">
			<Label for="category-hidden">{m.category_hidden()}</Label>
			<Switch
				id="category-hidden"
				bind:checked={hidden}
				onCheckedChange={(checked) => save({ hidden: checked })}
			/>
		</div>
		{#if !isIncome}
			<div class="flex items-center justify-between gap-4 p-3">
				<div class="grid gap-1">
					<Label for="category-carryover">{m.category_carryover()}</Label>
					<p class="text-xs text-muted-foreground">{m.category_carryover_hint()}</p>
				</div>
				<Switch
					id="category-carryover"
					bind:checked={carryover}
					onCheckedChange={(checked) => save({ carryoverOverspending: checked })}
				/>
			</div>
		{/if}
	</div>
	<FormMessage {error} />
</div>
