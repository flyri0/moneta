<script lang="ts">
	import { getApp } from '$client/app-state.svelte';
	import { amounts } from '$client/hide-amounts.svelte';
	import { amountPreview, formatMoney, type MoneyFormat } from '$domain/money';
	import { m } from '$i18n/paraglide/messages';
	import { cn } from '$utils';

	/**
	 * What a typed amount will be saved as, under its field, while the text isn't written that way
	 * yet ("120+35", "1234"). Blank while amounts are hidden or the text can't be read. It reads in
	 * the open budget's currency, or in `money` where none is open yet (onboarding).
	 */
	let {
		text,
		money,
		class: className
	}: { text: string; money?: MoneyFormat; class?: string } = $props();
	const app = getApp();
	const fmt = $derived(money ?? app.session?.money);
	const value = $derived(!fmt || amounts.hidden ? null : amountPreview(text, fmt));
</script>

<!-- The line keeps its height while empty: the text is information, it must not move the form. -->
<p class={cn('min-h-4 text-xs text-muted-foreground tabular-nums', className)} aria-live="polite">
	{#if value !== null && fmt}{m.amount_preview({ amount: formatMoney(value, fmt) })}{/if}
</p>
