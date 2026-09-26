<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { afterNavigate, preloadCode } from '$app/navigation';
	import { navigating, page } from '$app/state';
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
	import { backUpNow } from '$features/backup/back-up-now';
	import { backupDue } from '$features/backup/reminder';
	import { useSession } from '$client/app-state.svelte';
	import { runWhenIdle } from '$client/idle';
	import { pendingLoads } from '$client/pending';
	import { useLive } from '$client/live.svelte';
	import { persistQuietly } from '$client/persistence';
	import { enterAndReport, scheduleRunner } from '$client/schedules';
	import { currentMonth } from '$domain/month';
	import { m } from '$i18n/paraglide/messages';
	import FormMessage from '$components/FormMessage.svelte';
	import { actionError } from '$client/notify';
	import CrashScreen from './CrashScreen.svelte';
	import DemoBanner from './DemoBanner.svelte';
	import NavProgress from './NavProgress.svelte';

	let { children }: { children: Snippet } = $props();

	/** Keeps an error a boundary caught in the console, for anyone debugging. */
	function logError(error: unknown) {
		console.error(error);
	}

	/**
	 * The banner's own height, so the sidebar, the page header and the toasts can sit below it. Set
	 * on the root, since the toaster lives outside the shell.
	 */
	const APP_TOP = 'calc(4rem + 1px + env(safe-area-inset-top))';

	const session = useSession();

	$effect(() => {
		if (!session.isDemo) return;
		const root = document.documentElement;
		root.style.setProperty('--app-top', APP_TOP);
		return () => root.style.removeProperty('--app-top');
	});

	const runSchedules = scheduleRunner(session.api);

	/** Enters what automatic schedules have due. The demo keeps its seeded history as is. */
	async function enterSchedules() {
		if (!session.isDemo) await enterAndReport(runSchedules);
	}
	const accounts = useLive(session.client, ['accounts', 'transactions'], () =>
		session.api.accounts.list()
	);

	/** Waiting on a page's code or on a query's first result. */
	const busy = $derived(navigating.to !== null || $pendingLoads > 0);

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
	let dialogLoad =
		$state<Promise<typeof import('$features/transactions/TransactionDialog.svelte')>>();
	$effect(() => {
		if (adding) dialogLoad ??= import('$features/transactions/TransactionDialog.svelte');
	});
	let moreOpen = $state(false);
	/** The floating add button shows its label only at the top of the page. */
	let compact = $state(false);

	function trackScroll() {
		compact = window.scrollY > 8;
	}

	// A shorter page can reset the scroll without a scroll event.
	afterNavigate(trackScroll);

	// Each screen's code is loaded and compiled while the app sits idle, so a tap on the nav only
	// has to render. On a phone that compile is most of the wait. The add dialog's code comes last;
	// it still mounts only when first opened.
	onMount(() =>
		runWhenIdle([
			...nav.map((item) => () => preloadCode(item.href)),
			() => import('$features/transactions/TransactionDialog.svelte')
		])
	);

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

<NavProgress {busy} />

<div class="flex min-h-dvh flex-col">
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
			<svelte:boundary onerror={logError}>
				<AccountList accounts={accounts.data ?? []} variant="compact" />
				{#snippet failed(error)}
					<FormMessage error={actionError(error)} class="px-2" />
				{/snippet}
			</svelte:boundary>
		</aside>

		<main class="min-w-0 flex-1 pb-36 md:pb-0" aria-busy={busy}>
			<!-- A screen that throws while rendering shows a way out instead of half a page. -->
			<svelte:boundary onerror={logError}>
				{@render children()}
				{#snippet failed(error, reset)}
					<CrashScreen {error} {reset} />
				{/snippet}
			</svelte:boundary>
		</main>
	</div>

	<button
		type="button"
		onclick={() => (adding = true)}
		aria-label={m.add_transaction()}
		data-compact={compact}
		class="fixed right-4 bottom-[calc(3.5rem+0.75rem+env(safe-area-inset-bottom))] z-40 flex h-11 items-center rounded-full bg-primary pr-3.5 pl-3 text-primary-foreground shadow-lg transition-[padding] duration-200 data-[compact=true]:pr-3 md:hidden"
	>
		<PlusIcon class="size-5 shrink-0" />
		<span
			data-fab-label
			class="overflow-hidden text-sm font-medium whitespace-nowrap transition-[max-width,padding,opacity] duration-200 {compact
				? 'max-w-0 pl-0 opacity-0'
				: 'max-w-40 pl-1.5'}"
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

<!-- Loaded the first time it opens: most starts never add a transaction. -->
{#if dialogLoad}
	{#await dialogLoad then { default: TransactionDialog }}
		<TransactionDialog bind:open={adding} accountId={page.params.id} />
	{/await}
{/if}
<svelte:window onscroll={trackScroll} />
<svelte:document
	onvisibilitychange={() => {
		if (document.visibilityState === 'visible') void enterSchedules();
	}}
/>
