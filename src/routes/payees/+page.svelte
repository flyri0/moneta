<script lang="ts">
	import EraserIcon from '@lucide/svelte/icons/eraser';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import SearchIcon from '@lucide/svelte/icons/search';
	import SearchXIcon from '@lucide/svelte/icons/search-x';
	import UsersIcon from '@lucide/svelte/icons/users';
	import XIcon from '@lucide/svelte/icons/x';
	import { Button } from '$ui/button';
	import { Input } from '$ui/input';
	import ConfirmDialog from '$components/ConfirmDialog.svelte';
	import EmptyState from '$components/EmptyState.svelte';
	import FormMessage from '$components/FormMessage.svelte';
	import LoadingRows from '$components/LoadingRows.svelte';
	import PageHeader from '$components/PageHeader.svelte';
	import AddPayeeDialog from '$features/payees/AddPayeeDialog.svelte';
	import PayeeDialog from '$features/payees/PayeeDialog.svelte';
	import PayeeList from '$features/payees/PayeeList.svelte';
	import { filterPayees, unusedCount } from '$features/payees/payees';
	import { useSession } from '$client/app-state.svelte';
	import { useLive } from '$client/live.svelte';
	import { actionError } from '$client/notify';
	import { offerUndo } from '$client/undo';
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
	let adding = $state(false);
	/** A payee just created, whose dialog opens once the live list has it. */
	let created = $state<string | null>(null);
	let removing = $state(false);

	const all = $derived(payees.data ?? []);
	const shown = $derived(filterPayees(all, search));
	const unused = $derived(unusedCount(all));
	const categoryNames = $derived(
		new Map((tree.data ?? []).flatMap((g) => g.categories.map((c) => [c.id, categoryLabel(c)])))
	);

	async function removeUnused() {
		const call = session.api.payees.deleteUnused();
		const count = await call;
		offerUndo(session.client, call, m.payees_deleted_unused({ count }));
	}

	function open(payee: Payee) {
		selected = payee;
		dialogOpen = true;
	}

	$effect(() => {
		const payee = created && all.find((p) => p.id === created);
		if (!payee) return;
		created = null;
		open(payee);
	});
</script>

<PageHeader title={m.nav_payees()} back={{ route: '/transactions', label: m.nav_transactions() }}>
	{#snippet actions()}
		<Button size="sm" onclick={() => (adding = true)}>
			<PlusIcon />
			{m.payees_add()}
		</Button>
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
		<EmptyState
			framed
			icon={UsersIcon}
			title={m.payees_empty_title()}
			description={m.payees_empty()}
		>
			<Button size="sm" onclick={() => (adding = true)}>
				<PlusIcon />
				{m.payees_add()}
			</Button>
		</EmptyState>
	{:else if payees.data}
		{#if shown.length === 0}
			<EmptyState
				framed
				icon={SearchXIcon}
				description={m.payees_no_results({ query: search.trim() })}
			>
				<Button size="sm" variant="outline" onclick={() => (search = '')}>
					<XIcon />
					{m.payees_clear_search()}
				</Button>
			</EmptyState>
		{:else}
			<PayeeList payees={shown} {categoryNames} onOpen={open} />
		{/if}
		{#if unused > 0 && !search.trim()}
			<div class="flex items-center justify-between gap-3 px-1">
				<span class="text-sm text-muted-foreground">
					{m.payees_unused_count({ count: unused })}
				</span>
				<Button variant="outline" size="sm" onclick={() => (removing = true)}>
					<EraserIcon />
					{m.payees_remove_unused()}
				</Button>
			</div>
		{/if}
	{:else if payees.error}
		<FormMessage error={actionError(payees.error)} />
	{:else}
		<div class="overflow-hidden rounded-xl border bg-card shadow-xs"><LoadingRows /></div>
	{/if}
</div>

<AddPayeeDialog
	bind:open={adding}
	payees={all}
	tree={tree.data ?? []}
	onCreated={(id) => (created = id)}
/>
{#if selected}
	<PayeeDialog bind:open={dialogOpen} payee={selected} payees={all} tree={tree.data ?? []} />
{/if}

<ConfirmDialog
	bind:open={removing}
	title={m.payees_remove_unused_title()}
	body={m.payees_remove_unused_body({ count: unused })}
	confirmLabel={m.payees_remove_unused_confirm()}
	onConfirm={removeUnused}
/>
<svelte:head><title>{m.nav_payees()} · {m.app_name()}</title></svelte:head>
