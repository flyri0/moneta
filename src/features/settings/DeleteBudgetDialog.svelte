<script lang="ts">
	import { MediaQuery } from 'svelte/reactivity';
	import { Button } from '$ui/button';
	import { Input } from '$ui/input';
	import { Label } from '$ui/label';
	import ResponsiveDialog from '$components/ResponsiveDialog.svelte';
	import FormMessage from '$components/FormMessage.svelte';
	import type { ActionError } from '$client/notify';
	import { Countdown } from '$client/countdown';
	import { m } from '$i18n/paraglide/messages';
	import { cn } from '$utils';
	import { nameConfirms } from './delete-confirm';

	/**
	 * Confirms deleting a budget, which also deletes its saved copies: the name must be typed, and
	 * the button then waits a few seconds before a second tap deletes. `ondelete` does the deleting
	 * and returns the inline error, or null once the budget is gone.
	 */
	let {
		open = $bindable(false),
		name,
		ondelete
	}: { open: boolean; name: string; ondelete: () => Promise<ActionError | null> } = $props();

	let typed = $state('');
	let armed = $state(false);
	let countdown = $state(0);
	let busy = $state(false);
	let error = $state<ActionError | null>(null);
	const wait = new Countdown(5, (s) => ([armed, countdown] = [s.armed, s.seconds]));

	const confirmed = $derived(nameConfirms(typed, name));

	$effect(() => {
		wait.reset();
		if (!open) return;
		typed = '';
		busy = false;
		error = null;
	});

	$effect(() => () => wait.reset());

	/** Changing the name starts the confirmation over. */
	function retype() {
		wait.reset();
	}

	async function confirm() {
		if (!confirmed || busy) return;
		if (!wait.armed) {
			wait.arm();
			return;
		}
		if (!wait.ready) return;
		busy = true;
		error = await ondelete();
		busy = false;
		if (!error) open = false;
	}

	// A mouse clicks; a finger taps.
	const finePointer = new MediaQuery('(hover: hover) and (pointer: fine)');
</script>

<ResponsiveDialog bind:open title={m.budget_delete_title({ name })}>
	<div class="grid gap-4">
		<!-- Stands out once the first tap starts the wait. -->
		<p
			class={cn('text-sm', armed ? 'font-medium text-destructive' : 'text-muted-foreground')}
			role="status"
		>
			{m.budget_delete_warning({ name })}
		</p>
		<div class="grid gap-1.5">
			<Label for="delete-budget-name">{m.budget_delete_type({ name })}</Label>
			<Input
				id="delete-budget-name"
				bind:value={typed}
				oninput={retype}
				disabled={busy}
				autocomplete="off"
				autocapitalize="off"
				spellcheck={false}
			/>
		</div>
		<FormMessage {error} />
		<Button variant="destructive" disabled={busy || !confirmed || countdown > 0} onclick={confirm}>
			{#if !armed}
				{m.budget_delete_confirm()}
			{:else if countdown > 0}
				{m.budget_delete_wait({ seconds: countdown })}
			{:else}
				{finePointer.current ? m.confirm_delete_click() : m.confirm_delete()}
			{/if}
		</Button>
	</div>
</ResponsiveDialog>
