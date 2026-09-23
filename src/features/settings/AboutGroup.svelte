<script lang="ts">
	import SettingsGroup from './SettingsGroup.svelte';
	import SettingsRow from './SettingsRow.svelte';
	import { APP_VERSION, REPOSITORY_URL, releaseUrl } from '$client/version';
	import { m } from '$i18n/paraglide/messages';

	// A dev server runs unreleased code: there are no release notes to link to.
	const dev = import.meta.env.DEV;
</script>

<SettingsGroup title={m.settings_about()}>
	<div data-testid="app-version">
		<SettingsRow
			label={m.about_version()}
			value={dev ? m.about_version_dev({ version: APP_VERSION }) : APP_VERSION}
		/>
	</div>
	{#if !dev}
		<SettingsRow label={m.about_release_notes()} href={releaseUrl(APP_VERSION)} />
	{/if}
	<SettingsRow label={m.about_source()} href={REPOSITORY_URL} />
</SettingsGroup>
