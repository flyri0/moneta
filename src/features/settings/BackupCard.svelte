<script lang="ts">
	import { Input } from '$ui/input';
	import RestoreDialog from './RestoreDialog.svelte';
	import SettingsGroup from './SettingsGroup.svelte';
	import SettingsRow from './SettingsRow.svelte';
	import { backUp, exportBudgetJson, exportTransactionsCsv } from '$features/backup/actions';
	import { useSession } from '$client/app-state.svelte';
	import { runActionToast } from '$client/notify';
	import { formatDateTime } from '$i18n/formats';
	import { m } from '$i18n/paraglide/messages';

	const session = useSession();
	let restoring = $state(false);
	let picked = $state<File | null>(null);
	let chosen = $state('');

	function pick(event: Event & { currentTarget: HTMLInputElement }) {
		picked = event.currentTarget.files?.[0] ?? null;
		// Clear the input so choosing the same file again still fires `change`.
		chosen = '';
		if (picked) restoring = true;
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
