<script lang="ts">
	import * as Alert from '$ui/alert';
	import { Button } from '$ui/button';
	import ConfirmPanel from '$components/ConfirmPanel.svelte';
	import ResponsiveDialog from '$components/ResponsiveDialog.svelte';
	import CloudRestoreDialog from '$features/backup/cloud/CloudRestoreDialog.svelte';
	import { cloudBackup, cloudProviders } from '$features/backup/cloud/cloud.svelte';
	import { KEEP_PREVIOUS } from '$features/backup/cloud/retention';
	import type { CloudProvider } from '$features/backup/cloud/provider';
	import { useSession } from '$client/app-state.svelte';
	import { runAction, runActionToast, type ActionError } from '$client/notify';
	import { errorMessage } from '$i18n/errors';
	import { formatDateTime } from '$i18n/formats';
	import { m } from '$i18n/paraglide/messages';
	import SettingsGroup from './SettingsGroup.svelte';
	import SettingsRow from './SettingsRow.svelte';

	/**
	 * Automatic backups to the user's cloud storage, as a row of the backup card: which provider and
	 * how the last backup went, or why it failed. The row opens a sheet to connect a provider, back
	 * up or restore now, and disconnect. Hidden in builds without any provider. Backups to the cloud
	 * are always encrypted, so connecting asks for encryption first: `onNeedEncryption` closes the
	 * sheet for the setup, and setting `open` again brings it back. `disabled` turns it all off (the
	 * demo).
	 */
	let {
		open = $bindable(false),
		encrypted,
		disabled = false,
		onNeedEncryption,
		onRestore
	}: {
		open?: boolean;
		/** Whether backups are encrypted; null until known. */
		encrypted: boolean | null;
		disabled?: boolean;
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
	let disconnectError = $state<ActionError | null>(null);
	let busy = $state(false);
	let signingIn = $state<AbortController | null>(null);

	$effect(() => {
		void cloudBackup.load();
	});

	$effect(() => {
		if (!open) return;
		disconnecting = false;
		disconnectError = null;
	});

	/** Straight from the click: the provider's popup opens before anything is awaited. */
	function connect(target: CloudProvider) {
		if (disabled) return;
		if (encrypted !== true) {
			if (encrypted === false) needEncryption();
			return;
		}
		const abort = new AbortController();
		signingIn = abort;
		void runActionToast(async () => {
			if (await cloudBackup.connect(target, abort.signal)) await cloudBackup.backUpNow(session.api);
		}).finally(() => (signingIn = null));
	}

	function needEncryption() {
		open = false;
		onNeedEncryption();
	}

	async function disconnect() {
		busy = true;
		disconnectError = await runAction(() => cloudBackup.disconnect());
		busy = false;
		if (!disconnectError) disconnecting = false;
	}

	function statusText(name: string): string {
		if (status.kind === 'running') return m.cloud_running({ provider: name });
		const last = cloudBackup.settings?.lastUploadAt;
		return last
			? m.cloud_last({ provider: name, date: formatDateTime(last, session.meta.locale) })
			: m.cloud_never({ provider: name });
	}

	const failed = $derived(!!provider && status.kind === 'failed');
	/** The row's hint: why backups stopped, or how the last one went. */
	const rowHint = $derived.by(() => {
		if (!provider) return undefined;
		return status.kind === 'failed' ? errorMessage(status.error) : statusText(provider.name);
	});
</script>

{#if providers.length > 0}
	<SettingsRow
		label={m.cloud_title()}
		value={provider ? provider.name : m.cloud_off()}
		hint={rowHint}
		warn={failed}
		{disabled}
		onclick={() => (open = true)}
	/>

	<ResponsiveDialog
		bind:open
		title={disconnecting && provider
			? m.cloud_disconnect_title({ provider: provider.name })
			: m.cloud_title()}
		description={disconnecting ? undefined : m.cloud_hint({ count: KEEP_PREVIOUS + 1 })}
		onBack={disconnecting ? () => (disconnecting = false) : undefined}
	>
		{#if disconnecting && provider}
			<ConfirmPanel
				body={m.cloud_disconnect_body({ provider: provider.name })}
				confirmLabel={m.cloud_disconnect()}
				error={disconnectError}
				{busy}
				onCancel={() => (disconnecting = false)}
				onConfirm={disconnect}
			/>
		{:else}
			<SettingsGroup>
				{#if signingIn}
					<div class="flex items-center justify-between gap-3 px-4 py-3">
						<p class="text-sm text-muted-foreground" role="status">
							{m.cloud_connecting({ provider: provider?.name ?? providers[0].name })}
						</p>
						<Button variant="outline" size="sm" onclick={() => signingIn?.abort()}>
							{m.cancel()}
						</Button>
					</div>
				{:else if provider && (connection || needsSignIn)}
					<SettingsRow label={provider.name} value={connection?.account} {disabled} />
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
											{disabled}
											onclick={() => connect(provider)}
										>
											{m.cloud_reconnect()}
										</Button>
									{:else if !encrypted}
										<Button
											variant="outline"
											size="sm"
											class="justify-self-start"
											{disabled}
											onclick={needEncryption}
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
							disabled={disabled || status.kind === 'running'}
							onclick={() => runActionToast(() => cloudBackup.backUpNow(session.api))}
						/>
						<SettingsRow
							label={m.cloud_restore({ provider: provider.name })}
							{disabled}
							onclick={() => {
								open = false;
								restoring = true;
							}}
						/>
					{/if}
					<SettingsRow
						label={m.cloud_disconnect()}
						{disabled}
						onclick={() => (disconnecting = true)}
					/>
				{:else}
					{#each providers as target (target.id)}
						<SettingsRow
							label={m.cloud_connect({ provider: target.name })}
							hint={encrypted === false
								? m.cloud_needs_encryption()
								: encrypted === null
									? m.cloud_checking_encryption()
									: undefined}
							disabled={disabled || encrypted === null}
							onclick={() => connect(target)}
						/>
					{/each}
				{/if}
			</SettingsGroup>
		{/if}
	</ResponsiveDialog>

	{#if provider}
		<CloudRestoreDialog bind:open={restoring} {provider} onpick={onRestore} />
	{/if}
{/if}
