<script lang="ts">
	import { Button } from '$ui/button';
	import AccountFields from '$features/accounts/AccountFields.svelte';
	import AccountTypePicker from '$features/accounts/AccountTypePicker.svelte';
	import { defaultOnBudget } from '$features/accounts/account-form';
	import type { AccountType } from '$db/repos/accounts';
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
		date = $bindable()
	}: {
		current: number;
		total: number;
		onNext: () => void;
		onBack: () => void;
		/** Creates the budget with no account. */
		onSkip: () => void;
		busy: boolean;
		error: string | null;
		name: string;
		type: AccountType;
		onBudget: boolean;
		balance: string;
		date: string;
	} = $props();

	let step = $state<1 | 2>(1);

	function selectType(selectedType: AccountType) {
		type = selectedType;
		onBudget = defaultOnBudget(selectedType);
		step = 2;
	}

	function handleBack() {
		if (step === 2) {
			step = 1;
		} else {
			onBack();
		}
	}

	function handleNext() {
		if (step === 1) {
			step = 2;
		} else {
			onNext();
		}
	}
</script>

<StepLayout
	title={m.onboarding_account_section()}
	description={m.onboarding_account_intro()}
	{current}
	{total}
	nextLabel={step === 1 ? m.onboarding_next() : m.onboarding_create()}
	backLabel={m.onboarding_back()}
	onBack={handleBack}
	onNext={handleNext}
	{busy}
	{error}
	cardClass={step === 1 ? 'max-w-lg md:max-w-2xl' : 'max-w-lg'}
>
	<div class="grid gap-4">
		{#if step === 1}
			<AccountTypePicker selected={type} onSelect={selectType} />
		{:else}
			<AccountFields
				bind:name
				bind:type
				bind:onBudget
				bind:balance
				bind:date
				onChangeType={() => (step = 1)}
			/>
		{/if}
	</div>
	<div class="flex justify-end">
		<Button type="button" variant="ghost" size="sm" disabled={busy} onclick={onSkip}>
			{m.onboarding_account_skip()}
		</Button>
	</div>
</StepLayout>
