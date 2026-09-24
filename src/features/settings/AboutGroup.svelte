<script lang="ts">
	import SettingsGroup from './SettingsGroup.svelte';
	import SettingsRow from './SettingsRow.svelte';
	import { m } from '$i18n/paraglide/messages';

	const REPOSITORY_URL = 'https://github.com/flyri0/moneta';
</script>

<SettingsGroup title={m.settings_about()}>
	<SettingsRow label={m.about_source()} href={REPOSITORY_URL} />
</SettingsGroup>
