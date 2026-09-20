<script lang="ts">
	import { setTheme, theme } from 'mode-watcher';
	import CheckIcon from '@lucide/svelte/icons/check';
	import { ACCENTS, ACCENT_SWATCH, accentLabel, readAccent } from '$lib/client/accent';
	import { m } from '$lib/paraglide/messages';

	const current = $derived(readAccent(theme.current));
</script>

<div class="flex flex-wrap gap-3" role="group" aria-label={m.settings_accent()}>
	{#each ACCENTS as accent (accent)}
		{@const selected = accent === current}
		<button
			type="button"
			aria-label={accentLabel(accent)}
			aria-pressed={selected}
			onclick={() => setTheme(accent)}
			class="flex size-8 items-center justify-center rounded-full ring-offset-2 ring-offset-background transition-shadow outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:ring-2 aria-pressed:ring-foreground {ACCENT_SWATCH[
				accent
			]}"
		>
			{#if selected}<CheckIcon class="size-4" />{/if}
		</button>
	{/each}
</div>
