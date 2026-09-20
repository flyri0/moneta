<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Badge } from '$ui/badge';
	import { Button } from '$ui/button';
	import SettingsGroup from './SettingsGroup.svelte';
	import SettingsRow from './SettingsRow.svelte';
	import { getApp, useSession } from '$client/app-state.svelte';
	import { runAction } from '$client/notify';
	import { loadRegistry } from '$client/registry';
	import { deleteBudget, switchBudget } from '$client/session';
	import { currentMonth } from '$domain/month';
	import { m } from '$i18n/paraglide/messages';

	const app = getApp();
	const session = useSession();
	let budgets = $state(loadRegistry(localStorage).budgets);
	let confirming = $state<string | null>(null);
	let error = $state<string | null>(null);

	async function open(file: string) {
		error = await runAction(async () => {
			const opened = await switchBudget(session.api, localStorage, file);
			app.show(session.client, opened.file, opened.meta);
		});
		if (!error) void goto(resolve('/budget/[month]', { month: currentMonth() }));
	}

	async function remove(file: string) {
		if (confirming !== file) {
			confirming = file;
			return;
		}
		confirming = null;
		error = await runAction(async () => {
			const next = await deleteBudget(session.api, localStorage, file, session.file);
			if (next?.kind === 'ready') app.show(session.client, next.file, next.meta);
			else if (next?.kind === 'onboarding') {
				app.session = null;
				app.boot = { kind: 'onboarding' };
			}
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
							aria-label={confirming === budget.file
								? undefined
								: m.settings_budget_delete_named({ name })}
							onclick={() => remove(budget.file)}
						>
							{confirming === budget.file ? m.confirm_delete() : m.delete()}
						</Button>
					{/snippet}
				</SettingsRow>
			</li>
		{/each}
	</ul>
	{#if error}
		<p class="px-4 py-3 text-sm text-destructive" role="alert">{error}</p>
	{/if}
	<SettingsRow
		label={m.settings_budget_new()}
		onclick={() => (app.boot = { kind: 'onboarding' })}
	/>
</SettingsGroup>
