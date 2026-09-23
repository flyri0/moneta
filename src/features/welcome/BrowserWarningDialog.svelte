<script lang="ts">
	import ResponsiveDialog from '$components/ResponsiveDialog.svelte';
	import { Button } from '$ui/button';
	import { m } from '$i18n/paraglide/messages';

	/** Warns that a browser tab may lose the budget, and recommends installing instead. */
	let {
		open = $bindable(false),
		onInstall,
		onContinue
	}: { open: boolean; onInstall: () => void; onContinue: () => void } = $props();
</script>

<ResponsiveDialog
	bind:open
	title={m.welcome_browser_title()}
	description={m.welcome_browser_body()}
>
	<div class="grid gap-4">
		<p class="text-sm text-muted-foreground">{m.welcome_browser_backup()}</p>
		<div class="grid gap-2">
			<Button onclick={onInstall}>{m.welcome_install()}</Button>
			<Button variant="outline" onclick={onContinue}>{m.welcome_browser_continue()}</Button>
		</div>
	</div>
</ResponsiveDialog>
