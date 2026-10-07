<script lang="ts">
	import type { AccountType } from '$db/repos/accounts';
	import { cn } from '$utils';
	import { accountTypeIcon } from './account-icons';

	/** An account's emoji icon, or its type's when it has none. `class` sizes either. */
	let {
		account,
		class: className
	}: { account: { type: AccountType; icon: string | null }; class?: string } = $props();

	const Icon = $derived(accountTypeIcon(account.type));
</script>

{#if account.icon}
	<span
		aria-hidden="true"
		class={cn('inline-flex items-center justify-center leading-none text-foreground', className)}
		>{account.icon}</span
	>
{:else}
	<Icon class={className} />
{/if}
