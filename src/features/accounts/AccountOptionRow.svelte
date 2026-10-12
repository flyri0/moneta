<script lang="ts">
	import { useSession } from '$client/app-state.svelte';
	import { accountTypeLabel } from '$i18n/labels';
	import { m } from '$i18n/paraglide/messages';
	import type { FormAccount } from '$features/transactions/form';
	import AccountIcon from './AccountIcon.svelte';

	/** The same account context in source and transfer destination lists. */
	let { account, label }: { account: FormAccount; label: string } = $props();
	const session = useSession();
</script>

<div class="flex min-w-0 flex-1 items-center gap-2" data-testid="account-option">
	<AccountIcon
		account={{ type: account.type, icon: account.icon ?? null }}
		class="size-4 shrink-0"
	/>
	<div class="min-w-0 flex-1">
		<div class="truncate" title={label}>{label}</div>
		<div class="text-xs text-muted-foreground">
			{accountTypeLabel(account.type)} · {account.onBudget
				? m.accounts_on_budget()
				: m.accounts_off_budget()}
			{#if account.closed}
				· {m.accounts_closed()}{/if}
		</div>
	</div>
	{#if account.balance !== undefined}
		<div class="shrink-0 text-right">
			<div class="tabular-nums">{session.format(account.balance)}</div>
			<div class="text-xs text-muted-foreground">{m.account_picker_current_balance()}</div>
		</div>
	{/if}
</div>
