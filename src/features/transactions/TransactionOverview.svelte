<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import LandmarkIcon from '@lucide/svelte/icons/landmark';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import { Badge } from '$ui/badge';
	import FormMessage from '$components/FormMessage.svelte';
	import SheetLink from '$components/SheetLink.svelte';
	import { payeeDisplay, payeeText } from '$features/accounts/register';
	import { useSession } from '$client/app-state.svelte';
	import { useLive } from '$client/live.svelte';
	import { actionError, runActionToast } from '$client/notify';
	import type { TransactionRow } from '$db/repos/transactions';
	import { formatDate } from '$i18n/formats';
	import { storedCategoryLabel } from '$i18n/labels';
	import { m } from '$i18n/paraglide/messages';
	import { getLocale } from '$i18n/paraglide/runtime';
	import FlagField from '$features/flags/FlagField.svelte';
	import SplitLines from './SplitLines.svelte';

	/**
	 * Everything about a transaction, kept live, with editing, an account and deleting one tap away.
	 * `onLeave` closes the dialog before opening the account.
	 */
	let {
		transactionId,
		onEdit,
		onDelete,
		onLeave
	}: {
		transactionId: string;
		onEdit: (transaction: TransactionRow) => void;
		onDelete: () => void;
		onLeave: () => void;
	} = $props();

	const session = useSession();
	const live = useLive(
		session.client,
		['transactions', 'transaction_splits', 'payees', 'categories', 'accounts'],
		() => session.api.transactions.get(transactionId)
	);
	const t = $derived(live.data);
	const payee = $derived(t ? payeeDisplay(t) : null);
	/**
	 * The one account it links to: its own, or, on that account's page already, a transfer's other
	 * account. Nothing when there is nowhere else to go.
	 */
	const linked = $derived.by(() => {
		if (!t) return null;
		if (page.params.id !== t.accountId) return { id: t.accountId, name: t.accountName };
		if (payee?.kind === 'transfer') return { id: payee.accountId, name: payee.accountName };
		return null;
	});

	function openAccount(id: string) {
		onLeave();
		void goto(resolve('/accounts/[id]', { id }));
	}
</script>

{#if t && payee}
	<div class="grid gap-4" data-testid="transaction-overview">
		<div class="grid gap-2">
			<p
				class="text-2xl font-semibold tabular-nums {t.amount < 0
					? ''
					: 'text-emerald-700 dark:text-emerald-400'}"
				data-testid="transaction-overview-amount"
			>
				{session.format(t.amount)}
			</p>
			<div class="flex flex-wrap gap-1.5">
				{#if t.reconciled}
					<Badge variant="secondary">{m.register_reconciled()}</Badge>
				{:else if t.cleared}
					<Badge variant="secondary">{m.transaction_cleared()}</Badge>
				{:else}
					<Badge variant="outline">{m.overview_uncleared()}</Badge>
				{/if}
			</div>
		</div>

		<dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
			<dt class="text-muted-foreground">{m.transaction_date()}</dt>
			<dd class="text-right tabular-nums">{formatDate(t.date, getLocale())}</dd>

			<dt class="text-muted-foreground">{m.transaction_account()}</dt>
			<dd class="min-w-0 text-right break-words">{t.accountName}</dd>

			{#if payee.kind === 'transfer'}
				<dt class="text-muted-foreground">
					{payee.direction === 'to' ? m.overview_to() : m.overview_from()}
				</dt>
				<dd class="min-w-0 text-right break-words">{payee.accountName}</dd>
			{:else}
				<dt class="text-muted-foreground">{m.transaction_payee()}</dt>
				<dd
					class="min-w-0 text-right break-words {payee.kind === 'none'
						? 'text-muted-foreground'
						: ''}"
				>
					{payeeText(payee)}
				</dd>
			{/if}

			{#if t.isSplit}
				<dt class="text-muted-foreground">{m.transaction_category()}</dt>
				<dd class="text-right">{m.register_split({ count: t.splits.length })}</dd>
				<dd class="col-span-2"><SplitLines lines={t.splits} /></dd>
			{:else if t.categoryName}
				<dt class="text-muted-foreground">{m.transaction_category()}</dt>
				<dd class="min-w-0 text-right break-words">{storedCategoryLabel(t.categoryName)}</dd>
			{/if}

			{#if t.memo}
				<dt class="text-muted-foreground">{m.transaction_memo()}</dt>
				<dd class="min-w-0 text-right break-words whitespace-pre-line">{t.memo}</dd>
			{/if}

			<dt class="self-center text-muted-foreground">
				<label for="overview-flag">{m.flag_label()}</label>
			</dt>
			<dd class="flex justify-end">
				<FlagField
					id="overview-flag"
					class="w-auto max-w-56"
					value={t.flag}
					onchange={(flag) =>
						runActionToast(() => session.api.transactions.setFlag(t.id, flag ?? undefined))}
				/>
			</dd>
		</dl>

		<nav class="-mx-2 grid gap-0.5">
			<SheetLink icon={PencilIcon} label={m.transaction_edit_title()} onclick={() => onEdit(t)} />
			{#if linked}
				{@const account = linked}
				<SheetLink
					icon={LandmarkIcon}
					label={m.register_open_account({ account: account.name })}
					onclick={() => openAccount(account.id)}
				/>
			{/if}
			<SheetLink icon={Trash2Icon} label={m.transaction_delete()} destructive onclick={onDelete} />
		</nav>
	</div>
{:else if live.error}
	<FormMessage error={actionError(live.error)} />
{:else}
	<p class="text-muted-foreground" role="status">{m.startup_loading()}</p>
{/if}
