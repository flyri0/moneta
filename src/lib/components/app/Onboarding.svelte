<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { NativeSelect, NativeSelectOption } from '$lib/components/ui/native-select';
	import AccountFields from '$lib/components/accounts/AccountFields.svelte';
	import { signedStartingBalance } from '$lib/accounts/account-form';
	import { runAction } from '$lib/client/notify';
	import { createBudget, type SessionApi } from '$lib/client/session';
	import type { AccountType } from '$lib/db/repos/accounts';
	import type { BudgetMeta } from '$lib/db/repos/meta';
	import { parseAmount } from '$lib/domain/money';
	import { todayIso } from '$lib/domain/month';
	import { defaultCategoryGroups } from '$lib/i18n/defaults';
	import { currencyChoices, localeChoices, suggestCurrency } from '$lib/i18n/formats';
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';

	/** First-run setup, also used from Settings to add a budget (then `onCancel` goes back). */
	let {
		api,
		onCreated,
		onCancel
	}: {
		api: SessionApi;
		onCreated: (file: string, meta: BudgetMeta) => void;
		onCancel?: () => void;
	} = $props();

	const uiLocale = getLocale();
	const locales = localeChoices(uiLocale, navigator.language);
	const currencies = currencyChoices(uiLocale);

	let name = $state(m.onboarding_default_budget_name());
	let locale = $state(locales[0].value);
	let currency = $state(suggestCurrency(locales[0].value));
	let accountName = $state(m.onboarding_default_account_name());
	let accountType = $state<AccountType>('checking');
	let onBudget = $state(true);
	let balance = $state('');
	let date = $state(todayIso());
	let error = $state<string | null>(null);
	let busy = $state(false);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		const typed = balance.trim() === '' ? 0 : parseAmount(balance, { currency, locale });
		if (typed === null) {
			error = m.form_error_amount_invalid();
			return;
		}
		busy = true;
		let created: { file: string; meta: BudgetMeta } | undefined;
		error = await runAction(async () => {
			created = await createBudget(api, localStorage, {
				name,
				currency,
				locale,
				groups: defaultCategoryGroups(),
				account: {
					name: accountName,
					type: accountType,
					onBudget,
					startingBalance: signedStartingBalance(accountType, typed),
					startingDate: date
				}
			});
		});
		busy = false;
		if (!created) return;
		void navigator.storage?.persist?.();
		onCreated(created.file, created.meta);
	}
</script>

<main class="flex min-h-dvh items-start justify-center p-4 sm:items-center">
	<Card.Root class="w-full max-w-lg">
		<Card.Header>
			<Card.Title class="text-xl">
				{onCancel ? m.onboarding_new_title() : m.onboarding_title()}
			</Card.Title>
			<Card.Description>{m.onboarding_intro()}</Card.Description>
		</Card.Header>
		<Card.Content>
			<form class="grid gap-6" onsubmit={submit}>
				<fieldset class="grid gap-4">
					<legend class="mb-2 text-sm font-medium">{m.onboarding_budget_section()}</legend>
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
				</fieldset>
				<fieldset class="grid gap-4">
					<legend class="mb-2 text-sm font-medium">{m.onboarding_account_section()}</legend>
					<AccountFields
						bind:name={accountName}
						bind:type={accountType}
						bind:onBudget
						bind:balance
						bind:date
					/>
				</fieldset>
				{#if error}
					<p class="text-sm text-destructive" role="alert">{error}</p>
				{/if}
				<div class="flex flex-col gap-2 sm:flex-row-reverse">
					<Button type="submit" disabled={busy}>{m.onboarding_create()}</Button>
					{#if onCancel}
						<Button type="button" variant="outline" disabled={busy} onclick={onCancel}>
							{m.cancel()}
						</Button>
					{/if}
				</div>
			</form>
		</Card.Content>
	</Card.Root>
</main>
