<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Separator } from '$lib/components/ui/separator';
	import RestoreDialog from './RestoreDialog.svelte';
	import { backUp, exportBudgetJson, exportTransactionsCsv } from '$lib/backup/actions';
	import { useSession } from '$lib/client/app-state.svelte';
	import { runActionToast } from '$lib/client/notify';
	import { formatDateTime } from '$lib/i18n/formats';
	import { m } from '$lib/paraglide/messages';

	const session = useSession();
	let restoring = $state(false);
	let picked = $state<File | null>(null);
	let chosen = $state('');

	function pick(event: Event & { currentTarget: HTMLInputElement }) {
		picked = event.currentTarget.files?.[0] ?? null;
		// Clear the input so choosing the same file again still fires `change`.
		chosen = '';
		if (picked) restoring = true;
	}
</script>

<Card.Root>
	<Card.Header>
		<Card.Title>{m.settings_backup()}</Card.Title>
		<Card.Description>{m.backup_hint()}</Card.Description>
	</Card.Header>
	<Card.Content class="grid gap-4">
		<p class="text-sm" data-testid="last-backup">
			{session.meta.lastBackupAt
				? m.backup_last({ date: formatDateTime(session.meta.lastBackupAt, session.meta.locale) })
				: m.backup_never()}
		</p>
		<Button class="justify-self-start" onclick={() => runActionToast(() => backUp(session))}>
			{m.backup_now()}
		</Button>
		<div class="grid gap-2">
			<Label for="restore-file">{m.backup_restore()}</Label>
			<Input
				id="restore-file"
				type="file"
				bind:value={chosen}
				accept=".sqlite,.sqlite3,.db,application/vnd.sqlite3,application/x-sqlite3"
				onchange={pick}
			/>
		</div>
		<Separator />
		<div class="grid gap-2">
			<p class="text-sm font-medium">{m.backup_exports()}</p>
			<p class="text-xs text-muted-foreground">{m.backup_exports_hint()}</p>
			<div class="flex flex-wrap gap-2">
				<Button
					variant="outline"
					onclick={() => runActionToast(() => exportTransactionsCsv(session))}
				>
					{m.backup_export_csv()}
				</Button>
				<Button variant="outline" onclick={() => runActionToast(() => exportBudgetJson(session))}>
					{m.backup_export_json()}
				</Button>
			</div>
		</div>
	</Card.Content>
</Card.Root>

<RestoreDialog bind:open={restoring} file={picked} />
