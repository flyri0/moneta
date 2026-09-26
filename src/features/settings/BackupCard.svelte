<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { toast } from 'svelte-sonner';
	import FormMessage from '$components/FormMessage.svelte';
	import { Input } from '$ui/input';
	import { Switch } from '$ui/switch';
	import BackupEncryptionSetup from './BackupEncryptionSetup.svelte';
	import CheckPasswordDialog from './CheckPasswordDialog.svelte';
	import CloudBackupGroup from './CloudBackupGroup.svelte';
	import RestoreDialog from './RestoreDialog.svelte';
	import SettingsGroup from './SettingsGroup.svelte';
	import SettingsRow from './SettingsRow.svelte';
	import CopyList from '$features/backup/CopyList.svelte';
	import { exportBudgetJson, exportTransactionsCsv } from '$features/backup/actions';
	import { backUpNow } from '$features/backup/back-up-now';
	import { cloudBackup } from '$features/backup/cloud/cloud.svelte';
	import { BACKUP_ACCEPT } from '$features/backup/target';
	import { getApp, useSession } from '$client/app-state.svelte';
	import { actionError, runActionToast, type ActionError } from '$client/notify';
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
	/** Why the saved copies or the encryption setting couldn't be loaded, shown in the section. */
	let copiesError = $state<ActionError | null>(null);
	let encryptionError = $state<ActionError | null>(null);

	function pick(event: Event & { currentTarget: HTMLInputElement }) {
		picked = event.currentTarget.files?.[0] ?? null;
		// Clear the input so choosing the same file again still fires `change`.
		chosen = '';
		if (picked) restoring = true;
	}

	$effect(() => {
		let current = true;
		copiesError = null;
		session.api.system.listCopies(session.file).then(
			(list) => current && (copies = list),
			(err: unknown) => current && (copiesError = actionError(err))
		);
		return () => (current = false);
	});

	$effect(() => {
		let current = true;
		encryptionError = null;
		session.api.system.backupEncryption().then(
			({ on }) => current && (encrypted = on),
			(err: unknown) => current && (encryptionError = actionError(err))
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
		const cloud = cloudBackup.provider;
		if (cloud) {
			toast.error(m.cloud_disconnect_first({ provider: cloud.name }));
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
		// Backups to the cloud may have stopped for want of encryption.
		if (cloudBackup.connection && cloudBackup.status.kind === 'failed')
			void runActionToast(() => cloudBackup.backUpNow(session.api));
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
	{#if encryptionError || copiesError}
		<div class="grid gap-2 px-4 py-3">
			<FormMessage error={encryptionError} />
			<FormMessage error={copiesError} />
		</div>
	{/if}
</SettingsGroup>

<CloudBackupGroup
	{encrypted}
	onNeedEncryption={() => {
		changing = false;
		settingUp = true;
	}}
	onRestore={(file) => {
		picked = file;
		restoring = true;
	}}
/>

{#if copies.length > 0}
	<SettingsGroup title={m.backup_copies()} description={m.backup_copies_hint()}>
		<CopyList api={session.api} {copies} name={session.meta.name} onRestore={restoreCopy} />
	</SettingsGroup>
{/if}

<SettingsGroup
	title={m.backup_exports()}
	description={encrypted ? m.backup_exports_hint_encrypted() : m.backup_exports_hint()}
>
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
