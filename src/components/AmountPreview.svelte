<script lang="ts">
	import { useSession } from '$client/app-state.svelte';
	import { amounts } from '$client/hide-amounts.svelte';
	import { amountPreview } from '$domain/money';
	import { m } from '$i18n/paraglide/messages';
	import { cn } from '$utils';

	/**
	 * What a typed amount will be saved as, under its field, while the text isn't written that way
	 * yet ("120+35", "1234"). Nothing while amounts are hidden or the text can't be read.
	 */
	let { text, class: className }: { text: string; class?: string } = $props();
	const session = useSession();
	const value = $derived(amounts.hidden ? null : amountPreview(text, session.money));
</script>

{#if value !== null}
	<p class={cn('text-xs text-muted-foreground tabular-nums', className)}>
		{m.amount_preview({ amount: session.format(value) })}
	</p>
{/if}
