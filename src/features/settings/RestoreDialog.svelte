<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { toast } from 'svelte-sonner';
	import { Button } from '$ui/button';
	import ResponsiveDialog from '$components/ResponsiveDialog.svelte';
	import { getApp, useSession } from '$client/app-state.svelte';
	import { runAction } from '$client/notify';
	import { restoreBudget } from '$client/session';
	import { currentMonth } from '$domain/month';
	import { m } from '$i18n/paraglide/messages';

	let { open = $bindable(false), file }: { open: boolean; file: File | null } = $props();
	const app = getApp();
	const session = useSession();
	/** Seconds the replace button stays disabled after the first tap, with the warning shown. */
	const REPLACE_DELAY = 5;

	let confirmReplace = $state(false);
	let countdown = $state(0);
	let busy = $state(false);
	let error = $state<string | null>(null);

	$effect(() => {
		if (!open) return;
		confirmReplace = false;
		countdown = 0;
		error = null;
	});

	$effect(() => {
		if (countdown <= 0) return;
		const timer = setTimeout(() => countdown--, 1000);
		return () => clearTimeout(timer);
	});

	async function restore(replace: boolean) {
		if (!file) return;
		if (replace && !confirmReplace) {
			confirmReplace = true;
			countdown = REPLACE_DELAY;
			return;
		}
		if (replace && countdown > 0) return;
		busy = true;
		const bytes = new Uint8Array(await file.arrayBuffer());
		error = await runAction(async () => {
			const restored = await restoreBudget(session.api, localStorage, bytes, session.file, replace);
			app.show(session.client, restored.file, restored.meta);
		});
		busy = false;
		if (error) return;
		open = false;
		toast.success(m.backup_restored());
		void goto(resolve('/budget/[month]', { month: currentMonth() }));
	}
</script>

<ResponsiveDialog
	bind:open
	title={m.backup_restore_title()}
	description={file ? m.backup_restore_file({ file: file.name }) : undefined}
>
	<div class="grid gap-4">
		<Button disabled={busy} onclick={() => restore(false)}>
			{m.backup_restore_new()}
		</Button>
		<div class="grid gap-1">
			<Button variant="destructive" disabled={busy || countdown > 0} onclick={() => restore(true)}>
				{#if !confirmReplace}
					{m.backup_restore_replace({ name: session.meta.name })}
				{:else if countdown > 0}
					{m.backup_restore_replace_wait({ seconds: countdown })}
				{:else}
					{m.backup_restore_replace_confirm()}
				{/if}
			</Button>
			{#if confirmReplace}
				<p class="text-sm font-medium text-destructive" role="status">
					{m.backup_restore_replace_warning({ name: session.meta.name })}
				</p>
			{/if}
			<p class="text-xs text-muted-foreground">
				{m.backup_restore_replace_hint({ name: session.meta.name })}
			</p>
		</div>
		{#if error}<p class="text-sm text-destructive" role="alert">{error}</p>{/if}
	</div>
</ResponsiveDialog>
