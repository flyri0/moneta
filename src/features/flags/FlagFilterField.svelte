<script lang="ts">
	import type { FlagFilter } from '$domain/flag';
	import { FLAG_COLORS } from '$domain/flag';
	import type { FlagRow } from '$db/repos/flags';
	import { m } from '$i18n/paraglide/messages';
	import FlagIcon from './FlagIcon.svelte';
	import { flagLabel, toggleFlag } from './flags';

	/** Which flags a filter keeps: a chip per flag and one for none; none picked keeps them all. */
	let {
		value = $bindable(),
		flags,
		ariaLabel
	}: { value: FlagFilter; flags: readonly FlagRow[] | undefined; ariaLabel?: string } = $props();

	const choices = $derived([
		{ key: 'none' as const, color: null, label: m.flag_none() },
		...FLAG_COLORS.map((color) => ({ key: color, color, label: flagLabel(color, flags) }))
	]);
</script>

<div class="flex flex-wrap gap-1.5" role="group" aria-label={ariaLabel} data-testid="flag-filter">
	{#each choices as choice (choice.key)}
		<button
			type="button"
			aria-pressed={value.includes(choice.key)}
			class="inline-flex h-8 max-w-full items-center gap-1.5 rounded-full border px-3 text-sm transition-colors hover:bg-muted aria-pressed:border-primary aria-pressed:bg-primary/10 aria-pressed:font-medium"
			onclick={() => (value = toggleFlag(value, choice.key))}
		>
			<FlagIcon color={choice.color} class="size-3.5" />
			<span class="truncate">{choice.label}</span>
		</button>
	{/each}
</div>
