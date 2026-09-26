<script lang="ts">
	import SettingsGroup from './SettingsGroup.svelte';
	import SettingsRow from './SettingsRow.svelte';
	import { appUpdate } from '$client/update.svelte';
	import { m } from '$i18n/paraglide/messages';
	import { Button } from '$ui/button';

	const REPOSITORY_URL = 'https://github.com/flyri0/moneta';

	const hint = $derived(
		{
			idle: undefined,
			checking: m.update_checking(),
			downloading: m.update_downloading(),
			ready: m.update_available(),
			current: m.update_current(),
			failed: m.update_check_failed()
		}[appUpdate.status]
	);
	const busy = $derived(appUpdate.status === 'checking' || appUpdate.status === 'downloading');
</script>

<SettingsGroup title={m.settings_about()}>
	<SettingsRow label={m.about_updates()} {hint}>
		{#snippet control()}
			{#if appUpdate.status === 'ready'}
				<Button size="sm" onclick={() => void appUpdate.install()}>{m.startup_reload()}</Button>
			{:else}
				<Button variant="outline" size="sm" disabled={busy} onclick={() => void appUpdate.check()}>
					{m.update_check()}
				</Button>
			{/if}
		{/snippet}
	</SettingsRow>
	<SettingsRow label={m.about_source()} href={REPOSITORY_URL} />
</SettingsGroup>
