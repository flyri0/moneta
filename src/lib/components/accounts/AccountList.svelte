<script lang="ts">
	import { resolve } from '$app/paths';
	import SettingsIcon from '@lucide/svelte/icons/settings-2';
	import { Button } from '$lib/components/ui/button';
	import { accountSections, type AccountSectionKey } from '$lib/accounts/account-form';
	import { useSession } from '$lib/client/app-state.svelte';
	import type { Account } from '$lib/db/repos/accounts';
	import { m } from '$lib/paraglide/messages';

	let { accounts, onSettings }: { accounts: Account[]; onSettings?: (account: Account) => void } =
		$props();

	const session = useSession();
	const sections = $derived(accountSections(accounts));
	const TITLES: Record<AccountSectionKey, () => string> = {
		onBudget: m.accounts_on_budget,
		offBudget: m.accounts_off_budget,
		closed: m.accounts_closed
	};
</script>

<div class="grid gap-4">
	{#each sections as section (section.key)}
		<section class="grid gap-1" aria-label={TITLES[section.key]()}>
			<div
				class="flex items-center justify-between px-2 text-xs font-medium tracking-wide text-muted-foreground uppercase"
			>
				<span>{TITLES[section.key]()}</span>
				<span class="tabular-nums">{session.format(section.total)}</span>
			</div>
			{#each section.accounts as account (account.id)}
				<div class="flex items-center gap-1" data-testid="account-row">
					<a
						href={resolve('/accounts/[id]', { id: account.id })}
						class="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
					>
						<span class="truncate">{account.name}</span>
						<span
							class="tabular-nums {account.balance < 0 ? 'text-destructive' : ''}"
							data-testid="account-balance">{session.format(account.balance)}</span
						>
					</a>
					{#if onSettings}
						<Button
							variant="ghost"
							size="icon-sm"
							aria-label={m.account_settings_for({ name: account.name })}
							onclick={() => onSettings(account)}
						>
							<SettingsIcon />
						</Button>
					{/if}
				</div>
			{/each}
		</section>
	{/each}
</div>
