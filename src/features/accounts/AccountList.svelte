<script lang="ts">
	import { resolve } from '$app/paths';
	import SettingsIcon from '@lucide/svelte/icons/settings-2';
	import { Button } from '$ui/button';
	import * as Tooltip from '$ui/tooltip';
	import { accountSections, type AccountSectionKey } from '$features/accounts/account-form';
	import { accountTypeIcon } from '$features/accounts/account-icons';
	import { useSession } from '$client/app-state.svelte';
	import type { Account } from '$db/repos/accounts';
	import { accountTypeLabel } from '$i18n/labels';
	import { m } from '$i18n/paraglide/messages';

	let {
		accounts,
		onSettings,
		variant = 'card'
	}: {
		accounts: Account[];
		onSettings?: (account: Account) => void;
		/** `compact` and `rail` are the desktop sidebar's, expanded and collapsed to icons. */
		variant?: 'card' | 'compact' | 'rail';
	} = $props();

	const session = useSession();
	const sections = $derived(accountSections(accounts));
	const TITLES: Record<AccountSectionKey, () => string> = {
		onBudget: m.accounts_on_budget,
		offBudget: m.accounts_off_budget,
		closed: m.accounts_closed
	};
</script>

{#if variant === 'rail'}
	<!-- Only the icons fit: the name and balance show in a tooltip, mounted while it is open. -->
	<div class="grid gap-3">
		{#each sections as section (section.key)}
			<section
				class="grid justify-items-center gap-1 border-t pt-3"
				aria-label={TITLES[section.key]()}
			>
				{#each section.accounts as account (account.id)}
					{@const Icon = accountTypeIcon(account.type)}
					{@const balance = session.format(account.balance)}
					<Tooltip.Root>
						<Tooltip.Trigger>
							{#snippet child({ props })}
								<a
									{...props}
									href={resolve('/accounts/[id]', { id: account.id })}
									aria-label={m.sidebar_account({ name: account.name, balance })}
									data-testid="account-row"
									class="relative flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
								>
									<Icon class="size-4" />
									{#if account.balance < 0}
										<span
											aria-hidden="true"
											class="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-destructive"
										></span>
									{/if}
								</a>
							{/snippet}
						</Tooltip.Trigger>
						<Tooltip.Content side="right" class="flex-col items-start gap-0.5">
							<span class="max-w-56 truncate font-medium">{account.name}</span>
							<span class="whitespace-nowrap tabular-nums" data-testid="account-balance"
								>{balance}</span
							>
						</Tooltip.Content>
					</Tooltip.Root>
				{/each}
			</section>
		{/each}
	</div>
{:else if variant === 'compact'}
	<!-- A balance never wraps or shrinks: when the name can't keep 6rem beside it, it takes a
	line of its own and the name truncates. The grids use `grid-cols-1` so a long name can't widen
	the column past the sidebar. -->
	<div class="grid grid-cols-1 gap-4">
		{#each sections as section (section.key)}
			<section class="grid grid-cols-1 gap-1" aria-label={TITLES[section.key]()}>
				<div
					class="flex flex-wrap items-center justify-between gap-x-2 px-2 text-xs font-medium tracking-wide text-muted-foreground uppercase"
				>
					<span class="min-w-0 flex-[1_1_6rem] truncate">{TITLES[section.key]()}</span>
					<span class="ml-auto whitespace-nowrap tabular-nums">{session.format(section.total)}</span
					>
				</div>
				{#each section.accounts as account (account.id)}
					<div class="flex items-center gap-1" data-testid="account-row">
						<a
							href={resolve('/accounts/[id]', { id: account.id })}
							class="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-2 rounded-md px-2 py-1.5 text-sm hover:bg-sidebar-accent"
						>
							<span class="min-w-0 flex-[1_1_6rem] truncate" title={account.name}
								>{account.name}</span
							>
							<span
								class="ml-auto shrink-0 whitespace-nowrap tabular-nums {account.balance < 0
									? 'text-destructive'
									: ''}"
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
{:else}
	<div class="grid gap-6">
		{#each sections as section (section.key)}
			<section class="grid gap-2" aria-label={TITLES[section.key]()}>
				<div
					class="flex items-center justify-between px-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase"
				>
					<span>{TITLES[section.key]()}</span>
					<span class="tabular-nums">{session.format(section.total)}</span>
				</div>
				<div
					class="divide-y overflow-hidden rounded-xl border bg-card text-card-foreground shadow-xs"
				>
					{#each section.accounts as account (account.id)}
						{@const Icon = accountTypeIcon(account.type)}
						<div
							class="flex items-center transition-colors hover:bg-muted/40"
							data-testid="account-row"
						>
							<a
								href={resolve('/accounts/[id]', { id: account.id })}
								class="flex min-w-0 flex-1 items-center justify-between gap-3 px-4 py-3 text-left"
							>
								<div class="flex min-w-0 items-center gap-3">
									<div
										class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
									>
										<Icon class="size-4" />
									</div>
									<div class="grid min-w-0 gap-0.5">
										<span class="truncate text-sm font-medium">{account.name}</span>
										<span class="text-xs text-muted-foreground"
											>{accountTypeLabel(account.type)}</span
										>
									</div>
								</div>
								<span
									class="shrink-0 text-sm font-semibold tabular-nums {account.balance < 0
										? 'text-destructive'
										: ''}"
									data-testid="account-balance"
								>
									{session.format(account.balance)}
								</span>
							</a>
							{#if onSettings}
								<div class="shrink-0 pr-3">
									<Button
										variant="ghost"
										size="icon-sm"
										aria-label={m.account_settings_for({ name: account.name })}
										onclick={() => onSettings(account)}
									>
										<SettingsIcon class="size-4 text-muted-foreground" />
									</Button>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			</section>
		{/each}
	</div>
{/if}
