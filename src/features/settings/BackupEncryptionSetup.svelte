<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { Button } from '$ui/button';
	import { Checkbox } from '$ui/checkbox';
	import { Input } from '$ui/input';
	import { Label } from '$ui/label';
	import ResponsiveDialog from '$components/ResponsiveDialog.svelte';
	import FormMessage from '$components/FormMessage.svelte';
	import { fileTarget } from '$features/backup/file-target';
	import { useSession } from '$client/app-state.svelte';
	import { runAction, type ActionError } from '$client/notify';
	import {
		MIN_PASSWORD_LENGTH,
		MIN_PASSWORD_STRENGTH,
		passwordProblem,
		passwordStrength
	} from '$domain/backup-password';
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
	let error = $state<ActionError | null>(null);

	/** How hard the password is to guess (0 to 4), or null until it is rated. */
	let strength = $state<number | null>(null);
	const problem = $derived(passwordProblem(password, confirm, strength));

	// Rated on this device as it is typed; the word lists load the first time.
	$effect(() => {
		const typed = password;
		strength = null;
		if (typed.length < MIN_PASSWORD_LENGTH) return;
		let current = true;
		passwordStrength(typed).then(
			(score) => current && (strength = score),
			() => {}
		);
		return () => (current = false);
	});

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

	async function next(event: SubmitEvent) {
		event.preventDefault();
		tried = true;
		if (strength === null && password.length >= MIN_PASSWORD_LENGTH) {
			const typed = password;
			const score = await passwordStrength(typed).catch(() => null);
			if (password === typed) strength = score;
		}
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
				{#if strength !== null}
					<div class="flex items-center gap-2" data-testid="password-strength">
						<div class="grid flex-1 grid-cols-4 gap-1" aria-hidden="true">
							{#each [1, 2, 3, 4] as bar (bar)}
								<span
									class="h-1 rounded-full {strength >= bar
										? strength >= MIN_PASSWORD_STRENGTH
											? 'bg-emerald-600 dark:bg-emerald-400'
											: 'bg-destructive'
										: 'bg-muted'}"
								></span>
							{/each}
						</div>
						<span class="text-xs text-muted-foreground">
							{strength >= 4
								? m.backup_strength_strong()
								: strength >= MIN_PASSWORD_STRENGTH
									? m.backup_strength_good()
									: m.backup_strength_weak()}
						</span>
					</div>
				{/if}
				<p class="text-xs text-muted-foreground">{m.backup_password_hint()}</p>
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
				<FormMessage
					error={{
						message:
							problem === 'short'
								? m.backup_password_short({ min: MIN_PASSWORD_LENGTH })
								: problem === 'weak'
									? m.backup_password_weak()
									: m.backup_password_mismatch()
					}}
				/>
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
			<FormMessage {error} />
			<div class="grid grid-cols-2 gap-2">
				<Button variant="outline" disabled={busy} onclick={() => (step = 'password')}>
					{m.onboarding_back()}
				</Button>
				<Button disabled={!saved || busy} onclick={finish}>
					{changing ? m.save() : m.backup_encrypt_turn_on()}
				</Button>
			</div>
		</div>
	{/if}
</ResponsiveDialog>
