<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { AppState, BudgetSession, setApp } from '$lib/client/app-state.svelte';
	import { startDbWorker, type DbWorker } from '$lib/client/db';
	import { openLastBudget, startupError } from '$lib/client/session';
	import { createTabLock, type TabLock } from '$lib/client/tab-lock';
	import type { BudgetMeta } from '$lib/db/repos/meta';
	import { currentMonth } from '$lib/domain/month';
	import Onboarding from './Onboarding.svelte';
	import StartupScreen from './StartupScreen.svelte';

	let { children }: { children: Snippet } = $props();

	const app = new AppState();
	setApp(app);

	let worker: DbWorker | null = $state.raw(null);
	// Without Web Locks (very old browsers) there is no way to coordinate tabs; run unguarded.
	const lock: TabLock | null =
		'locks' in navigator
			? createTabLock({ locks: navigator.locks, channel: new BroadcastChannel('moneta-tab') })
			: null;

	lock?.onLost(async () => {
		await stopWorker();
		app.boot = { kind: 'blocked' };
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
		app.boot = { kind: 'loading' };
		const started = startDbWorker();
		worker = started;
		started.onFatal((err) => {
			if (started !== worker) return;
			app.boot = { kind: 'error', code: 'WORKER_FAILED', message: err.message };
		});
		try {
			const result = await openLastBudget(started.api, localStorage);
			if (started !== worker) return;
			if (result.kind === 'ready') ready(started, result.file, result.meta);
			else app.boot = { kind: 'onboarding' };
		} catch (err) {
			if (started !== worker) return;
			app.boot = { kind: 'error', ...startupError(err) };
		}
	}

	function ready(started: DbWorker, file: string, meta: BudgetMeta) {
		if (started !== worker) return;
		app.session = new BudgetSession(started, file, meta);
		app.boot = { kind: 'ready' };
	}

	async function takeOver() {
		app.boot = { kind: 'loading' };
		await lock?.takeOver();
		await start();
	}

	onMount(() => {
		void (async () => {
			if (!lock || (await lock.tryAcquire())) await start();
			else app.boot = { kind: 'blocked' };
		})();
	});

	$effect(() => app.session?.watchMeta());
</script>

{#if app.boot.kind === 'ready' && app.session}
	{#key app.session.file}
		{@render children()}
	{/key}
{:else if app.boot.kind === 'onboarding' && worker}
	<Onboarding
		api={worker.api}
		onCreated={(file, meta) => {
			if (!worker) return;
			ready(worker, file, meta);
			void goto(resolve('/budget/[month]', { month: currentMonth() }));
		}}
	/>
{:else if app.boot.kind === 'loading' || app.boot.kind === 'blocked' || app.boot.kind === 'error'}
	<StartupScreen boot={app.boot} onTakeOver={takeOver} />
{/if}
