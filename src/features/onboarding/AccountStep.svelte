<script lang="ts">
	import { Button } from '$ui/button';
	import AccountFields from '$features/accounts/AccountFields.svelte';
	import AccountTypePicker from '$features/accounts/AccountTypePicker.svelte';
	import { defaultOnBudget } from '$features/accounts/account-form';
	import type { ActionError } from '$client/notify';
	import type { AccountType } from '$db/repos/accounts';
	import type { MoneyFormat } from '$domain/money';
	import { m } from '$i18n/paraglide/messages';
	import StepLayout from './StepLayout.svelte';

	let {
		current,
		total,
		onNext,
		onBack,
		onSkip,
		busy,
		error,
		name = $bindable(),
		type = $bindable(),
		onBudget = $bindable(),
		balance = $bindable(),
		date = $bindable(),
		view = $bindable('type'),
		money
	}: {
		current: number;
		total: number;
		onNext: () => void;
		onBack: () => void;
		/** Creates the budget with no account. */
		onSkip: () => void;
		busy: boolean;
		error: ActionError | null;
		name: string;
		type: AccountType;
		onBudget: boolean;
		balance: string;
		date: string;
		/** Whether the type picker or the account's fields show; kept by the parent across Back. */
		view?: 'type' | 'form';
		/** The new budget's currency, for the balance's preview. */
		money: MoneyFormat;
	} = $props();

	function selectType(selectedType: AccountType) {
		type = selectedType;
		onBudget = defaultOnBudget(selectedType);
		view = 'form';
	}

	function handleNext() {
		if (view === 'type') view = 'form';
		else onNext();
	}
</script>

<StepLayout
	title={m.onboarding_account_section()}
	description={m.onboarding_account_intro()}
	{current}
	{total}
	nextLabel={view === 'type' ? m.onboarding_next() : m.onboarding_create()}
	backLabel={m.onboarding_back()}
	{onBack}
	onNext={handleNext}
	{busy}
	{error}
	cardClass={view === 'type' ? 'max-w-lg md:max-w-2xl' : 'max-w-lg'}
>
	<div class="grid gap-4">
		{#if view === 'type'}
			<AccountTypePicker selected={type} onSelect={selectType} />
		{:else}
			<AccountFields
				bind:name
				bind:type
				bind:onBudget
				bind:balance
				bind:date
				{money}
				onChangeType={() => (view = 'type')}
			/>
		{/if}
	</div>
	<div class="flex justify-end">
		<Button type="button" variant="ghost" size="sm" disabled={busy} onclick={onSkip}>
			{m.onboarding_account_skip()}
		</Button>
	</div>
</StepLayout>
