<script lang="ts">
	import { Button } from '$ui/button';
	import { Input } from '$ui/input';
	import { Label } from '$ui/label';
	import ResponsiveDialog from '$components/ResponsiveDialog.svelte';
	import FormMessage from '$components/FormMessage.svelte';
	import { useSession } from '$client/app-state.svelte';
	import { runAction, type ActionError } from '$client/notify';
	import { submitOnce } from '$client/submit.svelte';
	import { m } from '$i18n/paraglide/messages';

	let { open = $bindable(false) }: { open: boolean } = $props();
	const session = useSession();
	let name = $state('');
	let error = $state<ActionError | null>(null);

	$effect(() => {
		if (open) {
			name = '';
			error = null;
		}
	});

	async function create(event: SubmitEvent) {
		event.preventDefault();
		error = await runAction(() => session.api.categories.createGroup({ name }));
		if (!error) open = false;
	}
	const submit = submitOnce(create);
</script>

<ResponsiveDialog bind:open title={m.budget_add_group()}>
	<form class="grid gap-3" onsubmit={submit.run}>
		<div class="grid gap-2">
			<Label for="new-group-name">{m.group_name()}</Label>
			<Input id="new-group-name" bind:value={name} required autocomplete="off" />
		</div>
		<FormMessage {error} />
		<Button type="submit" disabled={submit.pending}>{m.add()}</Button>
	</form>
</ResponsiveDialog>
