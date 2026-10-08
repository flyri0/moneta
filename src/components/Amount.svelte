<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { useSession } from '$client/app-state.svelte';
	import { AMOUNT_TEXT, amountTone } from '$components/amount';
	import { cn } from '$utils';

	/**
	 * An amount, shown the same way everywhere. A `flow` (a transaction, activity, a net change) is
	 * signed both ways and green when money comes in; a balance or a total is plain.
	 */
	let {
		amount,
		flow = false,
		class: className,
		...rest
	}: { amount: number; flow?: boolean } & HTMLAttributes<HTMLSpanElement> = $props();
	const session = useSession();
</script>

<span class={cn('tabular-nums', className, flow && AMOUNT_TEXT[amountTone(amount)])} {...rest}
	>{flow ? session.formatSigned(amount) : session.format(amount)}</span
>
