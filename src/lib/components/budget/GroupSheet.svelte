<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Separator } from '$lib/components/ui/separator';
	import { Switch } from '$lib/components/ui/switch';
	import ResponsiveDialog from '$lib/components/ResponsiveDialog.svelte';
	import { useSession } from '$lib/client/app-state.svelte';
	import { runAction } from '$lib/client/notify';
	import type { BudgetGroupView } from '$lib/db/repos/budget';
	import type { Month } from '$lib/domain/month';
	import { groupLabel } from '$lib/i18n/labels';
	import { m } from '$lib/paraglide/messages';
	import QuickAssignButtons from './QuickAssignButtons.svelte';

	let {
		open = $bindable(false),
		group,
		month
	}: { open: boolean; group: BudgetGroupView; month: Month } = $props();

	const session = useSession();
	let name = $state('');
	let hidden = $state(false);
	let newCategory = $state('');
	let error = $state<string | null>(null);

	$effect(() => {
		if (!open) return;
		name = group.name;
		hidden = group.hidden;
		newCategory = '';
		error = null;
	});

	async function addCategory(event: SubmitEvent) {
		event.preventDefault();
		error = await runAction(() =>
			session.api.categories.create({ groupId: group.id, name: newCategory })
		);
		if (!error) newCategory = '';
	}

	async function save(event: SubmitEvent) {
		event.preventDefault();
		error = await runAction(() => session.api.categories.updateGroup(group.id, { name, hidden }));
		if (!error) open = false;
	}

	async function remove() {
		error = await runAction(() => session.api.categories.deleteGroup(group.id));
		if (!error) open = false;
	}
</script>

<ResponsiveDialog bind:open title={groupLabel(group)}>
	<div class="grid gap-5">
		<QuickAssignButtons
			categoryIds={group.categories.map((c) => c.id)}
			{month}
			onDone={() => (open = false)}
		/>

		{#if group.system}
			<p class="text-xs text-muted-foreground">{m.group_system_note()}</p>
		{:else}
			<Separator />
			<form class="grid gap-2" onsubmit={addCategory}>
				<Label for="group-new-category">{m.group_add_category()}</Label>
				<div class="flex gap-2">
					<Input id="group-new-category" bind:value={newCategory} required autocomplete="off" />
					<Button type="submit" variant="outline">{m.add()}</Button>
				</div>
			</form>
			<Separator />
			<form class="grid gap-3" onsubmit={save}>
				<h3 class="text-sm font-medium">{m.group_settings()}</h3>
				<div class="grid gap-2">
					<Label for="group-name">{m.group_name()}</Label>
					<Input id="group-name" bind:value={name} required autocomplete="off" />
				</div>
				<div class="flex items-center justify-between gap-4">
					<Label for="group-hidden">{m.group_hidden()}</Label>
					<Switch id="group-hidden" bind:checked={hidden} />
				</div>
				<Button type="submit" variant="outline">{m.save()}</Button>
			</form>
			<Button variant="destructive" onclick={remove}>{m.group_delete()}</Button>
		{/if}

		{#if error}<p class="text-sm text-destructive" role="alert">{error}</p>{/if}
	</div>
</ResponsiveDialog>
