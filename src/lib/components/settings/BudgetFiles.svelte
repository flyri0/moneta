<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { getApp, useSession } from '$lib/client/app-state.svelte';
	import { runAction } from '$lib/client/notify';
	import { loadRegistry } from '$lib/client/registry';
	import { deleteBudget, switchBudget } from '$lib/client/session';
	import { currentMonth } from '$lib/domain/month';
	import { m } from '$lib/paraglide/messages';

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

<Card.Root>
	<Card.Header>
		<Card.Title>{m.settings_budget_files()}</Card.Title>
	</Card.Header>
	<Card.Content class="grid gap-4">
		<ul class="grid gap-2" data-testid="budget-files">
			{#each budgets as budget (budget.file)}
				{@const current = budget.file === session.file}
				{@const name = current ? session.meta.name : budget.name}
				<li class="flex flex-wrap items-center gap-2">
					<span class="min-w-0 flex-1 truncate">{name}</span>
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
				</li>
			{/each}
		</ul>
		{#if error}<p class="text-sm text-destructive" role="alert">{error}</p>{/if}
		<Button
			variant="outline"
			class="justify-self-start"
			onclick={() => (app.boot = { kind: 'onboarding' })}
		>
			{m.settings_budget_new()}
		</Button>
	</Card.Content>
</Card.Root>
