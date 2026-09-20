<script lang="ts">
	import { Input } from '$ui/input';
	import { Label } from '$ui/label';
	import { Combobox } from '$ui/combobox';
	import { currencyChoices, localeChoices, suggestCurrency } from '$i18n/formats';
	import { m } from '$i18n/paraglide/messages';
	import { getLocale } from '$i18n/paraglide/runtime';
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
			<Combobox
				id="budget-locale"
				items={locales}
				bind:value={locale}
				onSelect={() => (currency = suggestCurrency(locale))}
				placeholder={m.onboarding_locale()}
			/>
		</div>
		<div class="grid gap-2">
			<Label for="budget-currency">{m.onboarding_currency()}</Label>
			<Combobox
				id="budget-currency"
				items={currencies}
				bind:value={currency}
				placeholder={m.onboarding_currency()}
			/>
		</div>
	</div>
</StepLayout>
