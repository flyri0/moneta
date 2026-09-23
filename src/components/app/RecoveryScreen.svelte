<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { Button } from '$ui/button';
	import { Input } from '$ui/input';
	import CopyList from '$features/backup/CopyList.svelte';
	import { BACKUP_ACCEPT } from '$features/backup/target';
	import { runAction } from '$client/notify';
	import {
		deleteBudget,
		restoreAll,
		type OpenResult,
		type SessionApi,
		type UnreadableBudget
	} from '$client/session';
	import type { BudgetCopy } from '$db/api';
	import { m } from '$i18n/paraglide/messages';

	/**
	 * Shown when no budget file could be opened. The files are untouched: from here they can be
	 * deleted one by one, restored from their pre-migration copies, a backup can be restored, or a
	 * new budget started.
	 */
	let {
		api,
		budgets,
		onResult,
		onNew
	}: {
		api: SessionApi;
		budgets: UnreadableBudget[];
		onResult: (result: OpenResult) => void;
		onNew: () => void;
	} = $props();

	let confirming = $state<string | null>(null);
	let busy = $state(false);
	let error = $state<string | null>(null);
	let chosen = $state('');
	let copies = $state<Record<string, BudgetCopy[]>>({});

	$effect(() => {
		let current = true;
		for (const { file } of budgets)
			api.system.listCopies(file).then(
				(list) => current && (copies[file] = list),
				() => {}
			);
		return () => (current = false);
	});

	async function remove(file: string) {
		if (confirming !== file) {
			confirming = file;
			return;
		}
		confirming = null;
		busy = true;
		error = await runAction(async () => {
			// No budget is open, so the file stands in for it: what is left opens next.
			const next = await deleteBudget(api, localStorage, file, file);
			if (next) onResult(next);
		});
		busy = false;
	}

	async function restore(event: Event & { currentTarget: HTMLInputElement }) {
		const picked = event.currentTarget.files?.[0];
		chosen = '';
		if (!picked) return;
		busy = true;
		error = null;
		const bytes = new Uint8Array(await picked.arrayBuffer());
		error = await runAction(() => open(bytes, m.backup_restored()));
		busy = false;
	}

	/** Adds the budgets of a backup, or a copy, and opens one; the unreadable files stay. */
	async function open(bytes: Uint8Array, message: string) {
		const restored = await restoreAll(api, localStorage, bytes);
		void navigator.storage?.persist?.();
		toast.success(message);
		onResult({ kind: 'ready', file: restored.file, meta: restored.meta });
	}
</script>

<main class="flex min-h-dvh items-center justify-center p-6">
	<div class="flex w-full max-w-md flex-col gap-4">
		<p class="text-center text-2xl font-semibold">{m.app_name()}</p>
		<h1 class="text-center text-lg font-medium">{m.startup_unreadable_title()}</h1>
		<p class="text-center text-muted-foreground">{m.startup_unreadable_body()}</p>

		<ul class="divide-y rounded-xl border bg-card text-card-foreground" data-testid="unreadable">
			{#each budgets as budget (budget.file)}
				<li>
					<div class="flex items-center gap-3 p-3">
						<div class="grid min-w-0 flex-1 gap-0.5">
							<span class="truncate text-sm font-medium">{budget.name}</span>
							<span class="text-xs break-words text-muted-foreground">{budget.message}</span>
						</div>
						<Button
							variant="destructive"
							size="sm"
							disabled={busy}
							aria-label={confirming === budget.file
								? undefined
								: m.settings_budget_delete_named({ name: budget.name })}
							onclick={() => remove(budget.file)}
						>
							{confirming === budget.file ? m.confirm_delete() : m.delete()}
						</Button>
					</div>
					{#if copies[budget.file]?.length}
						<CopyList
							{api}
							copies={copies[budget.file]}
							name={budget.name}
							bind:busy
							onRestore={(bytes) => open(bytes, m.backup_copy_restored())}
						/>
					{/if}
				</li>
			{/each}
		</ul>

		<div class="grid gap-1.5">
			<label for="recovery-restore" class="text-sm font-medium">{m.backup_restore()}</label>
			<Input
				id="recovery-restore"
				type="file"
				bind:value={chosen}
				disabled={busy}
				accept={BACKUP_ACCEPT}
				onchange={restore}
			/>
		</div>
		<Button variant="outline" disabled={busy} onclick={onNew}>{m.startup_unreadable_new()}</Button>
		{#if error}<p class="text-sm text-destructive" role="alert">{error}</p>{/if}
	</div>
</main>
