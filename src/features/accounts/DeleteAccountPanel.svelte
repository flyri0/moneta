<script lang="ts">
	import { MediaQuery } from 'svelte/reactivity';
	import { Button } from '$ui/button';
	import ConfirmPanel from '$components/ConfirmPanel.svelte';
	import FormMessage from '$components/FormMessage.svelte';
	import LoadingRows from '$components/LoadingRows.svelte';
	import { useSession } from '$client/app-state.svelte';
	import { useLive } from '$client/live.svelte';
	import { Countdown } from '$client/countdown';
	import { actionError, runAction, type ActionError } from '$client/notify';
	import { offerUndo } from '$client/undo';
	import type { Account } from '$db/repos/accounts';
	import { m } from '$i18n/paraglide/messages';

	/** Lists what deletion takes away; nonempty accounts wait before a second confirmation. */
	let {
		account,
		onCancel,
		onDeleted
	}: { account: Account; onCancel: () => void; onDeleted: () => void } = $props();
	const session = useSession();
	const impact = useLive(session.client, ['accounts', 'transactions', 'schedules'], () =>
		session.api.accounts.deletionImpact(account.id)
	);
	let error = $state<ActionError | null>(null);
	let busy = $state(false);
	let armed = $state(false);
	let seconds = $state(0);
	const wait = new Countdown(5, (s) => ([armed, seconds] = [s.armed, s.seconds]));
	const finePointer = new MediaQuery('(hover: hover) and (pointer: fine)');
	const empty = $derived(impact.data?.transactions === 0 && impact.data?.schedules === 0);
	const shownError = $derived(error ?? (impact.error ? actionError(impact.error) : null));

	$effect(() => {
		void account.id;
		return () => wait.reset();
	});

	async function remove() {
		if (busy || !impact.data) return;
		if (!empty && !wait.ready) {
			if (!wait.armed) wait.arm();
			return;
		}
		busy = true;
		const call = empty
			? session.api.accounts.delete(account.id)
			: session.api.accounts.deleteWithTransactions(account.id);
		error = await runAction(() => call);
		busy = false;
		if (error) return;
		offerUndo(session.client, call, m.account_deleted());
		onDeleted();
	}
</script>

{#if impact.data === undefined}
	{#if !impact.error}<LoadingRows rows={2} />{/if}
	<FormMessage error={shownError} />
{:else if empty}
	<ConfirmPanel
		body={m.confirm_can_undo()}
		confirmLabel={m.delete()}
		error={shownError}
		{busy}
		{onCancel}
		onConfirm={remove}
	/>
{:else}
	<div
		class="grid gap-4 transition-opacity aria-busy:opacity-60 aria-busy:delay-150"
		aria-busy={impact.stale}
	>
		<ul class="grid gap-1 text-sm">
			<li>{m.account_delete_all_transactions({ count: impact.data.transactions })}</li>
			{#if impact.data.schedules > 0}
				<li>{m.account_delete_all_schedules({ count: impact.data.schedules })}</li>
			{/if}
			{#each impact.data.transfers as t (t.accountId)}
				<li>
					{m.account_delete_all_transfer({
						name: t.accountName,
						count: t.count,
						change: session.formatSigned(t.balanceChange)
					})}
					{#if t.reconciled > 0}{m.account_delete_all_reconciled({ count: t.reconciled })}{/if}
				</li>
			{/each}
		</ul>
		<p
			class="text-sm {armed ? 'font-medium text-destructive' : 'text-muted-foreground'}"
			role="status"
		>
			{m.account_delete_all_body()}
		</p>
		<FormMessage error={shownError} />
		<div class="grid grid-cols-2 gap-2">
			<Button variant="outline" disabled={busy} onclick={onCancel}>{m.cancel()}</Button>
			<Button
				variant="destructive"
				class="h-auto min-h-9 py-1.5 whitespace-normal"
				disabled={busy || (armed && seconds > 0)}
				onclick={remove}
			>
				{#if !armed}
					{m.account_delete_all_confirm()}
				{:else if seconds > 0}
					{m.budget_delete_wait({ seconds })}
				{:else}
					{finePointer.current ? m.confirm_delete_click() : m.confirm_delete()}
				{/if}
			</Button>
		</div>
	</div>
{/if}
