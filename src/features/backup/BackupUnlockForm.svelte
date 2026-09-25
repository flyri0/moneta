<script lang="ts">
	import { Button } from '$ui/button';
	import { Input } from '$ui/input';
	import { Label } from '$ui/label';
	import FormMessage from '$components/FormMessage.svelte';
	import { runAction, type ActionError } from '$client/notify';
	import type { ClientApi } from '$db/api';
	import { m } from '$i18n/paraglide/messages';

	/**
	 * Unlocks an encrypted backup with its password, or with its recovery key instead. `onunlock`
	 * gets the plain backup, ready for `inspectBackup` and `restoreBackup`.
	 */
	let {
		api,
		bytes,
		onunlock
	}: {
		api: Pick<ClientApi, 'system'>;
		bytes: Uint8Array;
		onunlock: (plain: Uint8Array) => void | Promise<void>;
	} = $props();

	let useRecovery = $state(false);
	let secret = $state('');
	let busy = $state(false);
	let error = $state<ActionError | null>(null);

	function switchSecret() {
		useRecovery = !useRecovery;
		secret = '';
		error = null;
	}

	async function unlock(event: SubmitEvent) {
		event.preventDefault();
		if (busy || !secret) return;
		busy = true;
		error = await runAction(async () => {
			const plain = await api.system.unlockBackup(
				bytes,
				useRecovery ? { recoveryKey: secret } : { password: secret }
			);
			await onunlock(plain);
		});
		busy = false;
	}
</script>

<form class="grid gap-3" onsubmit={unlock}>
	<p class="text-sm text-muted-foreground">{m.backup_unlock_hint()}</p>
	<div class="grid gap-1.5">
		{#if useRecovery}
			<Label for="unlock-recovery">{m.backup_recovery_key()}</Label>
			<Input
				id="unlock-recovery"
				bind:value={secret}
				disabled={busy}
				class="font-mono uppercase"
				placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
				autocomplete="off"
				autocapitalize="characters"
				spellcheck={false}
			/>
		{:else}
			<Label for="unlock-password">{m.backup_password()}</Label>
			<Input
				id="unlock-password"
				type="password"
				bind:value={secret}
				disabled={busy}
				autocomplete="current-password"
			/>
		{/if}
	</div>
	<button
		type="button"
		class="justify-self-start text-sm text-primary underline-offset-4 hover:underline"
		disabled={busy}
		onclick={switchSecret}
	>
		{useRecovery ? m.backup_unlock_use_password() : m.backup_unlock_use_recovery()}
	</button>
	<FormMessage {error} />
	<Button type="submit" disabled={busy || !secret}>
		{busy ? m.backup_unlocking() : m.backup_unlock()}
	</Button>
</form>
