<script lang="ts">
	import ResponsiveDialog from '$components/ResponsiveDialog.svelte';
	import { m } from '$i18n/paraglide/messages';
	import AddAccountForm from './AddAccountForm.svelte';

	let { open = $bindable(false) }: { open: boolean } = $props();
</script>

<ResponsiveDialog bind:open title={m.accounts_add()}>
	<AddAccountForm onCreated={() => (open = false)} />
</ResponsiveDialog>
