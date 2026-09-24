<script lang="ts">
	import * as Alert from '$ui/alert';
	import { Button } from '$ui/button';
	import { Combobox } from '$ui/combobox';
	import { Input } from '$ui/input';
	import { Label } from '$ui/label';
	import { Separator } from '$ui/separator';
	import ResponsiveDialog from '$components/ResponsiveDialog.svelte';
	import { mergeTargets, nameConflict } from '$features/payees/payees';
	import { useSession } from '$client/app-state.svelte';
	import { runAction } from '$client/notify';
	import type { GroupNode } from '$db/repos/categories';
	import type { Payee } from '$db/repos/payees';
	import { categoryLabel, groupLabel } from '$i18n/labels';
	import { m } from '$i18n/paraglide/messages';

	/** Renames a payee, sets its default category, merges it into another, or deletes it. */
	let {
		open = $bindable(false),
		payee,
		payees,
		tree
	}: { open: boolean; payee: Payee; payees: Payee[]; tree: GroupNode[] } = $props();

	const session = useSession();
	let name = $state('');
	let mergeTo = $state('');
	let confirmMerge = $state(false);
	let confirmDelete = $state(false);
	let error = $state<string | null>(null);

	$effect(() => {
		if (!open) return;
		name = payee.name;
		mergeTo = '';
		confirmMerge = false;
		confirmDelete = false;
		error = null;
	});

	/** The payee as the live list has it now, e.g. after its default category changed. */
	const current = $derived(payees.find((p) => p.id === payee.id) ?? payee);
	const conflict = $derived(nameConflict(payees, payee.id, name));
	const targets = $derived(
		mergeTargets(payees, payee.id).map((p) => ({ value: p.id, label: p.name }))
	);
	const categoryGroups = $derived(
		tree
			.map((g) => ({
				heading: groupLabel(g),
				items: g.categories
					.filter((c) => !c.hidden || c.id === current.defaultCategoryId)
					.map((c) => ({ value: c.id, label: categoryLabel(c) }))
			}))
			.filter((g) => g.items.length > 0)
	);

	/** Runs a write and shows its error inline; `close` shuts the dialog once it succeeds. */
	async function act(fn: () => Promise<unknown>, close = true) {
		error = await runAction(fn);
		if (!error && close) open = false;
	}

	function rename(event: SubmitEvent) {
		event.preventDefault();
		if (conflict) return;
		void act(() => session.api.payees.rename(payee.id, name));
	}

	function merge(targetId: string) {
		void act(() => session.api.payees.merge(payee.id, targetId));
	}

	function mergeChosen() {
		if (!mergeTo) return;
		if (!confirmMerge) confirmMerge = true;
		else merge(mergeTo);
	}

	function remove() {
		if (!confirmDelete) confirmDelete = true;
		else void act(() => session.api.payees.delete(payee.id));
	}
</script>

<ResponsiveDialog bind:open title={payee.name}>
	<div class="grid gap-4">
		<form class="grid gap-2" onsubmit={rename}>
			<Label for="payee-rename">{m.payee_name()}</Label>
			<div class="flex gap-2">
				<Input id="payee-rename" bind:value={name} required autocomplete="off" />
				<Button type="submit" variant="outline" disabled={conflict !== null}>{m.save()}</Button>
			</div>
		</form>
		{#if conflict}
			<Alert.Root>
				<Alert.Description class="grid gap-2">
					<p>{m.payee_exists({ name: conflict.name })}</p>
					<Button
						variant="outline"
						size="sm"
						class="h-auto min-h-8 max-w-full justify-self-start py-1.5 text-left whitespace-normal"
						onclick={() => merge(conflict.id)}
					>
						{m.payee_merge_into({ name: conflict.name })}
					</Button>
				</Alert.Description>
			</Alert.Root>
		{/if}

		<div class="grid gap-2">
			<Label for="payee-category">{m.payee_default_category()}</Label>
			<Combobox
				id="payee-category"
				class="w-full"
				ariaLabel={m.payee_default_category()}
				groups={categoryGroups}
				emptyOption={{ value: '', label: m.payee_default_none() }}
				value={current.defaultCategoryId ?? ''}
				onSelect={(id) =>
					act(() => session.api.payees.setDefaultCategory(payee.id, id || undefined), false)}
				placeholder={m.payee_default_none()}
			/>
			<p class="text-xs text-muted-foreground">{m.payee_default_category_hint()}</p>
		</div>

		<Separator />

		{#if targets.length > 0}
			<div class="grid gap-2">
				<Label for="payee-merge">{m.payee_merge()}</Label>
				<div class="grid gap-2 md:flex">
					<Combobox
						id="payee-merge"
						class="md:min-w-0 md:flex-1"
						ariaLabel={m.payee_merge()}
						items={targets}
						bind:value={mergeTo}
						onSelect={() => (confirmMerge = false)}
						placeholder={m.payee_merge_choose()}
					/>
					<Button variant="outline" disabled={!mergeTo} onclick={mergeChosen}>
						{confirmMerge ? m.payee_merge_confirm() : m.payee_merge_button()}
					</Button>
				</div>
				<p class="text-xs text-muted-foreground">{m.payee_merge_hint()}</p>
			</div>
		{/if}

		{#if current.transactions === 0}
			<div class="grid gap-1">
				<Button variant="destructive" onclick={remove}>
					{confirmDelete ? m.confirm_delete() : m.payee_delete()}
				</Button>
				<p class="text-xs text-muted-foreground">{m.payee_delete_hint()}</p>
			</div>
		{:else}
			<p class="text-xs text-muted-foreground">{m.payee_in_use_hint()}</p>
		{/if}
		{#if error}<p class="text-sm text-destructive" role="alert">{error}</p>{/if}
	</div>
</ResponsiveDialog>
