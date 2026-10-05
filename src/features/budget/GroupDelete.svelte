<script lang="ts">
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import * as Alert from '$ui/alert';
	import { Label } from '$ui/label';
	import ConfirmPanel from '$components/ConfirmPanel.svelte';
	import GroupCombobox from '$features/categories/GroupCombobox.svelte';
	import { NewCategories } from '$features/categories/new-categories';
	import { useSession } from '$client/app-state.svelte';
	import { runAction, type ActionError } from '$client/notify';
	import { offerUndo } from '$client/undo';
	import type { BudgetGroupView } from '$db/repos/budget';
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
	let error = $state<ActionError | null>(null);

	const pending = new NewCategories();

	const ready = $derived(
		count === 0 || targets.some((g) => g.id === moveTo) || NewCategories.isGroupToken(moveTo)
	);

	async function remove() {
		if (!ready || busy) return;
		busy = true;
		let call: Promise<void> | undefined;
		error = await runAction(async () => {
			let target: string | undefined;
			if (count > 0) {
				// A group picked by a new name is created first.
				const ids = await pending.resolve(session.api, [moveTo]);
				target = ids.get(moveTo) ?? moveTo;
			}
			call = session.api.categories.deleteGroup(groupId, target);
			await call;
		});
		busy = false;
		if (error) return;
		onDone();
		if (call) offerUndo(session.client, call, m.group_deleted());
	}
</script>

<ConfirmPanel
	confirmLabel={m.group_delete()}
	{error}
	{busy}
	disabled={!ready}
	{onCancel}
	onConfirm={remove}
>
	{#if count === 0}
		<p class="text-sm text-muted-foreground">{m.group_delete_empty()}</p>
	{:else}
		<Alert.Root variant="destructive">
			<TriangleAlertIcon class="size-4" />
			<Alert.Title>{m.group_delete_has_categories({ count })}</Alert.Title>
			<Alert.Description>
				{m.group_delete_has_categories_body()}
			</Alert.Description>
		</Alert.Root>
		<div class="grid gap-2">
			<Label for="group-move-to">{m.group_delete_move_to()}</Label>
			<GroupCombobox
				id="group-move-to"
				groups={targets}
				{pending}
				bind:value={moveTo}
				placeholder={m.group_delete_choose()}
				ariaLabel={m.group_delete_move_to()}
			/>
		</div>
	{/if}
</ConfirmPanel>
