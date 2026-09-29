<script lang="ts">
	import { Button } from '$ui/button';
	import { Input } from '$ui/input';
	import { Label } from '$ui/label';
	import { Separator } from '$ui/separator';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import ConfirmPanel from '$components/ConfirmPanel.svelte';
	import SheetLink from '$components/SheetLink.svelte';
	import ResponsiveDialog from '$components/ResponsiveDialog.svelte';
	import FormMessage from '$components/FormMessage.svelte';
	import { useSession } from '$client/app-state.svelte';
	import { runAction, type ActionError } from '$client/notify';
	import type { Account } from '$db/repos/accounts';
	import { m } from '$i18n/paraglide/messages';
	import { parseBillingDays } from '$features/accounts/account-form';
	import BillingDaysFields from './BillingDaysFields.svelte';

	let { open = $bindable(false), account }: { open: boolean; account: Account } = $props();
	const session = useSession();
	let name = $state('');
	let closingDay = $state('');
	let dueDay = $state('');
	let confirming = $state(false);
	let busy = $state(false);
	let error = $state<ActionError | null>(null);

	$effect(() => {
		if (!open) return;
		name = account.name;
		closingDay = account.closingDay?.toString() ?? '';
		dueDay = account.dueDay?.toString() ?? '';
		confirming = false;
		error = null;
	});

	async function act(fn: () => Promise<unknown>) {
		busy = true;
		error = await runAction(fn);
		busy = false;
		if (!error) open = false;
	}

	/** Moves to the delete confirmation, or back to the settings. */
	function confirm(next: boolean) {
		confirming = next;
		error = null;
	}

	function rename(event: SubmitEvent) {
		event.preventDefault();
		void act(() => session.api.accounts.rename(account.id, name));
	}

	/** Saves a card's billing days; both left blank clears them. */
	function saveBilling(event: SubmitEvent) {
		event.preventDefault();
		const days = parseBillingDays(closingDay, dueDay);
		if (days === 'invalid') {
			error = { message: m.form_error_billing_days_invalid() };
			return;
		}
		void act(() => session.api.accounts.setBilling(account.id, days ?? undefined));
	}
</script>

<ResponsiveDialog
	bind:open
	title={confirming ? m.account_delete_title() : account.name}
	onBack={confirming ? () => confirm(false) : undefined}
>
	{#if confirming}
		<ConfirmPanel
			body={m.confirm_cannot_undo()}
			confirmLabel={m.delete()}
			{error}
			{busy}
			onCancel={() => confirm(false)}
			onConfirm={() => act(() => session.api.accounts.delete(account.id))}
		/>
	{:else}
		<div class="grid gap-4">
			<form class="grid gap-2" onsubmit={rename}>
				<Label for="account-rename">{m.account_name()}</Label>
				<div class="flex gap-2">
					<Input id="account-rename" bind:value={name} required autocomplete="off" />
					<Button type="submit" variant="outline">{m.save()}</Button>
				</div>
			</form>
			{#if account.type === 'credit_card'}
				<form class="grid gap-2" onsubmit={saveBilling}>
					<BillingDaysFields bind:closing={closingDay} bind:due={dueDay} idPrefix="account" />
					<Button type="submit" variant="outline" class="justify-self-end">{m.save()}</Button>
				</form>
			{/if}
			<Separator />
			{#if account.closed}
				<Button
					variant="outline"
					onclick={() => act(() => session.api.accounts.reopen(account.id))}
				>
					{m.account_reopen()}
				</Button>
			{:else}
				<div class="grid gap-1">
					<Button
						variant="outline"
						onclick={() => act(() => session.api.accounts.close(account.id))}
					>
						{m.account_close()}
					</Button>
					<p class="text-xs text-muted-foreground">{m.account_close_hint()}</p>
				</div>
			{/if}
			<div class="grid gap-1">
				<div class="-mx-2 grid">
					<SheetLink
						icon={Trash2Icon}
						label={m.account_delete()}
						destructive
						onclick={() => confirm(true)}
					/>
				</div>
				<p class="text-xs text-muted-foreground">{m.account_delete_hint()}</p>
			</div>
			<FormMessage {error} />
		</div>
	{/if}
</ResponsiveDialog>
