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
	import IconField from '$components/emoji-picker/IconField.svelte';
	import { useSession } from '$client/app-state.svelte';
	import { runAction, type ActionError } from '$client/notify';
	import { offerUndo } from '$client/undo';
	import type { Account } from '$db/repos/accounts';
	import { m } from '$i18n/paraglide/messages';
	import { parseBillingDays } from '$features/accounts/account-form';
	import BillingDaysFields from './BillingDaysFields.svelte';

	let { open = $bindable(false), account }: { open: boolean; account: Account } = $props();
	const session = useSession();
	let name = $state('');
	let icon = $state<string | null>(null);
	let closingDay = $state('');
	let dueDay = $state('');
	let confirming = $state(false);
	let busy = $state(false);
	let error = $state<ActionError | null>(null);

	$effect(() => {
		if (!open) return;
		name = account.name;
		icon = account.icon;
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

	async function remove() {
		const call = session.api.accounts.delete(account.id);
		await act(() => call);
		if (!error) offerUndo(session.client, call, m.account_deleted());
	}

	/** Moves to the delete confirmation, or back to the settings. */
	function confirm(next: boolean) {
		confirming = next;
		error = null;
	}

	/** Saves the name, the icon and, on a card, its billing days (both left blank clears them). */
	function save(event: SubmitEvent) {
		event.preventDefault();
		const isCard = account.type === 'credit_card';
		const days = isCard ? parseBillingDays(closingDay, dueDay) : null;
		if (days === 'invalid') {
			error = { message: m.form_error_billing_days_invalid() };
			return;
		}
		void act(async () => {
			if (name !== account.name) await session.api.accounts.rename(account.id, name);
			if (icon !== account.icon) await session.api.accounts.setIcon(account.id, icon ?? undefined);
			if (isCard) await session.api.accounts.setBilling(account.id, days ?? undefined);
		});
	}
</script>

<ResponsiveDialog
	bind:open
	title={confirming ? m.account_delete_title() : account.name}
	onBack={confirming ? () => confirm(false) : undefined}
>
	{#if confirming}
		<ConfirmPanel
			body={m.confirm_can_undo()}
			confirmLabel={m.delete()}
			{error}
			{busy}
			onCancel={() => confirm(false)}
			onConfirm={remove}
		/>
	{:else}
		<div class="grid gap-4">
			<form class="grid gap-4" onsubmit={save}>
				<div class="grid gap-2">
					<Label for="account-rename">{m.account_name()}</Label>
					<Input id="account-rename" bind:value={name} required autocomplete="off" />
				</div>
				<div class="grid gap-2">
					<Label for="account-icon">{m.icon_label()}</Label>
					<IconField id="account-icon" value={icon} onchange={(next) => (icon = next)} />
				</div>
				{#if account.type === 'credit_card'}
					<BillingDaysFields bind:closing={closingDay} bind:due={dueDay} idPrefix="account" />
				{/if}
				<FormMessage {error} />
				<div class="grid grid-cols-2 gap-2">
					<Button variant="outline" disabled={busy} onclick={() => (open = false)}>
						{m.cancel()}
					</Button>
					<Button type="submit" disabled={busy}>{m.save()}</Button>
				</div>
			</form>
			<Separator />
			{#if account.closed}
				<Button
					variant="outline"
					disabled={busy}
					onclick={() => act(() => session.api.accounts.reopen(account.id))}
				>
					{m.account_reopen()}
				</Button>
			{:else}
				<div class="grid gap-1">
					<Button
						variant="outline"
						disabled={busy}
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
		</div>
	{/if}
</ResponsiveDialog>
