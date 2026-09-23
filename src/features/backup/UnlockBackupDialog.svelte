<script lang="ts">
	import ResponsiveDialog from '$components/ResponsiveDialog.svelte';
	import type { ClientApi } from '$db/api';
	import { m } from '$i18n/paraglide/messages';
	import BackupUnlockForm from './BackupUnlockForm.svelte';

	/** Asks for the password or recovery key of an encrypted backup picked outside Settings. */
	let {
		open = $bindable(false),
		api,
		bytes,
		onunlock
	}: {
		open: boolean;
		api: Pick<ClientApi, 'system'>;
		bytes: Uint8Array | null;
		onunlock: (plain: Uint8Array) => void | Promise<void>;
	} = $props();
</script>

<ResponsiveDialog bind:open title={m.backup_unlock_title()}>
	{#if bytes}
		<BackupUnlockForm
			{api}
			{bytes}
			onunlock={async (plain) => {
				open = false;
				await onunlock(plain);
			}}
		/>
	{/if}
</ResponsiveDialog>
