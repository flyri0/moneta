<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { toast } from 'svelte-sonner';
	import FormMessage from '$components/FormMessage.svelte';
	import ResponsiveDialog from '$components/ResponsiveDialog.svelte';
	import * as Alert from '$ui/alert';
	import BackupEncryptionSetup from './BackupEncryptionSetup.svelte';
	import CheckPasswordDialog from './CheckPasswordDialog.svelte';
	import CloudBackupRow from './CloudBackupRow.svelte';
	import EncryptionSheet from './EncryptionSheet.svelte';
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

	/**
	 * The backup card of Settings: when the last backup was, back up or restore now, and a row for
	 * each part used less often (automatic backup, encryption, saved copies, exports), which opens
	 * it in a sheet showing its state on the row.
	 */
	const app = getApp();
	const session = useSession();
	/** The demo is never saved: backing it up, restoring into it or exporting it makes no sense. */
	const demo = $derived(session.isDemo);
	let copies = $state<BudgetCopy[]>([]);
	let restoring = $state(false);
	let backingUp = $state(false);
	let picked = $state<File | null>(null);
	let chosen = $state('');
	let fileInput = $state<HTMLInputElement>();
	/** Which sheet is open. */
	let cloudOpen = $state(false);
	let encryptionOpen = $state(false);
	let copiesOpen = $state(false);
	let exportsOpen = $state(false);
	/** The setup was opened from the automatic backup, which comes back once it is done. */
	let resumeCloud = false;
	/** Whether backups are encrypted; null until the worker says. */
	let encrypted = $state<boolean | null>(null);
	let settingUp = $state(false);
	let changing = $state(false);
	let checking = $state(false);
	/** Why the saved copies or the encryption setting couldn't be loaded, shown in their sheet. */
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
		copies = [];
		if (demo) return;
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

	function setUpEncryption(change: boolean, fromCloud = false) {
		changing = change;
		resumeCloud = fromCloud;
		settingUp = true;
	}

	/** Turning it on goes through the setup; turning it off only drops the key. */
	function toggleEncryption(on: boolean) {
		if (on) {
			setUpEncryption(false);
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
		// Back to connecting, which has to start from a click.
		if (resumeCloud) cloudOpen = true;
		resumeCloud = false;
	}

	/** Restores a saved copy next to the open budget, which is left as it is. */
	async function restoreCopy(bytes: Uint8Array) {
		const restored = await restoreAll(session.api, localStorage, bytes, session.file);
		copiesOpen = false;
		app.show(session.client, restored.file, restored.meta);
		toast.success(m.backup_copy_restored());
		void goto(resolve('/budget/[month]', { month: currentMonth() }));
	}
</script>

<SettingsGroup title={m.settings_backup()} description={m.backup_hint()} testId="backup-card">
	{#if demo}
		<div class="px-4 py-3">
			<Alert.Root data-testid="backup-demo">
				<Alert.Description>{m.backup_demo()}</Alert.Description>
			</Alert.Root>
		</div>
	{/if}
	<p class="px-4 py-3 text-sm text-muted-foreground" data-testid="last-backup">
		{session.meta.lastBackupAt
			? m.backup_last({ date: formatDateTime(session.meta.lastBackupAt, session.meta.locale) })
			: m.backup_never()}
	</p>
	<SettingsRow
		label={m.backup_now()}
		disabled={demo || backingUp}
		onclick={async () => {
			backingUp = true;
			try {
				await backUpNow(session.api);
			} finally {
				backingUp = false;
			}
		}}
	/>
	<SettingsRow label={m.backup_restore()} disabled={demo} onclick={() => fileInput?.click()} />
	<CloudBackupRow
		bind:open={cloudOpen}
		{encrypted}
		disabled={demo}
		onNeedEncryption={() => setUpEncryption(false, true)}
		onRestore={(file) => {
			picked = file;
			restoring = true;
		}}
	/>
	<SettingsRow
		label={m.backup_encryption()}
		value={encrypted === null
			? undefined
			: encrypted
				? m.backup_encryption_on()
				: m.backup_encryption_off()}
		disabled={demo}
		onclick={() => (encryptionOpen = true)}
	/>
	{#if copies.length > 0 || copiesError}
		<SettingsRow
			label={m.backup_copies()}
			value={copies.length > 0 ? String(copies.length) : undefined}
			disabled={demo}
			onclick={() => (copiesOpen = true)}
		/>
	{/if}
	<SettingsRow label={m.backup_exports()} disabled={demo} onclick={() => (exportsOpen = true)} />
</SettingsGroup>

<!-- The row above opens the picker; the label lets tests and assistive tech reach the input. -->
<input
	bind:this={fileInput}
	type="file"
	class="hidden"
	aria-label={m.backup_restore()}
	bind:value={chosen}
	accept={BACKUP_ACCEPT}
	disabled={demo}
	onchange={pick}
/>

<EncryptionSheet
	bind:open={encryptionOpen}
	{encrypted}
	error={encryptionError}
	disabled={demo}
	onToggle={toggleEncryption}
	onChange={() => setUpEncryption(true)}
	onCheck={() => (checking = true)}
/>

<ResponsiveDialog
	bind:open={copiesOpen}
	title={m.backup_copies()}
	description={m.backup_copies_hint()}
>
	<SettingsGroup>
		{#if copies.length > 0}
			<CopyList api={session.api} {copies} name={session.meta.name} onRestore={restoreCopy} />
		{/if}
		{#if copiesError}
			<div class="px-4 py-3"><FormMessage error={copiesError} /></div>
		{/if}
	</SettingsGroup>
</ResponsiveDialog>

<ResponsiveDialog
	bind:open={exportsOpen}
	title={m.backup_exports()}
	description={encrypted ? m.backup_exports_hint_encrypted() : m.backup_exports_hint()}
>
	<SettingsGroup>
		<SettingsRow
			label={m.backup_export_csv()}
			disabled={demo}
			onclick={() => runActionToast(() => exportTransactionsCsv(session))}
		/>
		<SettingsRow
			label={m.backup_export_json()}
			disabled={demo}
			onclick={() => runActionToast(() => exportBudgetJson(session))}
		/>
	</SettingsGroup>
</ResponsiveDialog>

<RestoreDialog bind:open={restoring} file={picked} />
<BackupEncryptionSetup bind:open={settingUp} {changing} ondone={encryptionSet} />
<CheckPasswordDialog bind:open={checking} />
