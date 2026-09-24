<script lang="ts">
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import * as Alert from '$ui/alert';
	import { Button } from '$ui/button';
	import { Label } from '$ui/label';
	import * as Select from '$ui/select';
	import { useSession } from '$client/app-state.svelte';
	import { runAction } from '$client/notify';
	import type { BudgetGroupView } from '$db/repos/budget';
	import { groupLabel } from '$i18n/labels';
	import { m } from '$i18n/paraglide/messages';

	/**
	 * Confirms deleting a group. A group with categories asks which group they move to.
	 * `groups` is every group, hidden ones and hidden categories included.
	 */
	let {
		groupId,
		groups,
		onCancel,
		onDone
	}: {
		groupId: string;
		groups: BudgetGroupView[];
		onCancel: () => void;
		onDone: () => void;
	} = $props();

	const session = useSession();
	const count = $derived(groups.find((g) => g.id === groupId)?.categories.length ?? 0);
	const targets = $derived(groups.filter((g) => !g.system && g.id !== groupId));

	let moveTo = $state('');
	let busy = $state(false);
	let error = $state<string | null>(null);

	const target = $derived(targets.find((g) => g.id === moveTo));
	const ready = $derived(count === 0 || target !== undefined);

	async function remove() {
		if (!ready || busy) return;
		busy = true;
		error = await runAction(() =>
			session.api.categories.deleteGroup(groupId, count > 0 ? moveTo : undefined)
		);
		busy = false;
		if (!error) onDone();
	}
</script>

<div class="grid gap-4">
	{#if count === 0}
		<p class="text-sm text-muted-foreground">{m.group_delete_empty()}</p>
	{:else}
		<Alert.Root variant="destructive">
			<TriangleAlertIcon class="size-4" />
			<Alert.Title>{m.group_delete_has_categories({ count })}</Alert.Title>
			<Alert.Description>
				{targets.length > 0 ? m.group_delete_has_categories_body() : m.error_group_not_empty()}
			</Alert.Description>
		</Alert.Root>
		{#if targets.length > 0}
			<div class="grid gap-2">
				<Label for="group-move-to">{m.group_delete_move_to()}</Label>
				<Select.Root type="single" bind:value={moveTo}>
					<Select.Trigger id="group-move-to" class="w-full">
						{target ? groupLabel(target) : m.group_delete_choose()}
					</Select.Trigger>
					<Select.Content>
						{#each targets as group (group.id)}
							<Select.Item value={group.id} label={groupLabel(group)}>
								{groupLabel(group)}
							</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			</div>
		{/if}
	{/if}

	{#if error}<p class="text-sm text-destructive" role="alert">{error}</p>{/if}

	<div class="grid grid-cols-2 gap-2">
		<Button variant="outline" onclick={onCancel}>{m.cancel()}</Button>
		<Button variant="destructive" disabled={!ready || busy} onclick={remove}>
			{m.group_delete()}
		</Button>
	</div>
</div>
