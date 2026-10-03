<script lang="ts">
	import { Input } from '$ui/input';
	import HelpLink from '$components/HelpLink.svelte';
	import { Label } from '$ui/label';
	import { m } from '$i18n/paraglide/messages';

	/** A credit card's closing and due days, as typed; `parseBillingDays` reads them. */
	let {
		closing = $bindable(),
		due = $bindable(),
		idPrefix
	}: { closing: string; due: string; idPrefix: string } = $props();
</script>

<div class="grid gap-2">
	<div class="grid grid-cols-2 gap-3">
		<div class="grid gap-2">
			<Label for="{idPrefix}-closing-day">{m.account_closing_day()}</Label>
			<Input
				id="{idPrefix}-closing-day"
				bind:value={closing}
				inputmode="numeric"
				autocomplete="off"
				maxlength={2}
			/>
		</div>
		<div class="grid gap-2">
			<Label for="{idPrefix}-due-day">{m.account_due_day()}</Label>
			<Input
				id="{idPrefix}-due-day"
				bind:value={due}
				inputmode="numeric"
				autocomplete="off"
				maxlength={2}
			/>
		</div>
	</div>
	<p class="text-xs text-muted-foreground">{m.account_billing_hint()}</p>
	<HelpLink topic="cardBilling" text />
</div>
