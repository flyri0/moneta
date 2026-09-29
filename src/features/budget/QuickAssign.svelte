<script lang="ts">
	import LoadingRows from '$components/LoadingRows.svelte';
	import FormMessage from '$components/FormMessage.svelte';
	import { useSession } from '$client/app-state.svelte';
	import { useLive } from '$client/live.svelte';
	import { actionError, runAction, type ActionError } from '$client/notify';
	import { offerUndo } from '$client/undo';
	import type { Month } from '$domain/month';
	import type { QuickAssignStrategy } from '$domain/quick-assign';
	import { m } from '$i18n/paraglide/messages';
	import { BUDGET_TABLES } from './view';

	/** The quick-assign screen of a sheet: each strategy with what it would leave assigned. */
	let {
		categoryIds,
		month,
		onDone
	}: {
		categoryIds: string[];
		month: Month;
		onDone: () => void;
	} = $props();

	const session = useSession();
	const preview = useLive(session.client, BUDGET_TABLES, () =>
		session.api.budget.previewQuickAssign({ month, categoryIds })
	);
	let error = $state<ActionError | null>(null);

	const LABELS: Record<QuickAssignStrategy, () => string> = {
		goals: m.quick_assign_goals,
		'last-month': m.quick_assign_last_month,
		'avg-3': () => m.quick_assign_average({ months: 3 }),
		'avg-6': () => m.quick_assign_average({ months: 6 }),
		'avg-12': () => m.quick_assign_average({ months: 12 }),
		'cover-overspending': m.quick_assign_cover,
		clear: m.quick_assign_clear
	};

	async function apply(strategy: QuickAssignStrategy) {
		const call = session.api.budget.quickAssign({ month, categoryIds, strategy });
		error = await runAction(() => call);
		if (error) return;
		onDone();
		offerUndo(session.client, call, m.budget_quick_assigned({ strategy: LABELS[strategy]() }));
	}
</script>

{#if preview.error}
	<FormMessage error={actionError(preview.error)} />
{:else if preview.data}
	<div class="grid gap-3">
		<div class="flex items-center justify-between text-sm">
			<span class="text-muted-foreground">{m.budget_assigned_this_month()}</span>
			<span class="font-semibold tabular-nums">{session.format(preview.data.assigned)}</span>
		</div>
		{#if preview.data.options.length === 0}
			<p class="text-sm text-muted-foreground">{m.quick_assign_none()}</p>
		{:else}
			<div class="-mx-2 grid gap-0.5">
				{#each preview.data.options as { strategy, assigned } (strategy)}
					<button
						type="button"
						class="flex min-h-11 w-full items-center gap-3 rounded-md px-2 text-left text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
						onclick={() => apply(strategy)}
					>
						<span class="flex-1">{LABELS[strategy]()}</span>
						<span class="font-medium tabular-nums">{session.format(assigned)}</span>
					</button>
				{/each}
			</div>
		{/if}
		<FormMessage {error} />
	</div>
{:else}
	<LoadingRows rows={4} class="-mx-4" />
{/if}
