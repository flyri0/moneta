<script lang="ts">
	import SettingsGroup from './SettingsGroup.svelte';
	import SettingsRow from './SettingsRow.svelte';
	import { guidePath } from '$client/guide';
	import { appUpdate } from '$client/update.svelte';
	import { m } from '$i18n/paraglide/messages';
	import { getLocale } from '$i18n/paraglide/runtime';
	import { Button } from '$ui/button';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { currentMonth } from '$domain/month';
	import { tour } from '$features/tour/tour.svelte';

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
	/** Shows the tour again, on the budget screen it walks through. */
	function takeTour() {
		tour.replay = true;
		void goto(resolve('/budget/[month]', { month: currentMonth() }));
	}

	const busy = $derived(appUpdate.status === 'checking' || appUpdate.status === 'downloading');
</script>

<SettingsGroup title={m.settings_about()} tour="about">
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
	<SettingsRow label={m.about_guide()} hint={m.about_guide_hint()} href={guidePath(getLocale())} />
	<SettingsRow label={m.about_tour()} hint={m.about_tour_hint()} onclick={takeTour} />
	<SettingsRow label={m.about_source()} href={REPOSITORY_URL} />
</SettingsGroup>
