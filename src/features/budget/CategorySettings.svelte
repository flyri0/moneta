<script lang="ts">
	import { Button } from '$ui/button';
	import { Input } from '$ui/input';
	import { Label } from '$ui/label';
	import { Combobox } from '$ui/combobox';
	import * as Select from '$ui/select';
	import { Switch } from '$ui/switch';
	import { useSession } from '$client/app-state.svelte';
	import { runAction } from '$client/notify';
	import { moveTargets, type GridModel } from '$features/budget/view';
	import type { BudgetCategoryView, BudgetGroupView } from '$db/repos/budget';
	import { groupLabel } from '$i18n/labels';
	import { m } from '$i18n/paraglide/messages';

	let {
		category,
		groups,
		model,
		onDone
	}: {
		category: BudgetCategoryView;
		groups: BudgetGroupView[];
		model: GridModel;
		onDone: () => void;
	} = $props();

	const session = useSession();
	// Card payment categories follow their card: only the rollover toggle applies to them.
	const isCardPayment = $derived(category.ccAccountId !== null);
	const userGroups = $derived(groups.filter((g) => !g.system));
	const currentGroupId = $derived(
		groups.find((g) => g.categories.some((c) => c.id === category.id))?.id ?? ''
	);
	const reassignTargets = $derived(
		moveTargets(model, category.id)
			.filter((t) => !t.group.system)
			.map((t) => ({ value: t.id, label: `${t.group.name} · ${t.name}` }))
	);

	let name = $state('');
	let groupId = $state('');
	let hidden = $state(false);
	let carryover = $state(false);
	let reassignTo = $state('');
	let confirmDelete = $state(false);
	let error = $state<string | null>(null);

	$effect(() => {
		name = category.name;
		groupId = currentGroupId;
		hidden = category.hidden;
		carryover = category.carryoverOverspending;
		reassignTo = '';
		confirmDelete = false;
		error = null;
	});

	async function save(event: SubmitEvent) {
		event.preventDefault();
		const patch = isCardPayment
			? { carryoverOverspending: carryover }
			: { name, groupId, hidden, carryoverOverspending: carryover };
		error = await runAction(() => session.api.categories.update(category.id, patch));
		if (!error) onDone();
	}

	async function remove() {
		if (!confirmDelete) {
			confirmDelete = true;
			return;
		}
		error = await runAction(() =>
			session.api.categories.delete(category.id, reassignTo || undefined)
		);
		if (!error) onDone();
	}
</script>

<form class="grid gap-3" onsubmit={save}>
	<h3 class="text-sm font-medium">{m.category_settings()}</h3>
	{#if isCardPayment}
		<p class="text-xs text-muted-foreground">{m.category_card_payment_note()}</p>
	{:else}
		<div class="grid gap-2">
			<Label for="category-name">{m.category_name()}</Label>
			<Input id="category-name" bind:value={name} required autocomplete="off" />
		</div>
		<div class="grid gap-2">
			<Label for="category-group">{m.category_group()}</Label>
			<Select.Root type="single" bind:value={groupId}>
				<Select.Trigger id="category-group" class="w-full">
					{userGroups.find((g) => g.id === groupId)
						? groupLabel(userGroups.find((g) => g.id === groupId)!)
						: ''}
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
		<div class="flex items-center justify-between gap-4">
			<Label for="category-hidden">{m.category_hidden()}</Label>
			<Switch id="category-hidden" bind:checked={hidden} />
		</div>
	{/if}
	<div class="flex items-center justify-between gap-4">
		<div class="grid gap-1">
			<Label for="category-carryover">{m.category_carryover()}</Label>
			<p class="text-xs text-muted-foreground">{m.category_carryover_hint()}</p>
		</div>
		<Switch id="category-carryover" bind:checked={carryover} />
	</div>
	<Button type="submit" variant="outline">{m.save()}</Button>
</form>

{#if !isCardPayment}
	<div class="grid gap-2">
		<Label for="category-reassign">{m.category_delete_reassign()}</Label>
		<Combobox
			id="category-reassign"
			ariaLabel={m.category_delete_reassign()}
			items={reassignTargets}
			emptyOption={{ value: '', label: m.category_delete_no_reassign() }}
			bind:value={reassignTo}
			placeholder={m.category_delete_no_reassign()}
		/>
		<Button variant="destructive" onclick={remove}>
			{confirmDelete ? m.confirm_delete() : m.category_delete()}
		</Button>
	</div>
{/if}

{#if error}<p class="text-sm text-destructive" role="alert">{error}</p>{/if}
