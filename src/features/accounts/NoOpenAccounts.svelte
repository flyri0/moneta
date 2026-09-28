<script lang="ts">
	import WalletIcon from '@lucide/svelte/icons/wallet';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import { Button } from '$ui/button';
	import EmptyState from '$components/EmptyState.svelte';
	import { m } from '$i18n/paraglide/messages';

	/** Stands in for a form that needs an open account, with a way to add one. */
	let { hasClosed, onAdd }: { hasClosed: boolean; onAdd: () => void } = $props();
</script>

<EmptyState
	icon={WalletIcon}
	title={m.no_open_accounts_title()}
	description={hasClosed ? m.no_open_accounts_closed_body() : m.no_open_accounts_body()}
>
	<Button onclick={onAdd}>
		<PlusIcon />
		{m.accounts_add()}
	</Button>
</EmptyState>
