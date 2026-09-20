<script lang="ts">
	import { signedStartingBalance } from '$lib/accounts/account-form';
	import { toast } from 'svelte-sonner';
	import { runAction } from '$lib/client/notify';
	import { createBudget, restoreBudget, type SessionApi } from '$lib/client/session';
	import type { AccountType } from '$lib/db/repos/accounts';
	import type { BudgetMeta } from '$lib/db/repos/meta';
	import { parseAmount } from '$lib/domain/money';
	import { todayIso } from '$lib/domain/month';
	import { defaultCategoryGroups } from '$lib/i18n/defaults';
	import { suggestCurrency, localeChoices } from '$lib/i18n/formats';
	import {
		onboardingSteps,
		stepAfter,
		stepBefore,
		stepNumber,
		type OnboardingStep
	} from '$lib/onboarding/steps';
	import { starterSelection, toGroupsInput } from '$lib/onboarding/starter-categories';
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';
	import AccountStep from './AccountStep.svelte';
	import BackupsStep from './BackupsStep.svelte';
	import BudgetStep from './BudgetStep.svelte';
	import CategoriesStep from './CategoriesStep.svelte';
	import DoneStep from './DoneStep.svelte';
	import WelcomeStep from './WelcomeStep.svelte';

	/**
	 * First-run setup, step by step. Also used from Settings to add a budget: `onCancel` then goes
	 * back, and the steps that explain the app are left out.
	 */
	let {
		api,
		onCreated,
		onCancel
	}: {
		api: SessionApi;
		onCreated: (file: string, meta: BudgetMeta) => void;
		onCancel?: () => void;
	} = $props();

	const steps = $derived(onboardingSteps(onCancel ? 'additional' : 'first-run'));
	const total = $derived(steps.length);
	const firstLocale = localeChoices(getLocale(), navigator.language)[0].value;

	// Null until the user moves: the flow always opens on the first step of whichever mode it is.
	let moved = $state<OnboardingStep | null>(null);
	const step = $derived(moved ?? steps[0]);

	let name = $state(m.onboarding_default_budget_name());
	let locale = $state(firstLocale);
	let currency = $state(suggestCurrency(firstLocale));
	// The starter names follow the UI language, not the number format picked on the budget step.
	let selection = $state(starterSelection(defaultCategoryGroups()));
	let accountName = $state(m.onboarding_default_account_name());
	let accountType = $state<AccountType>('checking');
	let onBudget = $state(true);
	let balance = $state('');
	let date = $state(todayIso());

	let error = $state<string | null>(null);
	let busy = $state(false);
	let created = $state.raw<{ file: string; meta: BudgetMeta } | null>(null);

	function back() {
		error = null;
		const previous = stepBefore(steps, step);
		if (previous) moved = previous;
		else onCancel?.();
	}

	function next() {
		error = null;
		const following = stepAfter(steps, step);
		if (following) moved = following;
	}

	function finish() {
		if (created) onCreated(created.file, created.meta);
	}

	async function create() {
		const typed = balance.trim() === '' ? 0 : parseAmount(balance, { currency, locale });
		if (typed === null) {
			error = m.form_error_amount_invalid();
			return;
		}
		busy = true;
		error = await runAction(async () => {
			created = await createBudget(api, localStorage, {
				name,
				currency,
				locale,
				groups: toGroupsInput(selection),
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
		if (stepAfter(steps, step)) next();
		else finish();
	}

	async function restore(file: File) {
		busy = true;
		error = null;
		const bytes = new Uint8Array(await file.arrayBuffer());
		error = await runAction(async () => {
			const restored = await restoreBudget(api, localStorage, bytes);
			void navigator.storage?.persist?.();
			toast.success(m.backup_restored());
			onCreated(restored.file, restored.meta);
		});
		busy = false;
	}
</script>

{#if step === 'welcome'}
	<WelcomeStep current={stepNumber(steps, step)} {total} onNext={next} />
{:else if step === 'backups'}
	<BackupsStep
		current={stepNumber(steps, step)}
		{total}
		{busy}
		{error}
		onNext={next}
		onBack={back}
		onRestore={restore}
	/>
{:else if step === 'budget'}
	<BudgetStep
		title={onCancel ? m.onboarding_new_title() : m.onboarding_budget_section()}
		current={stepNumber(steps, step)}
		{total}
		onNext={next}
		onBack={back}
		backLabel={stepBefore(steps, step) ? m.onboarding_back() : onCancel ? m.cancel() : undefined}
		bind:name
		bind:locale
		bind:currency
	/>
{:else if step === 'categories'}
	<CategoriesStep
		current={stepNumber(steps, step)}
		{total}
		onNext={next}
		onBack={back}
		bind:selection
	/>
{:else if step === 'account'}
	<AccountStep
		current={stepNumber(steps, step)}
		{total}
		onNext={create}
		onBack={back}
		{busy}
		{error}
		bind:name={accountName}
		bind:type={accountType}
		bind:onBudget
		bind:balance
		bind:date
	/>
{:else if step === 'done'}
	<DoneStep current={stepNumber(steps, step)} {total} onNext={finish} />
{/if}
