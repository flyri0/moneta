<script lang="ts">
	import { Button } from '$ui/button';
	import { Input } from '$ui/input';
	import { Label } from '$ui/label';
	import { Separator } from '$ui/separator';
	import ConfirmPanel from '$components/ConfirmPanel.svelte';
	import ResponsiveDialog from '$components/ResponsiveDialog.svelte';
	import FormMessage from '$components/FormMessage.svelte';
	import { useSession } from '$client/app-state.svelte';
	import { runAction, type ActionError } from '$client/notify';
	import type { Account } from '$db/repos/accounts';
	import { m } from '$i18n/paraglide/messages';

	let { open = $bindable(false), account }: { open: boolean; account: Account } = $props();
	const session = useSession();
	let name = $state('');
	let confirming = $state(false);
	let busy = $state(false);
	let error = $state<ActionError | null>(null);

	$effect(() => {
		if (!open) return;
		name = account.name;
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
				<Button variant="destructive" onclick={() => confirm(true)}>
					{m.account_delete()}
				</Button>
				<p class="text-xs text-muted-foreground">{m.account_delete_hint()}</p>
			</div>
			<FormMessage {error} />
		</div>
	{/if}
</ResponsiveDialog>
