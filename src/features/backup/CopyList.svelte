<script lang="ts">
	import { Button } from '$ui/button';
	import { runAction } from '$client/notify';
	import type { SessionApi } from '$client/session';
	import type { BudgetCopy } from '$db/api';
	import { formatDateTime } from '$i18n/formats';
	import { m } from '$i18n/paraglide/messages';
	import { getLocale } from '$i18n/paraglide/runtime';
	import { downloadCopy } from './actions';

	/**
	 * A budget's saved copies (`api.system.listCopies`), each of which can be downloaded
	 * as a backup or restored. `onRestore` gets the copy's bytes.
	 */
	let {
		api,
		copies,
		name,
		busy = $bindable(false),
		onRestore
	}: {
		api: SessionApi;
		copies: BudgetCopy[];
		name: string;
		busy?: boolean;
		onRestore: (bytes: Uint8Array) => Promise<void>;
	} = $props();

	let error = $state<string | null>(null);

	async function run(fn: () => Promise<void>) {
		busy = true;
		error = await runAction(fn);
		busy = false;
	}
</script>

<ul class="divide-y" data-testid="budget-copies">
	{#each copies as copy (copy.name)}
		{@const date = formatDateTime(copy.savedAt, getLocale())}
		<li class="flex flex-wrap items-center gap-2 px-4 py-3">
			<span class="flex-1 text-sm">{m.backup_copy_saved({ date })}</span>
			<Button
				variant="outline"
				size="sm"
				disabled={busy}
				aria-label={m.backup_copy_download_named({ date })}
				onclick={() => run(() => downloadCopy(api, copy, name))}
			>
				{m.backup_copy_download()}
			</Button>
			<Button
				variant="outline"
				size="sm"
				disabled={busy}
				aria-label={m.backup_copy_restore_named({ date })}
				onclick={() => run(async () => onRestore(await api.system.readCopy(copy.name)))}
			>
				{m.backup_copy_restore()}
			</Button>
		</li>
	{/each}
</ul>
{#if error}<p class="px-4 py-3 text-sm text-destructive" role="alert">{error}</p>{/if}
