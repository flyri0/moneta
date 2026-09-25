<script lang="ts">
	import ConfirmPanel from '$components/ConfirmPanel.svelte';
	import ResponsiveDialog from '$components/ResponsiveDialog.svelte';
	import { runAction, type ActionError } from '$client/notify';

	/** Asks before a write that has no dialog of its own; it stays open with the error on failure. */
	let {
		open = $bindable(false),
		title,
		body,
		confirmLabel,
		destructive = true,
		onConfirm
	}: {
		open: boolean;
		title: string;
		body?: string;
		confirmLabel: string;
		destructive?: boolean;
		onConfirm: () => Promise<unknown>;
	} = $props();

	let error = $state<ActionError | null>(null);
	let busy = $state(false);

	$effect(() => {
		if (open) error = null;
	});

	async function confirm() {
		busy = true;
		error = await runAction(onConfirm);
		busy = false;
		if (!error) open = false;
	}
</script>

<ResponsiveDialog bind:open {title}>
	<ConfirmPanel
		{body}
		{confirmLabel}
		{destructive}
		{error}
		{busy}
		onCancel={() => (open = false)}
		onConfirm={confirm}
	/>
</ResponsiveDialog>
