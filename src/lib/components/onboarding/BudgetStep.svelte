<script lang="ts">
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { NativeSelect, NativeSelectOption } from '$lib/components/ui/native-select';
	import { currencyChoices, localeChoices, suggestCurrency } from '$lib/i18n/formats';
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';
	import StepLayout from './StepLayout.svelte';

	let {
		title,
		current,
		total,
		onNext,
		onBack,
		backLabel,
		name = $bindable(),
		locale = $bindable(),
		currency = $bindable()
	}: {
		title: string;
		current: number;
		total: number;
		onNext: () => void;
		onBack?: () => void;
		backLabel?: string;
		name: string;
		locale: string;
		currency: string;
	} = $props();

	const uiLocale = getLocale();
	const locales = localeChoices(uiLocale, navigator.language);
	const currencies = currencyChoices(uiLocale);
</script>

<StepLayout {title} {current} {total} nextLabel={m.onboarding_next()} {backLabel} {onBack} {onNext}>
	<div class="grid gap-4">
		<div class="grid gap-2">
			<Label for="budget-name">{m.onboarding_budget_name()}</Label>
			<Input id="budget-name" bind:value={name} required autocomplete="off" />
		</div>
		<div class="grid gap-2">
			<Label for="budget-locale">{m.onboarding_locale()}</Label>
			<NativeSelect
				id="budget-locale"
				class="w-full"
				bind:value={locale}
				onchange={() => (currency = suggestCurrency(locale))}
			>
				{#each locales as choice (choice.value)}
					<NativeSelectOption value={choice.value}>{choice.label}</NativeSelectOption>
				{/each}
			</NativeSelect>
		</div>
		<div class="grid gap-2">
			<Label for="budget-currency">{m.onboarding_currency()}</Label>
			<NativeSelect id="budget-currency" class="w-full" bind:value={currency}>
				{#each currencies as choice (choice.value)}
					<NativeSelectOption value={choice.value}>{choice.label}</NativeSelectOption>
				{/each}
			</NativeSelect>
		</div>
	</div>
</StepLayout>
