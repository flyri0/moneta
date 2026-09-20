<script lang="ts">
	import { setMode, userPrefersMode } from 'mode-watcher';
	import MonitorIcon from '@lucide/svelte/icons/monitor';
	import MoonIcon from '@lucide/svelte/icons/moon';
	import SunIcon from '@lucide/svelte/icons/sun';
	import { m } from '$i18n/paraglide/messages';

	type Mode = 'system' | 'light' | 'dark';
	const MODES: { value: Mode; label: () => string; icon: typeof SunIcon }[] = [
		{ value: 'system', label: m.settings_theme_system, icon: MonitorIcon },
		{ value: 'light', label: m.settings_theme_light, icon: SunIcon },
		{ value: 'dark', label: m.settings_theme_dark, icon: MoonIcon }
	];
</script>

<div class="flex rounded-md border p-0.5" role="group" aria-label={m.settings_theme()}>
	{#each MODES as mode (mode.value)}
		<button
			type="button"
			aria-pressed={userPrefersMode.current === mode.value}
			onclick={() => setMode(mode.value)}
			class="flex items-center gap-1.5 rounded-sm px-2 py-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:bg-primary aria-pressed:text-primary-foreground"
		>
			<mode.icon class="size-3.5" aria-hidden />
			{mode.label()}
		</button>
	{/each}
</div>
