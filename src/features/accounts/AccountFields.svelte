<script lang="ts">
	import { Button } from '$ui/button';
	import { DatePicker } from '$ui/date-picker';
	import { Input } from '$ui/input';
	import { Label } from '$ui/label';
	import * as Select from '$ui/select';
	import { Switch } from '$ui/switch';
	import {
		ACCOUNT_CATEGORIES,
		defaultOnBudget,
		isDebtType,
		onBudgetLocked
	} from '$features/accounts/account-form';
	import { accountTypeIcon } from '$features/accounts/account-icons';
	import type { AccountType } from '$db/repos/accounts';
	import { accountTypeDescription, accountTypeLabel } from '$i18n/labels';
	import { m } from '$i18n/paraglide/messages';

	let {
		name = $bindable(),
		type = $bindable(),
		onBudget = $bindable(),
		balance = $bindable(),
		date = $bindable(),
		idPrefix = 'account',
		onChangeType
	}: {
		name: string;
		type: AccountType;
		onBudget: boolean;
		balance: string; // as typed
		date: string;
		idPrefix?: string;
		onChangeType?: () => void;
	} = $props();

	function typeChanged() {
		onBudget = defaultOnBudget(type);
	}

	const Icon = $derived(accountTypeIcon(type));
</script>

{#if onChangeType}
	<div class="flex items-center justify-between rounded-lg border bg-muted/20 p-3">
		<div class="flex items-center gap-3">
			<div
				class="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-foreground"
			>
				<Icon class="size-4" />
			</div>
			<div class="grid gap-0.5">
				<span class="text-sm leading-none font-medium">{accountTypeLabel(type)}</span>
				<span class="text-xs text-muted-foreground">{accountTypeDescription(type)}</span>
			</div>
		</div>
		<Button type="button" variant="ghost" size="sm" onclick={onChangeType}>
			{m.account_change_type()}
		</Button>
	</div>
{:else}
	<div class="grid gap-2">
		<Label for="{idPrefix}-type">{m.account_type()}</Label>
		<Select.Root
			type="single"
			bind:value={type}
			onValueChange={(v) => {
				if (v) {
					type = v as AccountType;
					typeChanged();
				}
			}}
		>
			<Select.Trigger id="{idPrefix}-type" class="w-full">
				{accountTypeLabel(type)}
			</Select.Trigger>
			<Select.Content>
				{#each ACCOUNT_CATEGORIES as category (category.key)}
					<Select.Group>
						<Select.GroupHeading>
							{category.key === 'budget' ? m.accounts_on_budget() : m.accounts_off_budget()}
						</Select.GroupHeading>
						{#each category.types as t (t)}
							<Select.Item value={t} label={accountTypeLabel(t)}>
								{accountTypeLabel(t)}
							</Select.Item>
						{/each}
					</Select.Group>
				{/each}
			</Select.Content>
		</Select.Root>
	</div>
{/if}

<div class="grid gap-2">
	<Label for="{idPrefix}-name">{m.account_name()}</Label>
	<Input id="{idPrefix}-name" bind:value={name} required autocomplete="off" />
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
		<DatePicker id="{idPrefix}-date" bind:value={date} required />
	</div>
</div>
