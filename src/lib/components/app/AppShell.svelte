<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import ChartColumnIcon from '@lucide/svelte/icons/chart-column';
	import LandmarkIcon from '@lucide/svelte/icons/landmark';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import WalletIcon from '@lucide/svelte/icons/wallet';
	import { Button } from '$lib/components/ui/button';
	import AccountList from '$lib/components/accounts/AccountList.svelte';
	import TransactionDialog from '$lib/components/transactions/TransactionDialog.svelte';
	import { backUp } from '$lib/backup/actions';
	import { backupDue } from '$lib/backup/reminder';
	import { useSession } from '$lib/client/app-state.svelte';
	import { useLive } from '$lib/client/live.svelte';
	import { runActionToast } from '$lib/client/notify';
	import { currentMonth } from '$lib/domain/month';
	import { m } from '$lib/paraglide/messages';
	import DemoBanner from './DemoBanner.svelte';

	let { children }: { children: Snippet } = $props();

	/** The banner's own height, so the sidebar and the sticky table headers can sit below it. */
	const APP_TOP = '--app-top: calc(2.5rem + 1px + env(safe-area-inset-top))';

	const session = useSession();
	const accounts = useLive(session.client, ['accounts', 'transactions'], () =>
		session.api.accounts.list()
	);

	const path = $derived(page.url.pathname);
	const nav = $derived([
		{
			href: resolve('/budget/[month]', { month: currentMonth() }),
			label: m.nav_budget(),
			icon: WalletIcon,
			active: path.startsWith('/budget')
		},
		{
			href: resolve('/accounts'),
			label: m.nav_accounts(),
			icon: LandmarkIcon,
			active: path.startsWith('/accounts')
		},
		{
			href: resolve('/reports'),
			label: m.nav_reports(),
			icon: ChartColumnIcon,
			active: path.startsWith('/reports')
		},
		{
			href: resolve('/settings'),
			label: m.nav_settings(),
			icon: SettingsIcon,
			active: path.startsWith('/settings')
		}
	]);

	let adding = $state(false);

	onMount(() => {
		if (session.isDemo || !backupDue(session.meta)) return;
		toast(m.backup_reminder(), {
			duration: 15_000,
			action: { label: m.backup_now(), onClick: () => void runActionToast(() => backUp(session)) }
		});
	});
</script>

{#snippet bottomLink(item: (typeof nav)[number])}
	<a
		href={item.href}
		aria-current={item.active ? 'page' : undefined}
		class="flex flex-col items-center gap-0.5 py-2 text-xs text-muted-foreground aria-[current=page]:font-medium aria-[current=page]:text-primary"
	>
		<item.icon class="size-5" />
		{item.label}
	</a>
{/snippet}

<div class="flex min-h-dvh flex-col" style={session.isDemo ? APP_TOP : undefined}>
	{#if session.isDemo}
		<DemoBanner />
	{/if}

	<div class="flex min-h-0 flex-1">
		<aside
			class="sticky top-[var(--app-top,0px)] hidden h-[calc(100dvh-var(--app-top,0px))] w-64 shrink-0 flex-col gap-6 overflow-y-auto border-r bg-sidebar p-3 text-sidebar-foreground md:flex"
		>
			<div class="grid gap-3 px-2 pt-2">
				<div>
					<p class="text-lg font-semibold">{m.app_name()}</p>
					<p class="truncate text-sm text-muted-foreground">{session.meta.name}</p>
				</div>
				<Button size="lg" onclick={() => (adding = true)}>
					<PlusIcon />
					{m.add_transaction()}
				</Button>
			</div>
			<nav class="grid gap-1" aria-label={m.nav_label()}>
				{#each nav as item (item.label)}
					<a
						href={item.href}
						aria-current={item.active ? 'page' : undefined}
						class="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-sidebar-accent aria-[current=page]:bg-sidebar-accent aria-[current=page]:font-medium aria-[current=page]:text-primary"
					>
						<item.icon class="size-4" />
						{item.label}
					</a>
				{/each}
			</nav>
			<AccountList accounts={accounts.data ?? []} />
		</aside>

		<main class="min-w-0 flex-1 pb-24 md:pb-0">{@render children()}</main>
	</div>

	<nav
		class="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
		aria-label={m.nav_label()}
	>
		{#each nav.slice(0, 2) as item (item.label)}
			{@render bottomLink(item)}
		{/each}
		<button
			type="button"
			onclick={() => (adding = true)}
			class="relative flex flex-col items-center justify-end py-2 text-xs text-muted-foreground"
		>
			<!-- Lifted out of the bar without moving the label off the other labels' baseline. -->
			<span
				class="absolute -top-7 left-1/2 flex size-14 -translate-x-1/2 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-background"
			>
				<PlusIcon class="size-6" />
			</span>
			{m.add_transaction()}
		</button>
		{#each nav.slice(2) as item (item.label)}
			{@render bottomLink(item)}
		{/each}
	</nav>
</div>

<TransactionDialog bind:open={adding} accountId={page.params.id} />
