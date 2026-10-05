<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { m } from '$i18n/paraglide/messages';

	/** Switches between the register of every transaction and the schedules still to come. */
	const scheduled = $derived(page.url.pathname.startsWith('/transactions/scheduled'));
</script>

<div class="inline-flex justify-self-start rounded-lg bg-muted p-0.5 text-sm">
	<a
		href={resolve('/transactions')}
		aria-current={scheduled ? undefined : 'page'}
		class="rounded-md px-3 py-1 text-muted-foreground transition-colors aria-[current=page]:bg-background aria-[current=page]:text-foreground aria-[current=page]:shadow-sm"
	>
		{m.transactions_tab_all()}
	</a>
	<a
		href={resolve('/transactions/scheduled')}
		aria-current={scheduled ? 'page' : undefined}
		data-tour="scheduled-tab"
		class="rounded-md px-3 py-1 text-muted-foreground transition-colors aria-[current=page]:bg-background aria-[current=page]:text-foreground aria-[current=page]:shadow-sm"
	>
		{m.transactions_tab_scheduled()}
	</a>
</div>
