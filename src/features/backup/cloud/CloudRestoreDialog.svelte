<script lang="ts">
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import { Button } from '$ui/button';
	import FormMessage from '$components/FormMessage.svelte';
	import LoadingRows from '$components/LoadingRows.svelte';
	import ResponsiveDialog from '$components/ResponsiveDialog.svelte';
	import { actionError, runAction, type ActionError } from '$client/notify';
	import { formatDateTime } from '$i18n/formats';
	import { m } from '$i18n/paraglide/messages';
	import { getLocale } from '$i18n/paraglide/runtime';
	import { cloudBackup } from './cloud.svelte';
	import type { CloudProvider, RemoteBackup } from './provider';

	/**
	 * Lists the backups saved in a provider, newest first, and hands the chosen one over as a file
	 * for the usual restore (which asks for its password or recovery key). Without a connection it
	 * signs in first, which also turns automatic backups on for this device.
	 */
	let {
		open = $bindable(false),
		provider,
		onpick
	}: { open: boolean; provider: CloudProvider; onpick: (file: File) => void } = $props();

	let backups = $state.raw<RemoteBackup[] | null>(null);
	let error = $state<ActionError | null>(null);
	let busy = $state(false);
	/** Set while the sign-in popup is open, to cancel it. */
	let signingIn = $state<AbortController | null>(null);

	const connection = $derived(
		cloudBackup.connection?.provider === provider.id ? cloudBackup.connection : null
	);

	$effect(() => {
		if (open) void cloudBackup.load();
	});

	$effect(() => {
		if (!open || !connection) return;
		let current = true;
		backups = null;
		error = null;
		connection.list().then(
			(list) => current && (backups = list),
			(err: unknown) => current && (error = actionError(err))
		);
		return () => (current = false);
	});

	/** Straight from the click: the popup opens before anything is awaited. */
	function signIn() {
		const abort = new AbortController();
		signingIn = abort;
		error = null;
		void runAction(() => cloudBackup.connect(provider, abort.signal)).then((failure) => {
			error = failure;
			signingIn = null;
		});
	}

	async function pick(backup: RemoteBackup) {
		if (!connection) return;
		busy = true;
		const from = connection;
		error = await runAction(async () => {
			const blob = await from.download(backup.id);
			open = false;
			onpick(new File([blob], backup.name));
		});
		busy = false;
	}

	function deviceOf(backup: RemoteBackup): string {
		return backup.device === cloudBackup.settings?.device
			? m.cloud_this_device()
			: backup.deviceLabel;
	}
</script>

<ResponsiveDialog
	bind:open
	title={m.cloud_restore({ provider: provider.name })}
	description={connection
		? m.cloud_restore_hint({ provider: provider.name })
		: m.cloud_restore_connect_hint()}
>
	<div class="grid gap-3">
		{#if !connection}
			{#if signingIn}
				<p class="text-sm text-muted-foreground" role="status">
					{m.cloud_connecting({ provider: provider.name })}
				</p>
				<Button variant="outline" onclick={() => signingIn?.abort()}>{m.cancel()}</Button>
			{:else}
				<Button onclick={signIn}>{m.cloud_connect({ provider: provider.name })}</Button>
			{/if}
		{:else if backups === null && !error}
			<div class="overflow-hidden rounded-xl border">
				<LoadingRows rows={3} />
			</div>
		{:else if backups?.length === 0}
			<p class="text-sm text-muted-foreground">
				{m.cloud_restore_empty({ provider: provider.name })}
			</p>
		{:else if backups}
			<ul
				class="divide-y overflow-hidden rounded-xl border bg-card text-card-foreground"
				aria-busy={busy}
				data-testid="cloud-backups"
			>
				{#each backups as backup (backup.id)}
					{@const date = formatDateTime(backup.modifiedAt, getLocale())}
					<li>
						<button
							type="button"
							disabled={busy}
							aria-label={m.cloud_restore_item({ date, device: deviceOf(backup) })}
							onclick={() => pick(backup)}
							class="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-accent focus-visible:bg-accent disabled:opacity-50"
						>
							<span class="grid min-w-0 flex-1 gap-0.5">
								<span class="text-sm font-medium">{date}</span>
								<span class="truncate text-xs text-muted-foreground">{deviceOf(backup)}</span>
							</span>
							<ChevronRightIcon class="size-4 shrink-0 text-muted-foreground" />
						</button>
					</li>
				{/each}
			</ul>
		{/if}
		<FormMessage {error} />
	</div>
</ResponsiveDialog>
