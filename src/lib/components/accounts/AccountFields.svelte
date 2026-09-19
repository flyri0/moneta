<script lang="ts">
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { NativeSelect, NativeSelectOption } from '$lib/components/ui/native-select';
	import { Switch } from '$lib/components/ui/switch';
	import {
		ACCOUNT_TYPES,
		defaultOnBudget,
		isDebtType,
		onBudgetLocked
	} from '$lib/accounts/account-form';
	import type { AccountType } from '$lib/db/repos/accounts';
	import { accountTypeLabel } from '$lib/i18n/labels';
	import { m } from '$lib/paraglide/messages';

	let {
		name = $bindable(),
		type = $bindable(),
		onBudget = $bindable(),
		balance = $bindable(),
		date = $bindable(),
		idPrefix = 'account'
	}: {
		name: string;
		type: AccountType;
		onBudget: boolean;
		balance: string; // as typed
		date: string;
		idPrefix?: string;
	} = $props();

	function typeChanged() {
		onBudget = defaultOnBudget(type);
	}
</script>

<div class="grid gap-2">
	<Label for="{idPrefix}-name">{m.account_name()}</Label>
	<Input id="{idPrefix}-name" bind:value={name} required autocomplete="off" />
</div>
<div class="grid gap-2">
	<Label for="{idPrefix}-type">{m.account_type()}</Label>
	<NativeSelect id="{idPrefix}-type" class="w-full" bind:value={type} onchange={typeChanged}>
		{#each ACCOUNT_TYPES as t (t)}
			<NativeSelectOption value={t}>{accountTypeLabel(t)}</NativeSelectOption>
		{/each}
	</NativeSelect>
</div>
<div class="flex items-center justify-between gap-4">
	<div class="grid gap-1">
		<Label for="{idPrefix}-on-budget">{m.account_on_budget()}</Label>
		<p class="text-xs text-muted-foreground">
			{onBudget ? m.account_on_budget_hint() : m.account_off_budget_hint()}
		</p>
	</div>
	<Switch id="{idPrefix}-on-budget" bind:checked={onBudget} disabled={onBudgetLocked(type)} />
</div>
<div class="grid grid-cols-2 gap-3">
	<div class="grid gap-2">
		<Label for="{idPrefix}-balance">
			{isDebtType(type) ? m.account_amount_owed() : m.account_starting_balance()}
		</Label>
		<Input
			id="{idPrefix}-balance"
			bind:value={balance}
			inputmode="decimal"
			autocomplete="off"
			placeholder="0"
		/>
	</div>
	<div class="grid gap-2">
		<Label for="{idPrefix}-date">{m.account_balance_date()}</Label>
		<Input id="{idPrefix}-date" type="date" bind:value={date} required />
	</div>
</div>
