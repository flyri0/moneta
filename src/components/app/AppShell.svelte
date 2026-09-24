<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import CalendarClockIcon from '@lucide/svelte/icons/calendar-clock';
	import ChartColumnIcon from '@lucide/svelte/icons/chart-column';
	import EllipsisIcon from '@lucide/svelte/icons/ellipsis';
	import LandmarkIcon from '@lucide/svelte/icons/landmark';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import ReceiptTextIcon from '@lucide/svelte/icons/receipt-text';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import UsersIcon from '@lucide/svelte/icons/users';
	import WalletIcon from '@lucide/svelte/icons/wallet';
	import { Button } from '$ui/button';
	import * as Sheet from '$ui/sheet';
	import AccountList from '$features/accounts/AccountList.svelte';
	import TransactionDialog from '$features/transactions/TransactionDialog.svelte';
	import { backUpNow } from '$features/backup/back-up-now';
	import { backupDue } from '$features/backup/reminder';
	import { useSession } from '$client/app-state.svelte';
	import { useLive } from '$client/live.svelte';
	import { persistQuietly } from '$client/persistence';
	import { enterAndReport, scheduleRunner } from '$client/schedules';
	import { currentMonth } from '$domain/month';
	import { m } from '$i18n/paraglide/messages';
	import DemoBanner from './DemoBanner.svelte';

	let { children }: { children: Snippet } = $props();

	/** The banner's own height, so the sidebar and the sticky table headers can sit below it. */
	const APP_TOP = '--app-top: calc(4rem + 1px + env(safe-area-inset-top))';

	const session = useSession();
	const runSchedules = scheduleRunner(session.api);

	/** Enters what automatic schedules have due. The demo keeps its seeded history as is. */
	async function enterSchedules() {
		if (!session.isDemo) await enterAndReport(runSchedules);
	}
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
			href: resolve('/transactions'),
			label: m.nav_transactions(),
			icon: ReceiptTextIcon,
			active: path.startsWith('/transactions')
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
			href: resolve('/payees'),
			label: m.nav_payees(),
			icon: UsersIcon,
			active: path.startsWith('/payees')
		},
		{
			href: resolve('/schedules'),
			label: m.nav_schedules(),
			icon: CalendarClockIcon,
			active: path.startsWith('/schedules')
		},
		{
			href: resolve('/settings'),
			label: m.nav_settings(),
			icon: SettingsIcon,
			active: path.startsWith('/settings')
		}
	]);

	/** On phones, the items after the first four live in the "More" sheet. */
	const barItems = $derived(nav.slice(0, 4));
	const moreItems = $derived(nav.slice(4));
	const moreActive = $derived(moreItems.some((item) => item.active));

	let adding = $state(false);
	let moreOpen = $state(false);
	/** The floating add button shows its label only at the top of the page. */
	let compact = $state(false);

	function trackScroll() {
		compact = window.scrollY > 8;
	}

	// A shorter page can reset the scroll without a scroll event.
	afterNavigate(trackScroll);

	onMount(() => {
		void enterSchedules();
		// Chromium and Safari protect installed or often used apps without a prompt, when asked.
		void persistQuietly(navigator.storage, navigator.userAgent);
		if (session.isDemo || !backupDue(session.meta)) return;
		toast(m.backup_reminder(), {
			duration: 15_000,
			action: { label: m.backup_now(), onClick: () => void backUpNow(session.api) }
		});
	});
</script>

{#snippet bottomLink(item: (typeof nav)[number])}
	<a
		href={item.href}
		aria-current={item.active ? 'page' : undefined}
		class="flex min-w-0 flex-col items-center gap-0.5 px-0.5 py-2 text-[0.6875rem] text-muted-foreground aria-[current=page]:font-medium aria-[current=page]:text-primary"
	>
		<item.icon class="size-5" />
		<span data-nav-label class="max-w-full truncate">{item.label}</span>
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
			<AccountList accounts={accounts.data ?? []} variant="compact" />
		</aside>

		<main class="min-w-0 flex-1 pb-36 md:pb-0">{@render children()}</main>
	</div>

	<button
		type="button"
		onclick={() => (adding = true)}
		aria-label={m.add_transaction()}
		data-compact={compact}
		class="fixed right-4 bottom-[calc(3.5rem+0.75rem+env(safe-area-inset-bottom))] z-40 flex h-14 items-center rounded-full bg-primary pr-[1.125rem] pl-4 text-primary-foreground shadow-lg transition-[padding] duration-200 data-[compact=true]:pr-4 md:hidden"
	>
		<PlusIcon class="size-6 shrink-0" />
		<span
			data-fab-label
			class="overflow-hidden text-sm font-medium whitespace-nowrap transition-[max-width,padding,opacity] duration-200 {compact
				? 'max-w-0 pl-0 opacity-0'
				: 'max-w-40 pl-2'}"
		>
			{m.add_transaction()}
		</span>
	</button>

	<nav
		class="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
		aria-label={m.nav_label()}
		data-scroll-inset="bottom"
	>
		{#each barItems as item (item.label)}
			{@render bottomLink(item)}
		{/each}
		<button
			type="button"
			onclick={() => (moreOpen = true)}
			aria-current={moreActive ? 'page' : undefined}
			aria-haspopup="dialog"
			class="flex min-w-0 flex-col items-center gap-0.5 px-0.5 py-2 text-[0.6875rem] text-muted-foreground aria-[current=page]:font-medium aria-[current=page]:text-primary"
		>
			<EllipsisIcon class="size-5" />
			<span data-nav-label class="max-w-full truncate">{m.nav_more()}</span>
		</button>
	</nav>
</div>

<Sheet.Root bind:open={moreOpen}>
	<Sheet.Content side="bottom" class="pb-[env(safe-area-inset-bottom)]">
		<Sheet.Header>
			<Sheet.Title>{m.nav_more()}</Sheet.Title>
		</Sheet.Header>
		<nav class="grid gap-1 px-2 pb-4" aria-label={m.nav_more()}>
			{#each moreItems as item (item.label)}
				<a
					href={item.href}
					aria-current={item.active ? 'page' : undefined}
					onclick={() => (moreOpen = false)}
					class="flex items-center gap-3 rounded-md px-3 py-3 text-sm hover:bg-muted aria-[current=page]:font-medium aria-[current=page]:text-primary"
				>
					<item.icon class="size-5" />
					{item.label}
				</a>
			{/each}
		</nav>
	</Sheet.Content>
</Sheet.Root>

<TransactionDialog bind:open={adding} accountId={page.params.id} />
<svelte:window onscroll={trackScroll} />
<svelte:document
	onvisibilitychange={() => {
		if (document.visibilityState === 'visible') void enterSchedules();
	}}
/>
