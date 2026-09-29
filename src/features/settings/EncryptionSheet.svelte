<script lang="ts">
	import FormMessage from '$components/FormMessage.svelte';
	import ResponsiveDialog from '$components/ResponsiveDialog.svelte';
	import { Switch } from '$ui/switch';
	import type { ActionError } from '$client/notify';
	import { m } from '$i18n/paraglide/messages';
	import SettingsGroup from './SettingsGroup.svelte';
	import SettingsRow from './SettingsRow.svelte';

	/**
	 * Backup encryption, opened from the backup card: the switch, and the password once it is on.
	 * Turning it on, changing the password and checking it are dialogs of their own, so the sheet
	 * closes before `onToggle(true)`, `onChange` and `onCheck`; turning it off stays here.
	 */
	let {
		open = $bindable(false),
		encrypted,
		error,
		disabled = false,
		onToggle,
		onChange,
		onCheck
	}: {
		open: boolean;
		/** Whether backups are encrypted; null until known. */
		encrypted: boolean | null;
		/** Why the setting couldn't be loaded. */
		error: ActionError | null;
		disabled?: boolean;
		onToggle: (on: boolean) => void;
		onChange: () => void;
		onCheck: () => void;
	} = $props();

	/** Closes the sheet, then opens what comes next in its place. */
	function handOff(next: () => void) {
		open = false;
		next();
	}
</script>

<ResponsiveDialog bind:open title={m.backup_encryption()}>
	<SettingsGroup>
		<SettingsRow
			label={m.backup_encrypt()}
			labelFor="encrypt-backups"
			hint={encrypted ? m.backup_encrypt_on_hint() : m.backup_encrypt_off_hint()}
			{disabled}
		>
			{#snippet control()}
				<Switch
					id="encrypt-backups"
					disabled={encrypted === null || disabled}
					bind:checked={
						() => encrypted === true, (on) => (on ? handOff(() => onToggle(true)) : onToggle(false))
					}
				/>
			{/snippet}
		</SettingsRow>
		{#if encrypted}
			<SettingsRow
				label={m.backup_change_password()}
				{disabled}
				onclick={() => handOff(onChange)}
			/>
			<SettingsRow label={m.backup_check_password()} {disabled} onclick={() => handOff(onCheck)} />
		{/if}
		{#if error}
			<div class="px-4 py-3"><FormMessage {error} /></div>
		{/if}
	</SettingsGroup>
</ResponsiveDialog>
