<script lang="ts">
	import AccountFields from '$lib/components/accounts/AccountFields.svelte';
	import type { AccountType } from '$lib/db/repos/accounts';
	import { m } from '$lib/paraglide/messages';
	import StepLayout from './StepLayout.svelte';

	let {
		current,
		total,
		onNext,
		onBack,
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
		busy: boolean;
		error: string | null;
		name: string;
		type: AccountType;
		onBudget: boolean;
		balance: string;
		date: string;
	} = $props();
</script>

<StepLayout
	title={m.onboarding_account_section()}
	{current}
	{total}
	nextLabel={m.onboarding_create()}
	backLabel={m.onboarding_back()}
	{onBack}
	{onNext}
	{busy}
	{error}
>
	<div class="grid gap-4">
		<AccountFields bind:name bind:type bind:onBudget bind:balance bind:date />
	</div>
</StepLayout>
