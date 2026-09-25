<script lang="ts">
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import SlidersHorizontalIcon from '@lucide/svelte/icons/sliders-horizontal';
	import * as Collapsible from '$ui/collapsible';
	import { Button } from '$ui/button';
	import PageHeader from '$components/PageHeader.svelte';
	import ReportsEditor from '$features/reports/ReportsEditor.svelte';
	import { useSession } from '$client/app-state.svelte';
	import { REPORTS } from '$features/reports/catalog';
	import {
		hiddenCards,
		loadLayout,
		saveLayout,
		visibleCards,
		type ReportsLayout
	} from '$features/reports/layout';
	import { m } from '$i18n/paraglide/messages';

	const session = useSession();

	// Which reports show, and in what order. A per-device convenience, so it lives outside the
	// budget file, like the budget's collapsed groups.
	let layout = $state<ReportsLayout>(loadLayout(localStorage, session.file));
	let editing = $state(false);
	const visible = $derived(visibleCards(layout));
	const hidden = $derived(hiddenCards(layout));

	function save(next: ReportsLayout) {
		layout = next;
		saveLayout(localStorage, session.file, next);
		editing = false;
	}
</script>

<PageHeader title={m.nav_reports()}>
	{#snippet actions()}
		{#if !editing}
			<Button
				variant="outline"
				size="sm"
				aria-label={m.reports_customize()}
				onclick={() => (editing = true)}
			>
				<SlidersHorizontalIcon />
				<span class="hidden md:inline">{m.reports_customize()}</span>
			</Button>
		{/if}
	{/snippet}
</PageHeader>

<div class="mx-auto grid max-w-2xl gap-4 p-3 md:p-6 lg:max-w-5xl">
	{#if editing}
		<ReportsEditor {layout} onSave={save} onCancel={() => (editing = false)} />
	{:else}
		<div class="grid gap-4 lg:grid-cols-2" data-testid="report-cards">
			{#each visible as id (id)}
				{@const Card = REPORTS[id].card}
				<Card />
			{/each}
		</div>

		{#if hidden.length > 0}
			<Collapsible.Root class="grid gap-2">
				<Collapsible.Trigger
					class="group inline-flex cursor-pointer items-center gap-1.5 px-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase hover:text-foreground"
				>
					<ChevronRightIcon class="size-4 transition-transform group-data-[state=open]:rotate-90" />
					{m.reports_hidden_reports({ count: hidden.length })}
				</Collapsible.Trigger>
				<Collapsible.Content>
					<div class="grid gap-4 lg:grid-cols-2" data-testid="hidden-report-cards">
						{#each hidden as id (id)}
							{@const Card = REPORTS[id].card}
							<Card />
						{/each}
					</div>
				</Collapsible.Content>
			</Collapsible.Root>
		{/if}
	{/if}
</div>
<svelte:head><title>{m.nav_reports()} · {m.app_name()}</title></svelte:head>
