<script lang="ts">
	import { MediaQuery } from 'svelte/reactivity';
	import { theme } from 'mode-watcher';
	import ResponsiveDialog from '$lib/components/ResponsiveDialog.svelte';
	import { NativeSelect, NativeSelectOption } from '$lib/components/ui/native-select';
	import AccentPicker from './AccentPicker.svelte';
	import SettingsGroup from './SettingsGroup.svelte';
	import SettingsRow from './SettingsRow.svelte';
	import ThemeToggle from './ThemeToggle.svelte';
	import { ACCENT_SWATCH, accentLabel, readAccent } from '$lib/client/accent';
	import { m } from '$lib/paraglide/messages';
	import { getLocale, locales, setLocale, type Locale } from '$lib/paraglide/runtime';

	let { title = m.settings_customization() }: { title?: string } = $props();

	const LANGUAGE_NAMES: Record<Locale, string> = { en: 'English', 'pt-BR': 'Português (Brasil)' };

	const desktop = new MediaQuery('min-width: 768px');
	const accent = $derived(readAccent(theme.current));
	let picking = $state(false);
</script>

<SettingsGroup {title}>
	{#if desktop.current}
		<SettingsRow stacked label={m.settings_accent()}>
			{#snippet control()}
				<AccentPicker />
			{/snippet}
		</SettingsRow>
	{:else}
		<SettingsRow
			label={m.settings_accent()}
			value={accentLabel(accent)}
			onclick={() => (picking = true)}
		>
			{#snippet control()}
				<span class="size-4 rounded-full {ACCENT_SWATCH[accent]}" aria-hidden="true"></span>
			{/snippet}
		</SettingsRow>
	{/if}

	<SettingsRow label={m.settings_theme()}>
		{#snippet control()}
			<ThemeToggle />
		{/snippet}
	</SettingsRow>

	<SettingsRow label={m.settings_language()} labelFor="settings-language">
		{#snippet control()}
			<NativeSelect
				id="settings-language"
				size="sm"
				value={getLocale()}
				onchange={(e) => setLocale(e.currentTarget.value as Locale)}
			>
				{#each locales as locale (locale)}
					<NativeSelectOption value={locale}>{LANGUAGE_NAMES[locale]}</NativeSelectOption>
				{/each}
			</NativeSelect>
		{/snippet}
	</SettingsRow>
</SettingsGroup>

<ResponsiveDialog bind:open={picking} title={m.settings_accent()}>
	<div class="py-2"><AccentPicker /></div>
</ResponsiveDialog>
