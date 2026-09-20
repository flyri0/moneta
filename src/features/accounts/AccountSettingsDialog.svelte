<script lang="ts">
	import { Button } from '$ui/button';
	import { Input } from '$ui/input';
	import { Label } from '$ui/label';
	import { Separator } from '$ui/separator';
	import ResponsiveDialog from '$components/ResponsiveDialog.svelte';
	import { useSession } from '$client/app-state.svelte';
	import { runAction } from '$client/notify';
	import type { Account } from '$db/repos/accounts';
	import { m } from '$i18n/paraglide/messages';

	let { open = $bindable(false), account }: { open: boolean; account: Account } = $props();
	const session = useSession();
	let name = $state('');
	let confirmDelete = $state(false);
	let error = $state<string | null>(null);

	$effect(() => {
		if (!open) return;
		name = account.name;
		confirmDelete = false;
		error = null;
	});

	async function act(fn: () => Promise<unknown>) {
		error = await runAction(fn);
		if (!error) open = false;
	}

	function rename(event: SubmitEvent) {
		event.preventDefault();
		void act(() => session.api.accounts.rename(account.id, name));
	}

	function remove() {
		if (!confirmDelete) confirmDelete = true;
		else void act(() => session.api.accounts.delete(account.id));
	}
</script>

<ResponsiveDialog bind:open title={account.name}>
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
			<Button variant="outline" onclick={() => act(() => session.api.accounts.reopen(account.id))}>
				{m.account_reopen()}
			</Button>
		{:else}
			<div class="grid gap-1">
				<Button variant="outline" onclick={() => act(() => session.api.accounts.close(account.id))}>
					{m.account_close()}
				</Button>
				<p class="text-xs text-muted-foreground">{m.account_close_hint()}</p>
			</div>
		{/if}
		<div class="grid gap-1">
			<Button variant="destructive" onclick={remove}>
				{confirmDelete ? m.confirm_delete() : m.account_delete()}
			</Button>
			<p class="text-xs text-muted-foreground">{m.account_delete_hint()}</p>
		</div>
		{#if error}<p class="text-sm text-destructive" role="alert">{error}</p>{/if}
	</div>
</ResponsiveDialog>
