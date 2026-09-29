<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Button } from '$ui/button';
	import FormMessage from '$components/FormMessage.svelte';
	import type { ActionError } from '$client/notify';
	import { m } from '$i18n/paraglide/messages';

	/**
	 * The one confirmation layout: what will happen, any extra choice (`children`), the error, then
	 * Cancel and the action. A dialog shows it as one of its screens, or through `ConfirmDialog`.
	 */
	let {
		body,
		confirmLabel,
		error = null,
		busy = false,
		disabled = false,
		destructive = true,
		onCancel,
		onConfirm,
		children
	}: {
		body?: string;
		confirmLabel: string;
		error?: ActionError | null;
		busy?: boolean;
		disabled?: boolean;
		destructive?: boolean;
		onCancel: () => void;
		onConfirm: () => void;
		children?: Snippet;
	} = $props();
</script>

<div class="grid gap-4">
	{#if body}<p class="text-sm text-muted-foreground">{body}</p>{/if}
	{@render children?.()}
	<FormMessage {error} />
	<!-- Long confirm labels ("Lançar ajuste e conciliar") wrap rather than spill out of their half. -->
	<div class="grid grid-cols-2 gap-2">
		<Button variant="outline" disabled={busy} onclick={onCancel}>{m.cancel()}</Button>
		<Button
			class="h-auto min-h-9 py-1.5 whitespace-normal"
			variant={destructive ? 'destructive' : 'default'}
			disabled={busy || disabled}
			onclick={onConfirm}
		>
			{confirmLabel}
		</Button>
	</div>
</div>
