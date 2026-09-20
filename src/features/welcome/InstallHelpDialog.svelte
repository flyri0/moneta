<script lang="ts">
	import ResponsiveDialog from '$components/ResponsiveDialog.svelte';
	import type { InstallHow } from '$client/install';
	import { m } from '$i18n/paraglide/messages';

	/** How to add Moneta to the home screen in browsers that offer no install prompt. */
	let { open = $bindable(false), how }: { open: boolean; how: InstallHow } = $props();

	const STEPS: Record<InstallHow, () => string> = {
		prompt: m.welcome_help_generic,
		ios: m.welcome_help_ios,
		safari: m.welcome_help_safari,
		firefox: m.welcome_help_firefox,
		generic: m.welcome_help_generic
	};
</script>

<ResponsiveDialog bind:open title={m.welcome_help_title()} description={STEPS[how]()}>
	<p class="text-sm text-muted-foreground">{m.welcome_point_offline()}</p>
</ResponsiveDialog>
