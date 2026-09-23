<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { Button } from '$ui/button';
	import { Checkbox } from '$ui/checkbox';
	import { Input } from '$ui/input';
	import { Label } from '$ui/label';
	import ResponsiveDialog from '$components/ResponsiveDialog.svelte';
	import { fileTarget } from '$features/backup/file-target';
	import { useSession } from '$client/app-state.svelte';
	import { runAction } from '$client/notify';
	import { MIN_PASSWORD_LENGTH, passwordProblem } from '$domain/backup-password';
	import { todayIso } from '$domain/month';
	import { newRecoveryKey } from '$domain/recovery-key';
	import { m } from '$i18n/paraglide/messages';

	/**
	 * Turns on backup encryption, or changes its password: a password typed twice, then a new
	 * recovery key to save. Nothing changes until the last step is confirmed.
	 */
	let {
		open = $bindable(false),
		changing = false,
		ondone
	}: { open: boolean; changing?: boolean; ondone: () => void } = $props();
	const session = useSession();

	let step = $state<'password' | 'recovery'>('password');
	let password = $state('');
	let confirm = $state('');
	let tried = $state(false);
	let recoveryKey = $state('');
	let saved = $state(false);
	let busy = $state(false);
	let error = $state<string | null>(null);

	const problem = $derived(passwordProblem(password, confirm));

	$effect(() => {
		if (!open) return;
		step = 'password';
		password = '';
		confirm = '';
		tried = false;
		recoveryKey = '';
		saved = false;
		busy = false;
		error = null;
	});

	function next(event: SubmitEvent) {
		event.preventDefault();
		tried = true;
		if (problem) return;
		// A new key every time, so going back can't leave one on screen that was never saved.
		recoveryKey = newRecoveryKey();
		saved = false;
		step = 'recovery';
	}

	async function copy() {
		try {
			// Missing outside a secure context; writeText also rejects when permission is denied.
			if (!navigator.clipboard) throw new Error('No clipboard');
			await navigator.clipboard.writeText(recoveryKey);
			toast.success(m.backup_recovery_copied());
		} catch {
			toast.error(m.copy_details_failed());
		}
	}

	function download() {
		const text = m.backup_recovery_file({ key: recoveryKey, date: todayIso() });
		void fileTarget.save(
			`moneta-recovery-key-${todayIso()}.txt`,
			new Blob([text], { type: 'text/plain;charset=utf-8' })
		);
	}

	async function finish() {
		if (!saved || busy) return;
		busy = true;
		error = await runAction(() => session.api.system.setBackupEncryption(password, recoveryKey));
		busy = false;
		if (error) return;
		open = false;
		ondone();
	}
</script>

<ResponsiveDialog
	bind:open
	title={step === 'recovery'
		? m.backup_recovery_title()
		: changing
			? m.backup_change_password()
			: m.backup_encrypt()}
>
	{#if step === 'password'}
		<form class="grid gap-4" onsubmit={next}>
			<p class="text-sm text-muted-foreground">{m.backup_encrypt_intro()}</p>
			{#if changing}<p class="text-sm text-muted-foreground">{m.backup_change_intro()}</p>{/if}
			<div class="grid gap-1.5">
				<Label for="backup-password">{m.backup_password()}</Label>
				<Input
					id="backup-password"
					type="password"
					bind:value={password}
					autocomplete="new-password"
				/>
			</div>
			<div class="grid gap-1.5">
				<Label for="backup-password-confirm">{m.backup_password_confirm()}</Label>
				<Input
					id="backup-password-confirm"
					type="password"
					bind:value={confirm}
					autocomplete="new-password"
				/>
			</div>
			{#if tried && problem}
				<p class="text-sm text-destructive" role="alert">
					{problem === 'short'
						? m.backup_password_short({ min: MIN_PASSWORD_LENGTH })
						: m.backup_password_mismatch()}
				</p>
			{/if}
			<Button type="submit">{m.onboarding_next()}</Button>
		</form>
	{:else}
		<div class="grid gap-4">
			<p class="text-sm text-muted-foreground">{m.backup_recovery_hint()}</p>
			<p
				class="rounded-lg border bg-muted px-3 py-3 text-center font-mono text-base break-all select-all"
				data-testid="recovery-key"
			>
				{recoveryKey}
			</p>
			<div class="grid grid-cols-2 gap-2">
				<Button variant="outline" onclick={copy}>{m.backup_recovery_copy()}</Button>
				<Button variant="outline" onclick={download}>{m.backup_recovery_download()}</Button>
			</div>
			<div class="flex items-center gap-2">
				<Checkbox id="recovery-saved" bind:checked={saved} disabled={busy} />
				<Label for="recovery-saved" class="font-normal">{m.backup_recovery_saved()}</Label>
			</div>
			<div class="grid grid-cols-2 gap-2">
				<Button variant="outline" disabled={busy} onclick={() => (step = 'password')}>
					{m.onboarding_back()}
				</Button>
				<Button disabled={!saved || busy} onclick={finish}>
					{changing ? m.save() : m.backup_encrypt_turn_on()}
				</Button>
			</div>
			{#if error}<p class="text-sm text-destructive" role="alert">{error}</p>{/if}
		</div>
	{/if}
</ResponsiveDialog>
