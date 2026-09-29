<script lang="ts">
	import ListChecksIcon from '@lucide/svelte/icons/list-checks';
	import { Button } from '$ui/button';
	import type { RegisterSelection } from '$features/accounts/selection.svelte';
	import { m } from '$i18n/paraglide/messages';

	/**
	 * The page header's switch for choosing several register rows. Its label shows from `md:` up,
	 * or always when `labelled` (a header with room for it on phones).
	 */
	let { selection, labelled = false }: { selection: RegisterSelection; labelled?: boolean } =
		$props();
</script>

<Button
	variant={selection.active ? 'secondary' : 'outline'}
	size="sm"
	aria-label={labelled ? undefined : m.select()}
	aria-pressed={selection.active}
	onclick={() => (selection.active ? selection.stop() : selection.start())}
>
	<ListChecksIcon />
	<span class={labelled ? undefined : 'hidden md:inline'}>{m.select()}</span>
</Button>
