<script lang="ts">
	import { setMode, userPrefersMode } from 'mode-watcher';
	import * as Card from '$lib/components/ui/card';
	import { Label } from '$lib/components/ui/label';
	import { NativeSelect, NativeSelectOption } from '$lib/components/ui/native-select';
	import BudgetDetails from '$lib/components/settings/BudgetDetails.svelte';
	import BudgetFiles from '$lib/components/settings/BudgetFiles.svelte';
	import { m } from '$lib/paraglide/messages';
	import { getLocale, locales, setLocale, type Locale } from '$lib/paraglide/runtime';

	const LANGUAGE_NAMES: Record<Locale, string> = { en: 'English', 'pt-BR': 'Português (Brasil)' };
	type Theme = 'system' | 'light' | 'dark';
	const THEMES: { value: Theme; label: () => string }[] = [
		{ value: 'system', label: m.settings_theme_system },
		{ value: 'light', label: m.settings_theme_light },
		{ value: 'dark', label: m.settings_theme_dark }
	];
</script>

<div class="mx-auto grid max-w-2xl gap-4 p-3 md:p-6">
	<h1 class="text-xl font-semibold">{m.nav_settings()}</h1>
	<BudgetDetails />
	<BudgetFiles />
	<Card.Root>
		<Card.Header>
			<Card.Title>{m.settings_app()}</Card.Title>
		</Card.Header>
		<Card.Content class="grid gap-4">
			<div class="grid gap-2">
				<Label for="settings-language">{m.settings_language()}</Label>
				<NativeSelect
					id="settings-language"
					class="w-full"
					value={getLocale()}
					onchange={(e) => setLocale(e.currentTarget.value as Locale)}
				>
					{#each locales as locale (locale)}
						<NativeSelectOption value={locale}>{LANGUAGE_NAMES[locale]}</NativeSelectOption>
					{/each}
				</NativeSelect>
			</div>
			<div class="grid gap-2">
				<Label for="settings-theme">{m.settings_theme()}</Label>
				<NativeSelect
					id="settings-theme"
					class="w-full"
					value={userPrefersMode.current}
					onchange={(e) => setMode(e.currentTarget.value as Theme)}
				>
					{#each THEMES as theme (theme.value)}
						<NativeSelectOption value={theme.value}>{theme.label()}</NativeSelectOption>
					{/each}
				</NativeSelect>
			</div>
		</Card.Content>
	</Card.Root>
</div>
<svelte:head><title>{m.nav_settings()} · {m.app_name()}</title></svelte:head>
