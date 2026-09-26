<script lang="ts">
	import EraserIcon from '@lucide/svelte/icons/eraser';
	import SearchIcon from '@lucide/svelte/icons/search';
	import { Button } from '$ui/button';
	import { Input } from '$ui/input';
	import ConfirmDialog from '$components/ConfirmDialog.svelte';
	import LoadingRows from '$components/LoadingRows.svelte';
	import PageHeader from '$components/PageHeader.svelte';
	import PayeeDialog from '$features/payees/PayeeDialog.svelte';
	import PayeeList from '$features/payees/PayeeList.svelte';
	import { filterPayees, unusedCount } from '$features/payees/payees';
	import { useSession } from '$client/app-state.svelte';
	import { useLive } from '$client/live.svelte';
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

	const all = $derived(payees.data ?? []);
	const shown = $derived(filterPayees(all, search));
	const unused = $derived(unusedCount(all));
	const categoryNames = $derived(
		new Map((tree.data ?? []).flatMap((g) => g.categories.map((c) => [c.id, categoryLabel(c)])))
	);

	function open(payee: Payee) {
		selected = payee;
		dialogOpen = true;
	}
</script>

<PageHeader title={m.nav_payees()}>
	{#snippet actions()}
		{#if unused > 0}
			<Button variant="outline" size="sm" onclick={() => (removing = true)}>
				<EraserIcon />
				{m.payees_remove_unused({ count: unused })}
			</Button>
		{/if}
	{/snippet}
	{#snippet toolbar()}
		{#if payees.data && payees.data.length > 0}
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
		{/if}
	{/snippet}
</PageHeader>

<div class="mx-auto grid max-w-2xl gap-4 p-3 md:p-6 lg:max-w-5xl">
	{#if payees.data?.length === 0}
		<div class="rounded-xl border bg-card p-8 text-center text-card-foreground shadow-xs">
			<p class="text-sm text-muted-foreground">{m.payees_empty()}</p>
		</div>
	{:else if payees.data}
		{#if shown.length === 0}
			<div class="rounded-xl border bg-card p-8 text-center text-card-foreground shadow-xs">
				<p class="text-sm text-muted-foreground">
					{m.payees_no_results({ query: search.trim() })}
				</p>
			</div>
		{:else}
			<PayeeList payees={shown} {categoryNames} onOpen={open} />
		{/if}
	{:else if !payees.error}
		<div class="overflow-hidden rounded-xl border bg-card shadow-xs"><LoadingRows /></div>
	{/if}
</div>

{#if selected}
	<PayeeDialog bind:open={dialogOpen} payee={selected} payees={all} tree={tree.data ?? []} />
{/if}

<ConfirmDialog
	bind:open={removing}
	title={m.payees_remove_unused_title()}
	body={m.payees_remove_unused_body({ count: unused })}
	confirmLabel={m.payees_remove_unused_confirm()}
	onConfirm={() => session.api.payees.deleteUnused()}
/>
<svelte:head><title>{m.nav_payees()} · {m.app_name()}</title></svelte:head>
