<script lang="ts">
	import { m } from '$i18n/paraglide/messages';
	import { transferBudgetEffect, type FormContext, type TransactionDraft } from './form';

	let { draft, ctx }: { draft: TransactionDraft; ctx: FormContext } = $props();
	const effect = $derived(transferBudgetEffect(draft, ctx));
</script>

{#if effect}
	<p class="text-sm text-muted-foreground" data-testid="transfer-budget-hint">
		{#if effect === 'internal'}
			{m.transfer_budget_internal()}
		{:else if effect === 'outside'}
			{m.transfer_budget_outside()}
		{:else if effect === 'entering'}
			{m.transfer_budget_entering()}
		{:else}
			{m.transfer_budget_leaving()}
		{/if}
	</p>
{/if}
