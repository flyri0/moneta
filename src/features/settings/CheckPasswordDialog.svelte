<script lang="ts">
	import { Button } from '$ui/button';
	import { Input } from '$ui/input';
	import { Label } from '$ui/label';
	import ResponsiveDialog from '$components/ResponsiveDialog.svelte';
	import { useSession } from '$client/app-state.svelte';
	import { runAction } from '$client/notify';
	import { m } from '$i18n/paraglide/messages';

	/** Checks a typed password against the one backups use on this device. */
	let { open = $bindable(false) }: { open: boolean } = $props();
	const session = useSession();

	let password = $state('');
	let right = $state<boolean | null>(null);
	let busy = $state(false);
	let error = $state<string | null>(null);

	$effect(() => {
		if (!open) return;
		password = '';
		right = null;
		busy = false;
		error = null;
	});

	async function check(event: SubmitEvent) {
		event.preventDefault();
		if (busy || !password) return;
		busy = true;
		error = await runAction(async () => {
			right = await session.api.system.checkBackupPassword(password);
		});
		busy = false;
	}
</script>

<ResponsiveDialog bind:open title={m.backup_check_password()} description={m.backup_check_hint()}>
	<form class="grid gap-3" onsubmit={check}>
		<div class="grid gap-1.5">
			<Label for="check-password">{m.backup_password()}</Label>
			<Input
				id="check-password"
				type="password"
				bind:value={password}
				oninput={() => (right = null)}
				disabled={busy}
				autocomplete="current-password"
			/>
		</div>
		<Button type="submit" disabled={busy || !password}>{m.backup_check()}</Button>
		{#if right !== null}
			<p class={right ? 'text-sm' : 'text-sm text-destructive'} role="status">
				{right ? m.backup_check_right() : m.backup_check_wrong()}
			</p>
		{/if}
		{#if error}<p class="text-sm text-destructive" role="alert">{error}</p>{/if}
	</form>
</ResponsiveDialog>
