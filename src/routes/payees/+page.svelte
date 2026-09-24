<script lang="ts">
	import SearchIcon from '@lucide/svelte/icons/search';
	import { Button } from '$ui/button';
	import { Input } from '$ui/input';
	import ResponsiveDialog from '$components/ResponsiveDialog.svelte';
	import PayeeDialog from '$features/payees/PayeeDialog.svelte';
	import PayeeList from '$features/payees/PayeeList.svelte';
	import { editable, filterPayees, unusedCount } from '$features/payees/payees';
	import { useSession } from '$client/app-state.svelte';
	import { useLive } from '$client/live.svelte';
	import { runAction } from '$client/notify';
	import type { Payee } from '$db/repos/payees';
	import { categoryLabel } from '$i18n/labels';
	import { m } from '$i18n/paraglide/messages';

	const session = useSession();
	const payees = useLive(session.client, ['payees', 'transactions', 'schedules'], () =>
		session.api.payees.list()
	);
	const tree = useLive(session.client, ['category_groups', 'categories'], () =>
		session.api.categories.tree()
	);

	let search = $state('');
	let dialogOpen = $state(false);
	let selected = $state<Payee | null>(null);
	let removing = $state(false);
	let removeError = $state<string | null>(null);

	const all = $derived(payees.data ?? []);
	const shown = $derived(
		filterPayees(all, search, (p) => (editable(p) ? p.name : m.register_starting_balance()))
	);
	const unused = $derived(unusedCount(all));
	const categoryNames = $derived(
		new Map((tree.data ?? []).flatMap((g) => g.categories.map((c) => [c.id, categoryLabel(c)])))
	);

	function open(payee: Payee) {
		selected = payee;
		dialogOpen = true;
	}

	function askRemove() {
		removeError = null;
		removing = true;
	}

	async function removeUnused() {
		removeError = await runAction(() => session.api.payees.deleteUnused());
		if (!removeError) removing = false;
	}
</script>

<div class="mx-auto grid max-w-2xl gap-4 p-3 md:p-6 lg:max-w-5xl">
	<header class="flex items-center justify-between gap-2">
		<h1 class="text-xl font-semibold">{m.nav_payees()}</h1>
		{#if unused > 0}
			<Button variant="outline" onclick={askRemove}>
				{m.payees_remove_unused({ count: unused })}
			</Button>
		{/if}
	</header>

	{#if payees.data?.length === 0}
		<div class="rounded-xl border bg-card p-8 text-center text-card-foreground shadow-xs">
			<p class="text-sm text-muted-foreground">{m.payees_empty()}</p>
		</div>
	{:else if payees.data}
		<div class="relative">
			<SearchIcon
				class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
			/>
			<Input
				type="search"
				bind:value={search}
				placeholder={m.payees_search()}
				aria-label={m.payees_search()}
				class="pl-9"
			/>
		</div>
		{#if shown.length === 0}
			<div class="rounded-xl border bg-card p-8 text-center text-card-foreground shadow-xs">
				<p class="text-sm text-muted-foreground">
					{m.payees_no_results({ query: search.trim() })}
				</p>
			</div>
		{:else}
			<PayeeList payees={shown} {categoryNames} onOpen={open} />
		{/if}
	{/if}
</div>

{#if selected}
	<PayeeDialog bind:open={dialogOpen} payee={selected} payees={all} tree={tree.data ?? []} />
{/if}

<ResponsiveDialog bind:open={removing} title={m.payees_remove_unused_title()}>
	<div class="grid gap-4">
		<p class="text-sm text-muted-foreground">
			{m.payees_remove_unused_body({ count: unused })}
		</p>
		{#if removeError}<p class="text-sm text-destructive" role="alert">{removeError}</p>{/if}
		<div class="grid grid-cols-2 gap-2">
			<Button variant="outline" onclick={() => (removing = false)}>{m.cancel()}</Button>
			<Button variant="destructive" onclick={removeUnused}>
				{m.payees_remove_unused_confirm()}
			</Button>
		</div>
	</div>
</ResponsiveDialog>
<svelte:head><title>{m.nav_payees()} · {m.app_name()}</title></svelte:head>
