<script lang="ts">
	import ListChecksIcon from '@lucide/svelte/icons/list-checks';
	import { Button } from '$ui/button';
	import type { RegisterSelection } from '$features/accounts/selection.svelte';
	import { m } from '$i18n/paraglide/messages';

	/**
	 * The page header's switch for choosing several register rows. Its label shows from `md:` up.
	 */
	let { selection }: { selection: RegisterSelection } = $props();
</script>

<Button
	variant={selection.active ? 'secondary' : 'outline'}
	size="sm"
	aria-label={m.select()}
	aria-pressed={selection.active}
	onclick={() => (selection.active ? selection.stop() : selection.start())}
>
	<ListChecksIcon />
	<span class="hidden md:inline">{m.select()}</span>
</Button>
