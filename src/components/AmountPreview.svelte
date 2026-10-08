<script lang="ts">
	import { useSession } from '$client/app-state.svelte';
	import { amounts } from '$client/hide-amounts.svelte';
	import { amountPreview } from '$domain/money';
	import { m } from '$i18n/paraglide/messages';
	import { cn } from '$utils';

	/**
	 * What a typed amount will be saved as, under its field, while the text isn't written that way
	 * yet ("120+35", "1234"). Blank while amounts are hidden or the text can't be read.
	 */
	let { text, class: className }: { text: string; class?: string } = $props();
	const session = useSession();
	const value = $derived(amounts.hidden ? null : amountPreview(text, session.money));
</script>

<!-- The line keeps its height while empty: the text is information, it must not move the form. -->
<p class={cn('min-h-4 text-xs text-muted-foreground tabular-nums', className)} aria-live="polite">
	{#if value !== null}{m.amount_preview({ amount: session.format(value) })}{/if}
</p>
