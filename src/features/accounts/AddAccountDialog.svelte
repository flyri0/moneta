<script lang="ts">
	import { Button } from '$ui/button';
	import { Combobox } from '$ui/combobox';
	import { Label } from '$ui/label';
	import ResponsiveDialog from '$components/ResponsiveDialog.svelte';
	import FormMessage from '$components/FormMessage.svelte';
	import { defaultOnBudget, signedStartingBalance } from '$features/accounts/account-form';
	import { useSession } from '$client/app-state.svelte';
	import { useLive } from '$client/live.svelte';
	import { runAction, type ActionError } from '$client/notify';
	import type { AccountType } from '$db/repos/accounts';
	import { todayIso } from '$domain/month';
	import { categoryLabel, groupLabel } from '$i18n/labels';
	import { m } from '$i18n/paraglide/messages';
	import AccountFields from './AccountFields.svelte';
	import AccountTypePicker from './AccountTypePicker.svelte';

	let { open = $bindable(false) }: { open: boolean } = $props();
	const session = useSession();
	const tree = useLive(session.client, ['category_groups', 'categories'], () =>
		session.api.categories.tree()
	);
	const startingCategory = useLive(session.client, ['categories', 'meta'], () =>
		session.api.categories.startingBalanceId()
	);

	let step = $state<1 | 2>(1);
	let name = $state('');
	let type = $state<AccountType>('checking');
	let onBudget = $state(true);
	let balance = $state('');
	let date = $state(todayIso());
	// Empty until the user picks one: the starting balance category, created again if it is gone.
	let categoryId = $state('');
	let error = $state<ActionError | null>(null);

	$effect(() => {
		if (!open) return;
		step = 1;
		name = '';
		type = 'checking';
		onBudget = true;
		balance = '';
		date = todayIso();
		categoryId = '';
		error = null;
	});

	const categoryGroups = $derived(
		(tree.data ?? [])
			.map((g) => ({
				heading: groupLabel(g),
				items: g.categories
					.filter((c) => !c.hidden)
					.map((c) => ({ value: c.id, label: categoryLabel(c) }))
			}))
			.filter((g) => g.items.length > 0)
	);

	function selectType(selectedType: AccountType) {
		type = selectedType;
		onBudget = defaultOnBudget(selectedType);
		step = 2;
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		const typed = balance.trim() === '' ? 0 : session.parse(balance);
		if (typed === null) {
			error = { message: m.form_error_amount_invalid() };
			return;
		}
		error = await runAction(() =>
			session.api.accounts.create({
				name,
				type,
				onBudget,
				startingBalance: signedStartingBalance(type, typed),
				startingDate: date,
				startingBalanceCategoryId: categoryId || undefined
			})
		);
		if (!error) open = false;
	}
</script>

<ResponsiveDialog bind:open title={m.accounts_add()}>
	{#if step === 1}
		<AccountTypePicker selected={type} onSelect={selectType} />
	{:else}
		<form class="grid gap-4" onsubmit={submit}>
			<AccountFields
				bind:name
				bind:type
				bind:onBudget
				bind:balance
				bind:date
				idPrefix="new-account"
				onChangeType={() => (step = 1)}
			/>
			{#if onBudget}
				<div class="grid gap-2">
					<Label for="new-account-category">{m.account_starting_category()}</Label>
					<Combobox
						id="new-account-category"
						ariaLabel={m.account_starting_category()}
						groups={categoryGroups}
						value={categoryId || (startingCategory.data ?? '')}
						onSelect={(id) => (categoryId = id)}
						placeholder={m.register_starting_balance()}
					/>
				</div>
			{/if}
			<FormMessage {error} />
			<Button type="submit">{m.accounts_add()}</Button>
		</form>
	{/if}
</ResponsiveDialog>
