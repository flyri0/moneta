<script lang="ts">
	import EyeIcon from '@lucide/svelte/icons/eye';
	import EyeOffIcon from '@lucide/svelte/icons/eye-off';
	import * as InputGroup from '$ui/input-group';
	import { m } from '$i18n/paraglide/messages';
	import type { HTMLInputAttributes } from 'svelte/elements';

	/** A password field with a button that shows what was typed. */
	let {
		value = $bindable(''),
		...rest
	}: Omit<HTMLInputAttributes, 'type' | 'value' | 'files'> & { value?: string } = $props();

	let shown = $state(false);
</script>

<InputGroup.Root>
	<InputGroup.Input type={shown ? 'text' : 'password'} bind:value {...rest} />
	<InputGroup.Addon align="inline-end">
		<InputGroup.Button
			size="icon-xs"
			aria-label={shown ? m.password_hide() : m.password_show()}
			aria-pressed={shown}
			onclick={() => (shown = !shown)}
		>
			{#if shown}<EyeOffIcon />{:else}<EyeIcon />{/if}
		</InputGroup.Button>
	</InputGroup.Addon>
</InputGroup.Root>
