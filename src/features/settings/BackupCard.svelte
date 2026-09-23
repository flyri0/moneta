<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { toast } from 'svelte-sonner';
	import { Input } from '$ui/input';
	import { Switch } from '$ui/switch';
	import BackupEncryptionSetup from './BackupEncryptionSetup.svelte';
	import CheckPasswordDialog from './CheckPasswordDialog.svelte';
	import RestoreDialog from './RestoreDialog.svelte';
	import SettingsGroup from './SettingsGroup.svelte';
	import SettingsRow from './SettingsRow.svelte';
	import CopyList from '$features/backup/CopyList.svelte';
	import { exportBudgetJson, exportTransactionsCsv } from '$features/backup/actions';
	import { backUpNow } from '$features/backup/back-up-now';
	import { BACKUP_ACCEPT } from '$features/backup/target';
	import { getApp, useSession } from '$client/app-state.svelte';
	import { runActionToast } from '$client/notify';
	import { restoreAll } from '$client/session';
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
	/** Whether backups are encrypted; null until the worker says. */
	let encrypted = $state<boolean | null>(null);
	let settingUp = $state(false);
	let changing = $state(false);
	let checking = $state(false);

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

	$effect(() => {
		let current = true;
		session.api.system.backupEncryption().then(
			({ on }) => current && (encrypted = on),
			() => {}
		);
		return () => (current = false);
	});

	/** Turning it on goes through the setup; turning it off only drops the key. */
	function toggleEncryption(on: boolean) {
		if (on) {
			changing = false;
			settingUp = true;
			return;
		}
		void runActionToast(async () => {
			await session.api.system.clearBackupEncryption();
			encrypted = false;
			toast.success(m.backup_encrypted_off());
		});
	}

	function encryptionSet() {
		toast.success(changing ? m.backup_password_changed() : m.backup_encrypted_on());
		encrypted = true;
	}

	/** Restores a saved copy next to the open budget, which is left as it is. */
	async function restoreCopy(bytes: Uint8Array) {
		const restored = await restoreAll(session.api, localStorage, bytes, session.file);
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
	<SettingsRow label={m.backup_now()} onclick={() => backUpNow(session.api)} />
	<SettingsRow stacked label={m.backup_restore()} labelFor="restore-file">
		{#snippet control()}
			<Input
				id="restore-file"
				type="file"
				bind:value={chosen}
				accept={BACKUP_ACCEPT}
				onchange={pick}
			/>
		{/snippet}
	</SettingsRow>
	<SettingsRow
		label={m.backup_encrypt()}
		labelFor="encrypt-backups"
		hint={encrypted ? m.backup_encrypt_on_hint() : m.backup_encrypt_off_hint()}
	>
		{#snippet control()}
			<Switch
				id="encrypt-backups"
				disabled={encrypted === null}
				bind:checked={() => encrypted === true, toggleEncryption}
			/>
		{/snippet}
	</SettingsRow>
	{#if encrypted}
		<SettingsRow
			label={m.backup_change_password()}
			onclick={() => {
				changing = true;
				settingUp = true;
			}}
		/>
		<SettingsRow label={m.backup_check_password()} onclick={() => (checking = true)} />
	{/if}
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
<BackupEncryptionSetup bind:open={settingUp} {changing} ondone={encryptionSet} />
<CheckPasswordDialog bind:open={checking} />
