<script module lang="ts">
	let teardown: Promise<void> | null = null;
</script>

<script lang="ts">
	import { onDestroy, onMount, type Snippet } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { AppState, setApp } from '$client/app-state.svelte';
	import { startDbWorker, type DbWorker } from '$client/db';
	import { openLastBudget, startupError, type OpenResult } from '$client/session';
	import { applyServiceWorkerUpdate, onNeedRefresh } from '$client/sw';
	import { createTabLock, type TabLock } from '$client/tab-lock';
	import type { BudgetMeta } from '$db/repos/meta';
	import { currentMonth } from '$domain/month';
	import { m } from '$i18n/paraglide/messages';
	import Onboarding from '$features/onboarding/Onboarding.svelte';
	import AppShell from './AppShell.svelte';
	import RecoveryScreen from './RecoveryScreen.svelte';
	import StartupScreen from './StartupScreen.svelte';

	let { children }: { children: Snippet } = $props();

	const app = new AppState();
	setApp(app);

	let mounted = true;
	let worker: DbWorker | null = $state.raw(null);
	// Without Web Locks (very old browsers) there is no way to coordinate tabs; run unguarded.
	const lock: TabLock | null =
		'locks' in navigator
			? createTabLock({ locks: navigator.locks, channel: new BroadcastChannel('moneta-tab') })
			: null;

	onDestroy(() => {
		mounted = false;
		const prevTeardown = teardown;
		teardown = (async () => {
			await prevTeardown?.catch(() => {});
			await stopWorker();
			await lock?.release();
		})();
	});

	lock?.onLost(async () => {
		await stopWorker();
		if (mounted) app.boot = { kind: 'blocked' };
	});

	async function stopWorker() {
		const current = worker;
		worker = null;
		app.session = null;
		if (!current) return;
		await current.api.system.release().catch(() => {});
		current.terminate();
	}

	async function start() {
		if (!mounted) return;
		app.boot = { kind: 'loading' };
		const started = startDbWorker();
		worker = started;
		started.onFatal((err) => {
			if (started !== worker) return;
			app.boot = { kind: 'error', code: 'WORKER_FAILED', message: err.message };
		});
		try {
			const result = await openLastBudget(started.api, localStorage);
			if (started !== worker || !mounted) {
				if (started === worker) await stopWorker();
				return;
			}
			apply(started, result);
		} catch (err) {
			if (started !== worker || !mounted) {
				if (started === worker) await stopWorker();
				return;
			}
			app.boot = { kind: 'error', ...startupError(err) };
		}
	}

	function apply(started: DbWorker, result: OpenResult) {
		app.apply(started, result);
		if (result.kind === 'ready' && result.skipped)
			toast.warning(m.startup_skipped({ names: result.skipped.map((b) => b.name).join(', ') }));
	}

	function ready(started: DbWorker, file: string, meta: BudgetMeta) {
		if (started === worker) app.show(started, file, meta);
	}

	/** Back from creating another budget (Settings): reopen the budget that was open. */
	async function cancelOnboarding() {
		const session = app.session;
		if (!worker || !session) return;
		try {
			await worker.api.system.open(session.file);
			app.boot = { kind: 'ready' };
		} catch (err) {
			app.boot = { kind: 'error', ...startupError(err) };
		}
	}

	async function takeOver() {
		app.boot = { kind: 'loading' };
		await lock?.takeOver();
		await start();
	}

	/**
	 * Installs a waiting app update (spec §8): let in-flight calls finish, close the database
	 * cleanly, then activate the new service worker, which reloads the page.
	 */
	async function applyUpdate() {
		app.boot = { kind: 'loading' };
		await worker?.idle();
		await stopWorker();
		await applyServiceWorkerUpdate();
	}

	onMount(() => {
		onNeedRefresh(() => {
			toast(m.update_available(), {
				duration: Number.POSITIVE_INFINITY,
				action: { label: m.startup_reload(), onClick: () => void applyUpdate() }
			});
		});
		void (async () => {
			if (teardown) {
				await teardown.catch(() => {});
				teardown = null;
			}
			if (!mounted) return;
			if (!lock || (await lock.tryAcquire())) {
				if (!mounted) {
					await lock?.release();
					return;
				}
				await start();
			} else {
				if (!mounted) return;
				app.boot = { kind: 'blocked' };
			}
		})();
	});

	$effect(() => app.session?.watchMeta());
</script>

{#if app.boot.kind === 'ready' && app.session}
	{#key app.session.file}
		<AppShell>{@render children()}</AppShell>
	{/key}
{:else if app.boot.kind === 'onboarding' && worker}
	<Onboarding
		api={worker.api}
		onCreated={(file, meta) => {
			if (!worker) return;
			ready(worker, file, meta);
			void goto(resolve('/budget/[month]', { month: currentMonth() }));
		}}
		onCancel={app.session ? cancelOnboarding : undefined}
	/>
{:else if app.boot.kind === 'unreadable' && worker}
	{@const started = worker}
	<RecoveryScreen
		api={started.api}
		budgets={app.boot.budgets}
		onResult={(result) => apply(started, result)}
		onNew={() => (app.boot = { kind: 'onboarding' })}
	/>
{:else if app.boot.kind === 'loading' || app.boot.kind === 'blocked' || app.boot.kind === 'error'}
	<StartupScreen boot={app.boot} onTakeOver={takeOver} />
{/if}
