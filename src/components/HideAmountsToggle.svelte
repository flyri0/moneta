<script lang="ts">
	import EyeIcon from '@lucide/svelte/icons/eye';
	import EyeOffIcon from '@lucide/svelte/icons/eye-off';
	import { Button } from '$ui/button';
	import { amounts, toggleHideAmounts } from '$client/hide-amounts.svelte';
	import { m } from '$i18n/paraglide/messages';

	/** The eye in every page header: hides or shows money amounts on every screen. */
	const label = $derived(amounts.hidden ? m.amounts_show() : m.amounts_hide());
</script>

<Button
	variant="ghost"
	size="icon-sm"
	class="text-muted-foreground"
	aria-label={label}
	aria-pressed={amounts.hidden}
	title={label}
	data-testid="hide-amounts"
	onclick={toggleHideAmounts}
>
	{#if amounts.hidden}<EyeOffIcon />{:else}<EyeIcon />{/if}
</Button>
