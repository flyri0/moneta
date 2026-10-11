<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Button } from '$ui/button';
	import { Input } from '$ui/input';
	import { Label } from '$ui/label';
	import { Separator } from '$ui/separator';
	import ResponsiveDialog from '$components/ResponsiveDialog.svelte';
	import FormMessage from '$components/FormMessage.svelte';
	import IconField from '$components/emoji-picker/IconField.svelte';
	import { useSession } from '$client/app-state.svelte';
	import { runAction, type ActionError } from '$client/notify';
	import type { Account } from '$db/repos/accounts';
	import { m } from '$i18n/paraglide/messages';
	import { parseBillingDays } from '$features/accounts/account-form';
	import BillingDaysFields from './BillingDaysFields.svelte';
	import CloseAccountPanel from './CloseAccountPanel.svelte';
	import DeleteAccountPanel from './DeleteAccountPanel.svelte';

	let { open = $bindable(false), account }: { open: boolean; account: Account } = $props();
	const session = useSession();
	let name = $state('');
	let icon = $state<string | null>(null);
	let closingDay = $state('');
	let dueDay = $state('');
	let screen = $state<'settings' | 'close' | 'delete'>('settings');
	let busy = $state(false);
	let error = $state<ActionError | null>(null);
	let billingInvalid = $state(false);

	$effect(() => {
		if (!open) return;
		name = account.name;
		icon = account.icon;
		closingDay = account.closingDay?.toString() ?? '';
		dueDay = account.dueDay?.toString() ?? '';
		screen = 'settings';
		error = null;
		billingInvalid = false;
	});

	// Editing a day clears the mark: it was about what was typed before.
	$effect(() => {
		void [closingDay, dueDay];
		billingInvalid = false;
	});

	async function act(fn: () => Promise<unknown>) {
		if (busy) return;
		busy = true;
		error = await runAction(fn);
		busy = false;
		if (!error) open = false;
	}

	/** A deleted account's register would point to an account that no longer exists. */
	function deleted() {
		open = false;
		void goto(resolve('/accounts'));
	}

	/** Saves the name, the icon and, on a card, its billing days (both left blank clears them). */
	function save(event: SubmitEvent) {
		event.preventDefault();
		if (!name.trim()) {
			error = { message: m.form_error_name_required() };
			return;
		}
		const isCard = account.type === 'credit_card';
		const days = isCard ? parseBillingDays(closingDay, dueDay) : null;
		billingInvalid = days === 'invalid';
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
	title={screen === 'close'
		? m.account_close_title({ name: account.name })
		: screen === 'delete'
			? m.account_delete_all_title({ name: account.name })
			: account.name}
	onBack={screen === 'settings' ? undefined : () => (screen = 'settings')}
>
	{#if screen === 'close'}
		<CloseAccountPanel
			{account}
			onCancel={() => (screen = 'settings')}
			onClosed={() => (open = false)}
			onDelete={() => (screen = 'delete')}
		/>
	{:else if screen === 'delete'}
		<DeleteAccountPanel {account} onCancel={() => (screen = 'settings')} onDeleted={deleted} />
	{:else}
		<div class="grid gap-4">
			<form class="grid gap-4" onsubmit={save}>
				<div class="grid gap-2">
					<Label for="account-rename">{m.account_name()}</Label>
					<Input id="account-rename" bind:value={name} aria-required="true" autocomplete="off" />
				</div>
				<div class="grid gap-2">
					<Label for="account-icon">{m.icon_label()}</Label>
					<IconField id="account-icon" value={icon} onchange={(next) => (icon = next)} />
				</div>
				{#if account.type === 'credit_card'}
					<BillingDaysFields
						bind:closing={closingDay}
						bind:due={dueDay}
						idPrefix="account"
						invalid={billingInvalid}
					/>
				{/if}
				<FormMessage {error} values={[name, icon, closingDay, dueDay]} />
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
				<button
					type="button"
					class="justify-self-center text-xs text-muted-foreground underline-offset-2 hover:text-destructive hover:underline"
					disabled={busy}
					onclick={() => (screen = 'delete')}
				>
					{m.account_delete_all()}
				</button>
			{:else}
				<div class="grid gap-1">
					<Button variant="outline" disabled={busy} onclick={() => (screen = 'close')}>
						{m.account_close()}
					</Button>
					<p class="text-xs text-muted-foreground">{m.account_close_hint()}</p>
				</div>
			{/if}
		</div>
	{/if}
</ResponsiveDialog>
