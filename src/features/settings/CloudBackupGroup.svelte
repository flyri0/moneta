<script lang="ts">
	import * as Alert from '$ui/alert';
	import { Button } from '$ui/button';
	import ConfirmDialog from '$components/ConfirmDialog.svelte';
	import CloudRestoreDialog from '$features/backup/cloud/CloudRestoreDialog.svelte';
	import { cloudBackup, cloudProviders } from '$features/backup/cloud/cloud.svelte';
	import { KEEP_PREVIOUS } from '$features/backup/cloud/retention';
	import type { CloudProvider } from '$features/backup/cloud/provider';
	import { useSession } from '$client/app-state.svelte';
	import { runActionToast } from '$client/notify';
	import { errorMessage } from '$i18n/errors';
	import { formatDateTime } from '$i18n/formats';
	import { m } from '$i18n/paraglide/messages';
	import SettingsGroup from './SettingsGroup.svelte';
	import SettingsRow from './SettingsRow.svelte';

	/**
	 * Automatic backups to the user's cloud storage: connect a provider, see how the last backup
	 * went, back up or restore now, disconnect. Hidden in builds without any provider. Backups to
	 * the cloud are always encrypted, so connecting asks for encryption first.
	 */
	let {
		encrypted,
		onNeedEncryption,
		onRestore
	}: {
		/** Whether backups are encrypted; null until known. */
		encrypted: boolean | null;
		onNeedEncryption: () => void;
		onRestore: (file: File) => void;
	} = $props();

	const session = useSession();
	const providers = cloudProviders();
	const provider = $derived(cloudBackup.provider);
	const connection = $derived(cloudBackup.connection);
	const status = $derived(cloudBackup.status);
	const needsSignIn = $derived(
		status.kind === 'failed' &&
			['CLOUD_AUTH_NEEDED', 'CLOUD_PERMISSION_DENIED'].includes(
				(status.error as { code?: string } | null)?.code ?? ''
			)
	);

	let restoring = $state(false);
	let disconnecting = $state(false);
	let signingIn = $state<AbortController | null>(null);

	$effect(() => {
		void cloudBackup.load();
	});

	/** Straight from the click: the provider's popup opens before anything is awaited. */
	function connect(target: CloudProvider) {
		if (encrypted !== true) {
			if (encrypted === false) onNeedEncryption();
			return;
		}
		const abort = new AbortController();
		signingIn = abort;
		void runActionToast(async () => {
			if (await cloudBackup.connect(target, abort.signal)) await cloudBackup.backUpNow(session.api);
		}).finally(() => (signingIn = null));
	}

	function statusText(name: string): string {
		if (status.kind === 'running') return m.cloud_running({ provider: name });
		const last = cloudBackup.settings?.lastUploadAt;
		return last
			? m.cloud_last({ provider: name, date: formatDateTime(last, session.meta.locale) })
			: m.cloud_never({ provider: name });
	}
</script>

{#if providers.length > 0}
	<SettingsGroup title={m.cloud_title()} description={m.cloud_hint({ count: KEEP_PREVIOUS + 1 })}>
		{#if signingIn}
			<div class="flex items-center justify-between gap-3 px-4 py-3">
				<p class="text-sm text-muted-foreground" role="status">
					{m.cloud_connecting({ provider: provider?.name ?? providers[0].name })}
				</p>
				<Button variant="outline" size="sm" onclick={() => signingIn?.abort()}>{m.cancel()}</Button>
			</div>
		{:else if provider && (connection || needsSignIn)}
			<SettingsRow label={provider.name} value={connection?.account} />
			<p class="px-4 py-3 text-sm text-muted-foreground" data-testid="cloud-status">
				{statusText(provider.name)}
			</p>
			{#if status.kind === 'failed'}
				<div class="px-4 pb-3">
					<Alert.Root data-testid="cloud-error">
						<Alert.Description class="grid gap-2">
							<p>{errorMessage(status.error)}</p>
							{#if needsSignIn}
								<Button
									variant="outline"
									size="sm"
									class="justify-self-start"
									onclick={() => connect(provider)}
								>
									{m.cloud_reconnect()}
								</Button>
							{:else if !encrypted}
								<Button
									variant="outline"
									size="sm"
									class="justify-self-start"
									onclick={onNeedEncryption}
								>
									{m.backup_encrypt()}
								</Button>
							{/if}
						</Alert.Description>
					</Alert.Root>
				</div>
			{/if}
			{#if connection}
				<SettingsRow
					label={m.cloud_back_up_now({ provider: provider.name })}
					onclick={() => runActionToast(() => cloudBackup.backUpNow(session.api))}
				/>
				<SettingsRow
					label={m.cloud_restore({ provider: provider.name })}
					onclick={() => (restoring = true)}
				/>
			{/if}
			<SettingsRow label={m.cloud_disconnect()} onclick={() => (disconnecting = true)} />
		{:else}
			{#each providers as target (target.id)}
				<SettingsRow
					label={m.cloud_connect({ provider: target.name })}
					hint={encrypted === false ? m.cloud_needs_encryption() : undefined}
					onclick={() => connect(target)}
				/>
			{/each}
		{/if}
	</SettingsGroup>

	{#if provider}
		<CloudRestoreDialog bind:open={restoring} {provider} onpick={onRestore} />
		<ConfirmDialog
			bind:open={disconnecting}
			title={m.cloud_disconnect_title({ provider: provider.name })}
			body={m.cloud_disconnect_body({ provider: provider.name })}
			confirmLabel={m.cloud_disconnect()}
			onConfirm={() => cloudBackup.disconnect()}
		/>
	{/if}
{/if}
