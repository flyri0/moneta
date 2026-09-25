<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { toast } from 'svelte-sonner';
	import { Badge } from '$ui/badge';
	import { Button } from '$ui/button';
	import { Checkbox } from '$ui/checkbox';
	import { Label } from '$ui/label';
	import ResponsiveDialog from '$components/ResponsiveDialog.svelte';
	import FormMessage from '$components/FormMessage.svelte';
	import BackupUnlockForm from '$features/backup/BackupUnlockForm.svelte';
	import { readBackupFile } from '$features/backup/actions';
	import { getApp, useSession } from '$client/app-state.svelte';
	import { runAction, type ActionError } from '$client/notify';
	import { loadRegistry } from '$client/registry';
	import { partlyRestored, planRestore, restoreBackup, type PlannedRestore } from '$client/session';
	import { currentMonth } from '$domain/month';
	import { formatDateTime } from '$i18n/formats';
	import { m } from '$i18n/paraglide/messages';
	import { getLocale } from '$i18n/paraglide/runtime';

	/**
	 * Restores a backup: lists its budgets to pick from, after asking for its password or recovery
	 * key when it is encrypted. A budget already on this device is replaced (and kept as a saved
	 * copy), which needs a second tap after a short wait.
	 */
	let { open = $bindable(false), file }: { open: boolean; file: File | null } = $props();
	const app = getApp();
	const session = useSession();
	/** Seconds the restore button stays disabled after the first tap, with the warning shown. */
	const REPLACE_DELAY = 5;

	/** The worker's token for the backup it checked, to restore it by (`restoreInspected`). */
	let token = $state<string | null>(null);
	/** The picked file while it waits to be unlocked. */
	let locked = $state.raw<Uint8Array | null>(null);
	let createdAt = $state<string | null>(null);
	let plan = $state.raw<PlannedRestore[]>([]);
	let selected = $state<number[]>([]);
	let confirmReplace = $state(false);
	let countdown = $state(0);
	let busy = $state(false);
	let error = $state<ActionError | null>(null);

	const chosen = $derived(plan.filter((p) => selected.includes(p.index)));
	const replacing = $derived(chosen.filter((p) => p.replaces).map((p) => nameOf(p.file)));

	/** The name of a budget on this device. */
	function nameOf(budgetFile: string): string {
		if (budgetFile === session.file) return session.meta.name;
		return loadRegistry(localStorage).budgets.find((b) => b.file === budgetFile)?.name ?? '';
	}

	$effect(() => {
		if (!open || !file) return;
		const picked = file;
		let current = true;
		token = null;
		locked = null;
		createdAt = null;
		plan = [];
		confirmReplace = false;
		countdown = 0;
		error = null;
		busy = true;
		void runAction(async () => {
			const read = await readBackupFile(session.api, picked);
			if (!current) return;
			if (read.encrypted) locked = read.bytes;
			else await load(read.bytes, () => current);
		}).then((message) => {
			if (!current) return;
			error = message;
			busy = false;
		});
		return () => (current = false);
	});

	/** Lists the budgets of a plain backup, unless the dialog moved on to another file. */
	async function load(data: Uint8Array, current: () => boolean = () => true) {
		const info = await session.api.system.inspectBackup(data);
		const existing = await session.api.system.listFiles();
		if (!current()) return;
		locked = null;
		token = info.token;
		createdAt = info.createdAt;
		plan = planRestore(info.budgets, existing, true);
		selected = plan.map((p) => p.index);
	}

	$effect(() => {
		if (countdown <= 0) return;
		const timer = setTimeout(() => countdown--, 1000);
		return () => clearTimeout(timer);
	});

	function toggle(index: number, on: boolean) {
		selected = on ? [...selected, index] : selected.filter((i) => i !== index);
		confirmReplace = false;
		countdown = 0;
	}

	async function restore() {
		if (!token || chosen.length === 0) return;
		if (replacing.length > 0 && !confirmReplace) {
			confirmReplace = true;
			countdown = REPLACE_DELAY;
			return;
		}
		if (countdown > 0) return;
		const data = token;
		busy = true;
		let failure: unknown = null;
		error = await runAction(async () => {
			try {
				const restored = await restoreBackup(session.api, localStorage, data, chosen, session.file);
				app.show(session.client, restored.file, restored.meta);
			} catch (err) {
				failure = err;
				throw err;
			}
		});
		busy = false;
		const partly = partlyRestored(failure);
		if (partly.length > 0) {
			const names = chosen.filter((p) => partly.includes(p.file)).map((p) => p.name);
			error = { message: m.backup_restore_partial({ names: names.join(', ') }) };
		}
		if (error) return;
		open = false;
		toast.success(m.backup_restored());
		void goto(resolve('/budget/[month]', { month: currentMonth() }));
	}
</script>

<ResponsiveDialog
	bind:open
	title={m.backup_restore_title()}
	description={file ? m.backup_restore_file({ file: file.name }) : undefined}
>
	<div class="grid gap-4">
		{#if plan.length > 0}
			{#if createdAt}
				<p class="text-sm text-muted-foreground">
					{m.backup_restore_made({ date: formatDateTime(createdAt, getLocale()) })}
				</p>
			{/if}
			<ul class="divide-y rounded-lg border" data-testid="restore-budgets">
				{#each plan as budget (budget.index)}
					<li class="flex items-center gap-3 px-3 py-2">
						<Checkbox
							id="restore-budget-{budget.index}"
							disabled={busy}
							bind:checked={() => selected.includes(budget.index), (on) => toggle(budget.index, on)}
						/>
						<Label for="restore-budget-{budget.index}" class="min-w-0 flex-1 font-normal">
							<span class="truncate">{budget.name}</span>
						</Label>
						{#if budget.replaces}
							<Badge variant="destructive">
								{m.backup_restore_replaces({ name: nameOf(budget.file) })}
							</Badge>
						{:else}
							<Badge variant="secondary">{m.backup_restore_adds()}</Badge>
						{/if}
					</li>
				{/each}
			</ul>
			<div class="grid gap-1">
				<Button
					variant={replacing.length > 0 ? 'destructive' : 'default'}
					disabled={busy || chosen.length === 0 || countdown > 0}
					onclick={restore}
				>
					{#if !confirmReplace}
						{m.backup_restore_count({ count: chosen.length })}
					{:else if countdown > 0}
						{m.backup_restore_replace_wait({ seconds: countdown })}
					{:else}
						{m.backup_restore_replace_confirm()}
					{/if}
				</Button>
				{#if confirmReplace}
					<p class="text-sm font-medium text-destructive" role="status">
						{m.backup_restore_replace_warning({ names: replacing.join(', ') })}
					</p>
				{/if}
				{#if replacing.length > 0}
					<p class="text-xs text-muted-foreground">{m.backup_restore_replace_hint()}</p>
				{/if}
			</div>
		{:else if locked}
			<p class="text-sm font-medium">{m.backup_unlock_title()}</p>
			<BackupUnlockForm api={session.api} bytes={locked} onunlock={(plain) => load(plain)} />
		{:else if busy}
			<p class="text-sm text-muted-foreground" role="status">{m.backup_restore_reading()}</p>
		{/if}
		<FormMessage {error} />
	</div>
</ResponsiveDialog>
