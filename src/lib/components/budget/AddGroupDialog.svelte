<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import ResponsiveDialog from '$lib/components/ResponsiveDialog.svelte';
	import { useSession } from '$lib/client/app-state.svelte';
	import { runAction } from '$lib/client/notify';
	import { m } from '$lib/paraglide/messages';

	let { open = $bindable(false) }: { open: boolean } = $props();
	const session = useSession();
	let name = $state('');
	let error = $state<string | null>(null);

	$effect(() => {
		if (open) {
			name = '';
			error = null;
		}
	});

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		error = await runAction(() => session.api.categories.createGroup({ name }));
		if (!error) open = false;
	}
</script>

<ResponsiveDialog bind:open title={m.budget_add_group()}>
	<form class="grid gap-3" onsubmit={submit}>
		<div class="grid gap-2">
			<Label for="new-group-name">{m.group_name()}</Label>
			<Input id="new-group-name" bind:value={name} required autocomplete="off" />
		</div>
		{#if error}<p class="text-sm text-destructive" role="alert">{error}</p>{/if}
		<Button type="submit">{m.add()}</Button>
	</form>
</ResponsiveDialog>
