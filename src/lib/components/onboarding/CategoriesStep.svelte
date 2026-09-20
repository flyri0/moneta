<script lang="ts">
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import { Button } from '$lib/components/ui/button';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import * as Collapsible from '$lib/components/ui/collapsible';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import {
		addCategory,
		clearSelection,
		groupState,
		selectedCount,
		toggleCategory,
		toggleGroup,
		type StarterGroup
	} from '$lib/onboarding/starter-categories';
	import { m } from '$lib/paraglide/messages';
	import StepLayout from './StepLayout.svelte';

	let {
		current,
		total,
		onNext,
		onBack,
		selection = $bindable()
	}: {
		current: number;
		total: number;
		onNext: () => void;
		onBack: () => void;
		selection: StarterGroup[];
	} = $props();

	// One draft per group, so a half-typed category doesn't follow the user to the next group.
	let drafts = $state(selection.map(() => ''));

	function add(groupIndex: number) {
		selection = addCategory(selection, groupIndex, drafts[groupIndex]);
		drafts[groupIndex] = '';
	}

	/** Enter in the draft field adds the category instead of submitting the step. */
	function draftKeydown(event: KeyboardEvent, groupIndex: number) {
		if (event.key !== 'Enter') return;
		event.preventDefault();
		add(groupIndex);
	}
</script>

<StepLayout
	title={m.onboarding_categories_title()}
	description={m.onboarding_categories_intro()}
	{current}
	{total}
	nextLabel={m.onboarding_next()}
	backLabel={m.onboarding_back()}
	{onBack}
	{onNext}
>
	<div class="grid gap-2">
		{#each selection as group, gi (group.name)}
			<Collapsible.Root open class="rounded-lg border">
				<div class="flex items-center gap-3 px-3 py-2">
					<Checkbox
						id="starter-group-{gi}"
						bind:checked={
							() => groupState(group) === 'all',
							(on) => (selection = toggleGroup(selection, gi, on))
						}
						bind:indeterminate={() => groupState(group) === 'some', () => {}}
					/>
					<Label for="starter-group-{gi}" class="font-medium">{group.name}</Label>
					<Collapsible.Trigger
						type="button"
						class="group ml-auto rounded-md p-1 text-muted-foreground hover:text-foreground"
					>
						<ChevronRightIcon
							class="size-4 transition-transform group-data-[state=open]:rotate-90"
						/>
						<span class="sr-only">{group.name}</span>
					</Collapsible.Trigger>
				</div>
				<Collapsible.Content class="grid gap-3 border-t px-3 py-3">
					{#each group.categories as category, ci (category.name)}
						<div class="flex items-center gap-3">
							<Checkbox
								id="starter-category-{gi}-{ci}"
								bind:checked={
									() => category.selected, () => (selection = toggleCategory(selection, gi, ci))
								}
							/>
							<Label for="starter-category-{gi}-{ci}" class="font-normal">
								{category.name}
							</Label>
						</div>
					{/each}
					<div class="flex gap-2">
						<Input
							bind:value={drafts[gi]}
							placeholder={m.onboarding_categories_add_placeholder()}
							autocomplete="off"
							aria-label="{m.onboarding_categories_add()} — {group.name}"
							onkeydown={(event) => draftKeydown(event, gi)}
						/>
						<Button
							type="button"
							variant="outline"
							size="icon"
							disabled={drafts[gi].trim() === ''}
							onclick={() => add(gi)}
						>
							<PlusIcon class="size-4" />
							<span class="sr-only">{m.onboarding_categories_add()}</span>
						</Button>
					</div>
				</Collapsible.Content>
			</Collapsible.Root>
		{/each}
	</div>
	<div class="flex items-center justify-between gap-4">
		<p class="text-sm text-muted-foreground">
			{m.onboarding_categories_selected({ count: selectedCount(selection) })}
		</p>
		<Button
			type="button"
			variant="ghost"
			size="sm"
			onclick={() => (selection = clearSelection(selection))}
		>
			{m.onboarding_categories_clear()}
		</Button>
	</div>
</StepLayout>
