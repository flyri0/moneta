<script lang="ts">
	import ResponsiveDialog from '$components/ResponsiveDialog.svelte';
	import { m } from '$i18n/paraglide/messages';
	import AddAccountForm from './AddAccountForm.svelte';

	let { open = $bindable(false) }: { open: boolean } = $props();
	let back = $state<(() => void) | undefined>();
</script>

<ResponsiveDialog bind:open title={m.accounts_add()} onMobileBack={back}>
	<AddAccountForm bind:back onCreated={() => (open = false)} />
</ResponsiveDialog>
