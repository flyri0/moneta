<script lang="ts">
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import RegisterRow from '$lib/components/accounts/RegisterRow.svelte';
	import { PAGE_SIZE, registerBalances } from '$lib/accounts/register';
	import { useSession } from '$lib/client/app-state.svelte';
	import { useLive } from '$lib/client/live.svelte';
	import { errorMessage } from '$lib/i18n/errors';
	import { m } from '$lib/paraglide/messages';

	const accountId = $derived(page.params.id ?? '');
	const session = useSession();

	let searchInput = $state('');
	let search = $state('');
	let from = $state('');
	let to = $state('');
	let pages = $state(1);

	// Search as the user types, but not on every keystroke.
	$effect(() => {
		const text = searchInput;
		const timer = setTimeout(() => (search = text), 250);
		return () => clearTimeout(timer);
	});

	const account = useLive(session.client, ['accounts', 'transactions'], () =>
		session.api.accounts.get(accountId)
	);
	const rows = useLive(
		session.client,
		['transactions', 'transaction_splits', 'payees', 'categories', 'accounts'],
		() =>
			session.api.transactions.list({
				accountId,
				search: search || undefined,
				from: from || undefined,
				to: to || undefined,
				limit: pages * PAGE_SIZE
			})
	);
	const balances = $derived(account.data ? registerBalances(account.data) : null);
	const hasMore = $derived((rows.data?.length ?? 0) >= pages * PAGE_SIZE);
</script>

<div class="mx-auto grid max-w-6xl gap-4 p-3 md:p-6">
	{#if account.error && !account.data}
		<p class="text-destructive" role="alert">{errorMessage(account.error)}</p>
	{:else if account.data && balances}
		<header class="flex flex-wrap items-end justify-between gap-3">
			<div>
				<h1 class="text-xl font-semibold" data-testid="register-title">{account.data.name}</h1>
				<dl class="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
					<div class="flex gap-1">
						<dt class="text-muted-foreground">{m.register_cleared_balance()}</dt>
						<dd class="tabular-nums">{session.format(balances.cleared)}</dd>
					</div>
					<div class="flex gap-1">
						<dt class="text-muted-foreground">{m.register_uncleared_balance()}</dt>
						<dd class="tabular-nums">{session.format(balances.uncleared)}</dd>
					</div>
					<div class="flex gap-1">
						<dt class="text-muted-foreground">{m.register_total_balance()}</dt>
						<dd class="font-medium tabular-nums" data-testid="register-balance">
							{session.format(balances.total)}
						</dd>
					</div>
				</dl>
			</div>
		</header>

		<div class="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
			<Input
				type="search"
				bind:value={searchInput}
				placeholder={m.register_search()}
				aria-label={m.register_search()}
			/>
			<div class="flex items-center gap-2">
				<Label for="register-from" class="text-sm text-muted-foreground">{m.register_from()}</Label>
				<Input id="register-from" type="date" bind:value={from} />
			</div>
			<div class="flex items-center gap-2">
				<Label for="register-to" class="text-sm text-muted-foreground">{m.register_to()}</Label>
				<Input id="register-to" type="date" bind:value={to} />
			</div>
		</div>

		<section class="rounded-lg border" aria-label={m.register_transactions()}>
			{#each rows.data ?? [] as row (row.id)}
				<RegisterRow {row} />
			{:else}
				{#if rows.data}
					<p class="p-6 text-center text-muted-foreground">{m.register_empty()}</p>
				{/if}
			{/each}
		</section>
		{#if hasMore}
			<Button variant="outline" onclick={() => pages++}>{m.register_load_more()}</Button>
		{/if}
	{/if}
</div>

<svelte:head><title>{account.data?.name ?? m.nav_accounts()} · {m.app_name()}</title></svelte:head>
