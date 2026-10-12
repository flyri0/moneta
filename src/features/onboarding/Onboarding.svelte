<script lang="ts">
	import { toast } from 'svelte-sonner';

	import { setMobileBack } from '$client/mobile-back.svelte';
	import { type ActionError, runAction } from '$client/notify';
	import { loadRegistry } from '$client/registry';
	import { createBudget, restoreAll, type SessionApi } from '$client/session';
	import { planTour } from '$client/tour';

	import type { AccountType } from '$db/repos/accounts';
	import type { BudgetMeta } from '$db/repos/meta';
	import { parseBillingDays, signedStartingBalance } from '$features/accounts/account-form';
	import { readBackupFile } from '$features/backup/actions';
	import { cloudBackup } from '$features/backup/cloud/cloud.svelte';
	import UnlockBackupDialog from '$features/backup/UnlockBackupDialog.svelte';
	import {
		starterSelection,
		toGroupsInput,
		toIncomeInput
	} from '$features/onboarding/starter-categories';
	import {
		type OnboardingStep,
		onboardingSteps,
		stepAfter,
		stepBefore,
		stepNumber
	} from '$features/onboarding/steps';
	import { budgetName } from '$features/settings/budget-name';

	// Onboarding keeps its own step navigation.
	setMobileBack(null);

	import { defaultCategoryGroups, defaultIncomeCategories } from '$i18n/defaults';
	import { localeChoices, suggestCurrency } from '$i18n/formats';
	import { m } from '$i18n/paraglide/messages';
	import { getLocale } from '$i18n/paraglide/runtime';

	import { formatAmountInput, parseAmount } from '$domain/money';
	import { todayIso } from '$domain/month';

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
	let selection = $state(
		starterSelection(defaultCategoryGroups(), {
			name: m.group_income(),
			categories: defaultIncomeCategories()
		})
	);
	let accountName = $state(m.onboarding_default_account_name());
	let accountType = $state<AccountType>('checking');
	let onBudget = $state(true);
	let balance = $state('');
	let date = $state(todayIso());
	let closingDay = $state('');
	let dueDay = $state('');
	let billingInvalid = $state(false);
	$effect(() => {
		void [closingDay, dueDay];
		billingInvalid = false;
	});
	let accountView = $state<'type' | 'form'>('type');

	let error = $state<ActionError | null>(null);
	let busy = $state(false);
	/** An encrypted backup waiting for its password. */
	let locked = $state.raw<Uint8Array | null>(null);
	let unlocking = $state(false);
	let created = $state.raw<{ file: string; meta: BudgetMeta } | null>(null);

	function back() {
		error = null;
		const previous = stepBefore(steps, step);
		if (previous) moved = previous;
		else onCancel?.();
	}

	function next() {
		error = null;
		if (step === 'budget' && budgetName(name) === null) {
			error = { message: m.budget_name_required() };
			// On phones focusing it would raise the keyboard: the message and the marked field do.
			if (matchMedia('(min-width: 768px)').matches) document.getElementById('budget-name')?.focus();
			return;
		}
		const following = stepAfter(steps, step);
		if (following) moved = following;
	}

	function finish() {
		if (created) onCreated(created.file, created.meta);
	}

	/** Creates the budget, with the account from the account step unless `withAccount` is false. */
	async function create(withAccount = true) {
		if (busy) return;
		if (withAccount && !accountName.trim()) {
			error = { message: m.form_error_name_required() };
			return;
		}
		const typed =
			!withAccount || balance.trim() === '' ? 0 : parseAmount(balance, { currency, locale });
		if (typed === null) {
			error = {
				message: m.form_error_amount_invalid({
					example: formatAmountInput(1250, { currency, locale })
				})
			};
			return;
		}
		const billing =
			withAccount && accountType === 'credit_card' ? parseBillingDays(closingDay, dueDay) : null;
		billingInvalid = billing === 'invalid';
		if (billingInvalid) {
			error = { message: m.form_error_billing_days_invalid() };
			return;
		}
		busy = true;
		// The tour is for someone's very first budget here, not for one more of them.
		const first = !onCancel && loadRegistry(localStorage).budgets.length === 0;
		error = await runAction(async () => {
			created = await createBudget(api, localStorage, {
				name: budgetName(name) ?? name,
				currency,
				locale,
				income: toIncomeInput(selection),
				groups: toGroupsInput(selection),
				account: withAccount
					? {
							name: accountName,
							type: accountType,
							onBudget,
							startingBalance: signedStartingBalance(accountType, typed),
							startingDate: date,
							startingBalanceName: m.default_category_starting_balance(),
							billing: billing === 'invalid' ? null : billing
						}
					: undefined
			});
		});
		busy = false;
		if (!created) return;
		if (first) planTour(localStorage, created.file);
		void navigator.storage?.persist?.();
		if (stepAfter(steps, step)) next();
		else finish();
	}

	/** The file being restored, to tell the cloud backup which one it was. */
	let source: File | null = null;

	async function restore(file: File) {
		if (busy) return;
		source = file;
		busy = true;
		error = null;
		let plain: Uint8Array | null = null;
		error = await runAction(async () => {
			const read = await readBackupFile(api, file);
			if (!read.encrypted) plain = read.bytes;
			else {
				locked = read.bytes;
				unlocking = true;
			}
		});
		busy = false;
		if (plain) await restoreBytes(plain);
	}

	async function restoreBytes(bytes: Uint8Array) {
		if (busy) return;
		busy = true;
		error = null;
		error = await runAction(async () => {
			const restored = await restoreAll(api, localStorage, bytes);
			await cloudBackup.restored(api, { source, all: true, files: restored.files }).catch(() => {});
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
		{error}
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
		onNext={() => create()}
		onBack={back}
		onSkip={() => create(false)}
		{busy}
		{error}
		bind:name={accountName}
		bind:type={accountType}
		bind:onBudget
		bind:balance
		bind:date
		bind:closingDay
		bind:dueDay
		{billingInvalid}
		bind:view={accountView}
		money={{ currency, locale }}
	/>
{:else if step === 'done'}
	<DoneStep current={stepNumber(steps, step)} {total} onNext={finish} />
{/if}

<UnlockBackupDialog bind:open={unlocking} {api} bytes={locked} onunlock={restoreBytes} />
