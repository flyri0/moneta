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
	let confirmReplace = $state(false);
	let busy = $state(false);
	let error = $state<string | null>(null);

	$effect(() => {
		if (!open) return;
		confirmReplace = false;
		error = null;
	});

	async function restore(replace: boolean) {
		if (!file) return;
		if (replace && !confirmReplace) {
			confirmReplace = true;
			return;
		}
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
		<div class="grid gap-1">
			<Button variant="destructive" disabled={busy} onclick={() => restore(true)}>
				{confirmReplace
					? m.backup_restore_replace_confirm()
					: m.backup_restore_replace({ name: session.meta.name })}
			</Button>
			<p class="text-xs text-muted-foreground">
				{m.backup_restore_replace_hint({ name: session.meta.name })}
			</p>
		</div>
		<Button variant="outline" disabled={busy} onclick={() => restore(false)}>
			{m.backup_restore_new()}
		</Button>
		{#if error}<p class="text-sm text-destructive" role="alert">{error}</p>{/if}
	</div>
</ResponsiveDialog>
