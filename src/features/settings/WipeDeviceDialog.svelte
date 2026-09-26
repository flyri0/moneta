<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button } from '$ui/button';
	import ResponsiveDialog from '$components/ResponsiveDialog.svelte';
	import FormMessage from '$components/FormMessage.svelte';
	import { useSession } from '$client/app-state.svelte';
	import { runAction, type ActionError } from '$client/notify';
	import { wipeDevice } from '$client/session';
	import { forgetCloud } from '$features/backup/cloud/cloud.svelte';
	import { m } from '$i18n/paraglide/messages';
	import { cn } from '$utils';

	/**
	 * Confirms deleting everything Moneta keeps on this device, the most destructive action it
	 * has: like deleting a budget, the button waits a few seconds before a second tap deletes.
	 */
	let { open = $bindable(false) }: { open: boolean } = $props();

	/** Seconds the button stays disabled after the first tap, with the warning shown. */
	const DELETE_DELAY = 5;

	const session = useSession();
	let armed = $state(false);
	let countdown = $state(0);
	let busy = $state(false);
	let error = $state<ActionError | null>(null);

	$effect(() => {
		if (!open) return;
		armed = false;
		countdown = 0;
		busy = false;
		error = null;
	});

	$effect(() => {
		if (countdown <= 0) return;
		const timer = setTimeout(() => countdown--, 1000);
		return () => clearTimeout(timer);
	});

	async function confirm() {
		if (busy) return;
		if (!armed) {
			armed = true;
			countdown = DELETE_DELAY;
			return;
		}
		if (countdown > 0) return;
		busy = true;
		error = await runAction(async () => {
			// First, so no automatic backup starts while the budgets go.
			await forgetCloud();
			await wipeDevice(session.api, localStorage);
		});
		if (error) {
			busy = false;
			return;
		}
		// A fresh start: the page reloads into onboarding, with nothing left to open.
		location.replace(resolve('/budget'));
	}
</script>

<ResponsiveDialog bind:open title={m.wipe_title()}>
	<div class="grid gap-4">
		<p
			class={cn('text-sm', armed ? 'font-medium text-destructive' : 'text-muted-foreground')}
			role="status"
		>
			{m.wipe_warning()}
		</p>
		<FormMessage {error} />
		<Button variant="destructive" disabled={busy || countdown > 0} onclick={confirm}>
			{#if !armed}
				{m.wipe_confirm()}
			{:else if countdown > 0}
				{m.budget_delete_wait({ seconds: countdown })}
			{:else}
				{m.confirm_delete()}
			{/if}
		</Button>
	</div>
</ResponsiveDialog>
