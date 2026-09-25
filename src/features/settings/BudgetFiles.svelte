<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Badge } from '$ui/badge';
	import { Button } from '$ui/button';
	import FormMessage from '$components/FormMessage.svelte';
	import DeleteBudgetDialog from './DeleteBudgetDialog.svelte';
	import SettingsGroup from './SettingsGroup.svelte';
	import SettingsRow from './SettingsRow.svelte';
	import { getApp, useSession } from '$client/app-state.svelte';
	import { runAction, type ActionError } from '$client/notify';
	import { loadRegistry } from '$client/registry';
	import { deleteBudget, switchBudget } from '$client/session';
	import { currentMonth } from '$domain/month';
	import { m } from '$i18n/paraglide/messages';

	const app = getApp();
	const session = useSession();
	let budgets = $state(loadRegistry(localStorage).budgets);
	let deleting = $state<{ file: string; name: string } | null>(null);
	let confirmingDelete = $state(false);
	let error = $state<ActionError | null>(null);

	async function open(file: string) {
		error = await runAction(async () => {
			const opened = await switchBudget(session.api, localStorage, file);
			app.show(session.client, opened.file, opened.meta);
		});
		if (!error) void goto(resolve('/budget/[month]', { month: currentMonth() }));
	}

	function askToDelete(file: string, name: string) {
		deleting = { file, name };
		confirmingDelete = true;
	}

	function remove(file: string): Promise<ActionError | null> {
		return runAction(async () => {
			const next = await deleteBudget(session.api, localStorage, file, session.file);
			if (next) app.apply(session.client, next);
			budgets = loadRegistry(localStorage).budgets;
		});
	}
</script>

<SettingsGroup title={m.settings_budget_files()}>
	<ul class="divide-y" data-testid="budget-files">
		{#each budgets as budget (budget.file)}
			{@const current = budget.file === session.file}
			{@const name = current ? session.meta.name : budget.name}
			<li>
				<SettingsRow label={name}>
					{#snippet control()}
						{#if current}
							<Badge variant="secondary">{m.settings_budget_current()}</Badge>
						{:else}
							<Button
								variant="outline"
								size="sm"
								aria-label={m.settings_budget_open_named({ name })}
								onclick={() => open(budget.file)}
							>
								{m.settings_budget_open()}
							</Button>
						{/if}
						<Button
							variant="destructive"
							size="sm"
							aria-label={m.settings_budget_delete_named({ name })}
							onclick={() => askToDelete(budget.file, name)}
						>
							{m.delete()}
						</Button>
					{/snippet}
				</SettingsRow>
			</li>
		{/each}
	</ul>
	<FormMessage {error} />
	<SettingsRow
		label={m.settings_budget_new()}
		onclick={() => (app.boot = { kind: 'onboarding' })}
	/>
</SettingsGroup>

{#if deleting}
	{@const target = deleting}
	<DeleteBudgetDialog
		bind:open={confirmingDelete}
		name={target.name}
		ondelete={() => remove(target.file)}
	/>
{/if}
