<script lang="ts">
	import { onMount } from 'svelte';
	import SettingsGroup from './SettingsGroup.svelte';
	import SettingsRow from './SettingsRow.svelte';
	import WipeDeviceDialog from './WipeDeviceDialog.svelte';
	import InstallHelpDialog from '$features/welcome/InstallHelpDialog.svelte';
	import { installHow, isStandalone } from '$client/install';
	import { install } from '$client/install.svelte';
	import {
		permissionStatus,
		persistQuietly,
		readPersistence,
		type Persistence
	} from '$client/persistence';
	import { formatBytes } from '$i18n/formats';
	import { m } from '$i18n/paraglide/messages';
	import { getLocale } from '$i18n/paraglide/runtime';

	const HINTS: Record<Persistence, () => string> = {
		persisted: m.storage_persisted_hint,
		ask: m.storage_ask_hint,
		blocked: m.storage_blocked_hint,
		automatic: m.storage_automatic_hint,
		unsupported: m.storage_unsupported_hint
	};

	let persistence = $state<Persistence | null>(null);
	let estimate = $state<StorageEstimate | null>(null);
	let permission: PermissionStatus | null = null;
	let helping = $state(false);
	let wiping = $state(false);
	const how = $derived(installHow(navigator.userAgent, install.available));

	async function refresh() {
		[persistence, estimate] = await Promise.all([
			readPersistence(navigator.storage, permission, navigator.userAgent),
			navigator.storage?.estimate?.().catch(() => null) ?? null
		]);
	}

	/** Firefox shows its prompt; once declined, it answers false until the block is removed. */
	async function ask() {
		try {
			await navigator.storage?.persist?.();
		} catch {
			// The state below says what happened.
		}
		await refresh();
	}

	async function installApp() {
		if ((await install.prompt()) !== 'unavailable') return;
		helping = true;
	}

	const action = $derived.by(() => {
		if (persistence === 'ask') return { label: m.storage_protect(), run: ask };
		if (persistence === 'blocked') return { label: m.storage_try_again(), run: ask };
		// Chromium and Safari protect installed apps by themselves.
		if (persistence === 'automatic' && !isStandalone())
			return { label: m.storage_install(), run: installApp };
		return null;
	});

	// Chromium grants persistence to an app once it is installed, but only when asked.
	$effect(() => {
		if (install.installed)
			void persistQuietly(navigator.storage, navigator.userAgent).then(refresh);
	});

	// Check again whenever it may have changed: back from the browser's settings, or a new decision.
	onMount(() => {
		let active = true;
		const onChange = () => void refresh();
		const onVisible = () => {
			if (document.visibilityState === 'visible') onChange();
		};
		document.addEventListener('visibilitychange', onVisible);
		void (async () => {
			permission = await permissionStatus(navigator.permissions);
			if (!active) return;
			permission?.addEventListener('change', onChange);
			await refresh();
		})();
		return () => {
			active = false;
			document.removeEventListener('visibilitychange', onVisible);
			permission?.removeEventListener('change', onChange);
		};
	});
</script>

<SettingsGroup
	title={m.settings_storage()}
	description={persistence && persistence !== 'persisted' ? m.storage_backup_hint() : undefined}
>
	{#if persistence}
		<div data-testid="storage-protection">
			<SettingsRow
				label={m.storage_protection()}
				hint={HINTS[persistence]()}
				value={persistence === 'persisted' ? m.storage_on() : m.storage_off()}
			/>
		</div>
		{#if action}
			<SettingsRow label={action.label} onclick={action.run} />
		{/if}
	{/if}
	{#if estimate?.usage !== undefined && estimate.quota !== undefined}
		<SettingsRow
			label={m.storage_used_label()}
			value={m.storage_used_value({
				used: formatBytes(estimate.usage, getLocale()),
				quota: formatBytes(estimate.quota, getLocale())
			})}
		/>
	{/if}
	<SettingsRow label={m.wipe_row()} onclick={() => (wiping = true)} />
</SettingsGroup>

<InstallHelpDialog bind:open={helping} {how} />
<WipeDeviceDialog bind:open={wiping} />
