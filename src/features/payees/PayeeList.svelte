<script lang="ts">
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import type { Payee } from '$db/repos/payees';
	import { m } from '$i18n/paraglide/messages';

	/** The payees in one card. Tapping one calls `onOpen`. */
	let {
		payees,
		categoryNames,
		onOpen
	}: {
		payees: Payee[];
		categoryNames: Map<string, string>;
		onOpen: (payee: Payee) => void;
	} = $props();

	function usage(payee: Payee): string {
		const count =
			payee.transactions === 0
				? m.payees_unused()
				: payee.transactions === 1
					? m.payees_transactions_one()
					: m.payees_transactions({ count: payee.transactions });
		const category = payee.defaultCategoryId && categoryNames.get(payee.defaultCategoryId);
		return category ? `${count} · ${m.payees_default({ category })}` : count;
	}
</script>

<div class="divide-y overflow-hidden rounded-xl border bg-card text-card-foreground shadow-xs">
	{#each payees as payee (payee.id)}
		<button
			type="button"
			class="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
			data-testid="payee-row"
			onclick={() => onOpen(payee)}
		>
			<div class="grid min-w-0 gap-0.5">
				<span class="truncate text-sm font-medium">{payee.name}</span>
				<span class="truncate text-xs text-muted-foreground">{usage(payee)}</span>
			</div>
			<ChevronRightIcon class="size-4 shrink-0 text-muted-foreground" />
		</button>
	{/each}
</div>
