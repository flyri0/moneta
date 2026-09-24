<script lang="ts">
	import { untrack } from 'svelte';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import { Button } from '$ui/button';
	import { Input } from '$ui/input';
	import { Label } from '$ui/label';
	import { Separator } from '$ui/separator';
	import { Switch } from '$ui/switch';
	import ResponsiveDialog from '$components/ResponsiveDialog.svelte';
	import { useSession } from '$client/app-state.svelte';
	import { runAction } from '$client/notify';
	import type { BudgetGroupView } from '$db/repos/budget';
	import type { Month } from '$domain/month';
	import { groupLabel } from '$i18n/labels';
	import { m } from '$i18n/paraglide/messages';
	import GroupDelete from './GroupDelete.svelte';
	import QuickAssignButtons from './QuickAssignButtons.svelte';
	import SheetLink from './SheetLink.svelte';

	/** `group` is the grid's (visible categories only); `groups` is every group, in full. */
	let {
		open = $bindable(false),
		group,
		groups,
		month
	}: { open: boolean; group: BudgetGroupView; groups: BudgetGroupView[]; month: Month } = $props();

	const session = useSession();

	/** The sheet's screen: quick-assign and new categories first, the rest one tap away. */
	let view = $state<'main' | 'settings' | 'delete'>('main');
	let name = $state('');
	let hidden = $state(false);
	let newCategory = $state('');
	let error = $state<string | null>(null);

	const title = $derived(
		{
			main: groupLabel(group),
			settings: m.group_settings(),
			delete: m.group_delete_title({ name: groupLabel(group) })
		}[view]
	);

	// A derived id changes only when the group does, not on every refresh of the same group.
	const groupId = $derived(group.id);

	// Only `open` and the group's id are tracked: a live refresh must not wipe what is being typed.
	$effect(() => {
		if (!open) return;
		void groupId;
		untrack(() => {
			view = 'main';
			reset();
			newCategory = '';
			error = null;
		});
	});

	/** Shows the saved settings again, dropping edits. */
	function reset() {
		name = group.name;
		hidden = group.hidden;
	}

	function go(next: typeof view) {
		view = next;
		reset();
		error = null;
	}

	async function addCategory(event: SubmitEvent) {
		event.preventDefault();
		error = await runAction(() =>
			session.api.categories.create({ groupId: group.id, name: newCategory })
		);
		if (!error) newCategory = '';
	}

	async function save(patch: { name?: string; hidden?: boolean }) {
		error = await runAction(() => session.api.categories.updateGroup(group.id, patch));
		if (error) reset();
		// A hidden group can leave the grid: close rather than let the sheet vanish while open.
		else if (patch.hidden) open = false;
	}

	/** Saves a changed name (Enter or leaving the field); an emptied one goes back to the saved name. */
	function saveName() {
		if (name.trim() === '' || name.trim() === group.name) {
			name = group.name;
			return;
		}
		void save({ name });
	}
</script>

<ResponsiveDialog bind:open {title} onBack={view === 'main' ? undefined : () => go('main')}>
	{#if view === 'main'}
		<div class="grid gap-5">
			<QuickAssignButtons
				categoryIds={group.categories.map((c) => c.id)}
				{month}
				onDone={() => (open = false)}
			/>

			{#if group.system}
				<p class="text-xs text-muted-foreground">{m.group_system_note()}</p>
			{:else}
				<form class="grid gap-2" onsubmit={addCategory}>
					<Label for="group-new-category">{m.group_add_category()}</Label>
					<div class="flex gap-2">
						<Input id="group-new-category" bind:value={newCategory} required autocomplete="off" />
						<Button type="submit" variant="outline">{m.add()}</Button>
					</div>
					{#if error}<p class="text-sm text-destructive" role="alert">{error}</p>{/if}
				</form>

				<Separator />

				<nav class="-mx-2 grid gap-0.5">
					<SheetLink
						icon={SettingsIcon}
						label={m.group_settings()}
						onclick={() => go('settings')}
					/>
					<SheetLink
						icon={Trash2Icon}
						label={m.group_delete()}
						destructive
						onclick={() => go('delete')}
					/>
				</nav>
			{/if}
		</div>
	{:else if view === 'settings'}
		<div class="grid gap-3">
			<div class="grid divide-y rounded-lg border">
				<!-- Enter fires `change` itself; the form only makes the phone keyboard offer to submit. -->
				<form class="grid gap-2 p-3" onsubmit={(e) => e.preventDefault()}>
					<Label for="group-name">{m.group_name()}</Label>
					<Input
						id="group-name"
						bind:value={name}
						onchange={saveName}
						required
						autocomplete="off"
					/>
				</form>
				<div class="flex min-h-12 items-center justify-between gap-4 p-3">
					<Label for="group-hidden">{m.group_hidden()}</Label>
					<Switch
						id="group-hidden"
						bind:checked={hidden}
						onCheckedChange={(checked) => save({ hidden: checked })}
					/>
				</div>
			</div>
			{#if error}<p class="text-sm text-destructive" role="alert">{error}</p>{/if}
		</div>
	{:else}
		<GroupDelete
			groupId={group.id}
			{groups}
			onCancel={() => go('main')}
			onDone={() => (open = false)}
		/>
	{/if}
</ResponsiveDialog>
