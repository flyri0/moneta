<script lang="ts">
	import { Button } from '$ui/button';
	import { Input } from '$ui/input';
	import { Label } from '$ui/label';
	import ResponsiveDialog from '$components/ResponsiveDialog.svelte';
	import { m } from '$i18n/paraglide/messages';
	import { cn } from '$utils';
	import { nameConfirms } from './delete-confirm';

	/**
	 * Confirms deleting a budget, which also deletes its saved copies: the name must be typed, and
	 * the button then waits a few seconds before a second tap deletes. `ondelete` does the deleting
	 * and returns an inline error message, or null once the budget is gone.
	 */
	let {
		open = $bindable(false),
		name,
		ondelete
	}: { open: boolean; name: string; ondelete: () => Promise<string | null> } = $props();

	/** Seconds the button stays disabled after the first tap, with the warning shown. */
	const DELETE_DELAY = 5;

	let typed = $state('');
	let armed = $state(false);
	let countdown = $state(0);
	let busy = $state(false);
	let error = $state<string | null>(null);

	const confirmed = $derived(nameConfirms(typed, name));

	$effect(() => {
		if (!open) return;
		typed = '';
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

	/** Changing the name starts the confirmation over. */
	function retype() {
		armed = false;
		countdown = 0;
	}

	async function confirm() {
		if (!confirmed || busy) return;
		if (!armed) {
			armed = true;
			countdown = DELETE_DELAY;
			return;
		}
		if (countdown > 0) return;
		busy = true;
		error = await ondelete();
		busy = false;
		if (!error) open = false;
	}
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
		<Button variant="destructive" disabled={busy || !confirmed || countdown > 0} onclick={confirm}>
			{#if !armed}
				{m.budget_delete_confirm()}
			{:else if countdown > 0}
				{m.budget_delete_wait({ seconds: countdown })}
			{:else}
				{m.confirm_delete()}
			{/if}
		</Button>
		{#if error}<p class="text-sm text-destructive" role="alert">{error}</p>{/if}
	</div>
</ResponsiveDialog>
