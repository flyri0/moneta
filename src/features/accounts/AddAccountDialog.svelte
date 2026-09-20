<script lang="ts">
	import { Button } from '$ui/button';
	import ResponsiveDialog from '$components/ResponsiveDialog.svelte';
	import { signedStartingBalance } from '$features/accounts/account-form';
	import { useSession } from '$client/app-state.svelte';
	import { runAction } from '$client/notify';
	import type { AccountType } from '$db/repos/accounts';
	import { todayIso } from '$domain/month';
	import { m } from '$i18n/paraglide/messages';
	import AccountFields from './AccountFields.svelte';

	let { open = $bindable(false) }: { open: boolean } = $props();
	const session = useSession();

	let name = $state('');
	let type = $state<AccountType>('checking');
	let onBudget = $state(true);
	let balance = $state('');
	let date = $state(todayIso());
	let error = $state<string | null>(null);

	$effect(() => {
		if (!open) return;
		name = '';
		type = 'checking';
		onBudget = true;
		balance = '';
		date = todayIso();
		error = null;
	});

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		const typed = balance.trim() === '' ? 0 : session.parse(balance);
		if (typed === null) {
			error = m.form_error_amount_invalid();
			return;
		}
		error = await runAction(() =>
			session.api.accounts.create({
				name,
				type,
				onBudget,
				startingBalance: signedStartingBalance(type, typed),
				startingDate: date
			})
		);
		if (!error) open = false;
	}
</script>

<ResponsiveDialog bind:open title={m.accounts_add()}>
	<form class="grid gap-4" onsubmit={submit}>
		<AccountFields
			bind:name
			bind:type
			bind:onBudget
			bind:balance
			bind:date
			idPrefix="new-account"
		/>
		{#if error}<p class="text-sm text-destructive" role="alert">{error}</p>{/if}
		<Button type="submit">{m.accounts_add()}</Button>
	</form>
</ResponsiveDialog>
