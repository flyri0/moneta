<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { toast } from 'svelte-sonner';
	import { Input } from '$ui/input';
	import RestoreDialog from './RestoreDialog.svelte';
	import SettingsGroup from './SettingsGroup.svelte';
	import SettingsRow from './SettingsRow.svelte';
	import CopyList from '$features/backup/CopyList.svelte';
	import { backUp, exportBudgetJson, exportTransactionsCsv } from '$features/backup/actions';
	import { getApp, useSession } from '$client/app-state.svelte';
	import { runActionToast } from '$client/notify';
	import { restoreBudget } from '$client/session';
	import type { BudgetCopy } from '$db/api';
	import { currentMonth } from '$domain/month';
	import { formatDateTime } from '$i18n/formats';
	import { m } from '$i18n/paraglide/messages';

	const app = getApp();
	const session = useSession();
	let copies = $state<BudgetCopy[]>([]);
	let restoring = $state(false);
	let picked = $state<File | null>(null);
	let chosen = $state('');

	function pick(event: Event & { currentTarget: HTMLInputElement }) {
		picked = event.currentTarget.files?.[0] ?? null;
		// Clear the input so choosing the same file again still fires `change`.
		chosen = '';
		if (picked) restoring = true;
	}

	$effect(() => {
		let current = true;
		session.api.system.listCopies(session.file).then(
			(list) => current && (copies = list),
			() => {}
		);
		return () => (current = false);
	});

	/** Restores a pre-migration copy next to the open budget, which is left as it is. */
	async function restoreCopy(bytes: Uint8Array) {
		const restored = await restoreBudget(session.api, localStorage, bytes, session.file);
		app.show(session.client, restored.file, restored.meta);
		toast.success(m.backup_copy_restored());
		void goto(resolve('/budget/[month]', { month: currentMonth() }));
	}
</script>

<SettingsGroup title={m.settings_backup()} description={m.backup_hint()}>
	<p class="px-4 py-3 text-sm text-muted-foreground" data-testid="last-backup">
		{session.meta.lastBackupAt
			? m.backup_last({ date: formatDateTime(session.meta.lastBackupAt, session.meta.locale) })
			: m.backup_never()}
	</p>
	<SettingsRow label={m.backup_now()} onclick={() => runActionToast(() => backUp(session))} />
	<SettingsRow stacked label={m.backup_restore()} labelFor="restore-file">
		{#snippet control()}
			<Input
				id="restore-file"
				type="file"
				bind:value={chosen}
				accept=".sqlite,.sqlite3,.db,application/vnd.sqlite3,application/x-sqlite3"
				onchange={pick}
			/>
		{/snippet}
	</SettingsRow>
</SettingsGroup>

{#if copies.length > 0}
	<SettingsGroup title={m.backup_copies()} description={m.backup_copies_hint()}>
		<CopyList api={session.api} {copies} name={session.meta.name} onRestore={restoreCopy} />
	</SettingsGroup>
{/if}

<SettingsGroup title={m.backup_exports()} description={m.backup_exports_hint()}>
	<SettingsRow
		label={m.backup_export_csv()}
		onclick={() => runActionToast(() => exportTransactionsCsv(session))}
	/>
	<SettingsRow
		label={m.backup_export_json()}
		onclick={() => runActionToast(() => exportBudgetJson(session))}
	/>
</SettingsGroup>

<RestoreDialog bind:open={restoring} file={picked} />
