<script lang="ts">
	import { Button } from '$ui/button';
	import { Combobox } from '$ui/combobox';
	import { Input } from '$ui/input';
	import { Label } from '$ui/label';
	import FormMessage from '$components/FormMessage.svelte';
	import ResponsiveDialog from '$components/ResponsiveDialog.svelte';
	import { nameConflict } from '$features/payees/payees';
	import { useSession } from '$client/app-state.svelte';
	import { runAction, type ActionError } from '$client/notify';
	import type { GroupNode } from '$db/repos/categories';
	import type { Payee } from '$db/repos/payees';
	import { categoryLabel, groupLabel } from '$i18n/labels';
	import { m } from '$i18n/paraglide/messages';

	/** Creates a payee with a name and, optionally, the category its transactions start with. */
	let {
		open = $bindable(false),
		payees,
		tree,
		onCreated
	}: {
		open: boolean;
		payees: Payee[];
		tree: GroupNode[];
		onCreated: (id: string) => void;
	} = $props();

	const session = useSession();
	let name = $state('');
	let categoryId = $state('');
	let busy = $state(false);
	let error = $state<ActionError | null>(null);

	$effect(() => {
		if (!open) return;
		name = '';
		categoryId = '';
		error = null;
	});

	const conflict = $derived(nameConflict(payees, '', name));
	const categoryGroups = $derived(
		tree
			.map((g) => ({
				heading: groupLabel(g),
				items: g.categories
					.filter((c) => !c.hidden)
					.map((c) => ({ value: c.id, label: categoryLabel(c) }))
			}))
			.filter((g) => g.items.length > 0)
	);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (conflict) return;
		busy = true;
		let id = '';
		error = await runAction(async () => {
			id = await session.api.payees.create({
				name,
				defaultCategoryId: categoryId || undefined
			});
		});
		busy = false;
		if (error) return;
		open = false;
		onCreated(id);
	}
</script>

<ResponsiveDialog bind:open title={m.payees_add()}>
	<form class="grid gap-4" onsubmit={submit}>
		<div class="grid gap-2">
			<Label for="new-payee-name">{m.payee_name()}</Label>
			<Input id="new-payee-name" bind:value={name} required autocomplete="off" />
			{#if conflict}
				<p class="text-xs text-destructive">{m.error_payee_exists()}</p>
			{/if}
		</div>
		<div class="grid gap-2">
			<Label for="new-payee-category">{m.payee_default_category()}</Label>
			<Combobox
				id="new-payee-category"
				class="w-full"
				ariaLabel={m.payee_default_category()}
				groups={categoryGroups}
				emptyOption={{ value: '', label: m.payee_default_none() }}
				bind:value={categoryId}
				placeholder={m.payee_default_none()}
			/>
			<p class="text-xs text-muted-foreground">{m.payee_default_category_hint()}</p>
		</div>
		<FormMessage {error} />
		<Button type="submit" disabled={busy || conflict !== null}>{m.payees_add()}</Button>
	</form>
</ResponsiveDialog>
